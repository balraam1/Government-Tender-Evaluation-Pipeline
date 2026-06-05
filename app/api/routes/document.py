"""
Module 3: Document Upload + OCR
Module 4: Tender Metadata Extraction
POST /api/document/upload
POST /api/document/extract
GET  /api/document/{doc_id}
"""
import os
import uuid
import logging
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models import Document, Tender, AuditLog
from app.services.ocr_service import ocr_service
from app.services.vector_service import vector_service
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/document", tags=["Module 3 & 4 - Document Processing"])
logger = logging.getLogger(__name__)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("/upload", summary="Upload document with OCR processing")
async def upload_document(
    file: UploadFile = File(...),
    tender_id: int = Form(None),
    vendor_id: int = Form(None),
    document_type: str = Form("GENERAL"),
    db: Session = Depends(get_db),
):
    """
    **Module 3: Document Upload & OCR**
    
    Supports: PDF, DOC, DOCX
    - Extracts text via PaddleOCR (scanned) or pdfplumber (native)
    - Generates vector embeddings stored in Qdrant
    - Returns extracted text and metadata
    """
    # Validate file type
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ["pdf", "doc", "docx"]:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}. Allowed: PDF, DOC, DOCX")

    # Save file
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    content = await file.read()

    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max: {settings.MAX_FILE_SIZE_MB}MB")

    with open(file_path, "wb") as f:
        f.write(content)

    logger.info(f"File saved: {file_path} ({len(content)} bytes)")

    # OCR / Text extraction
    ocr_result = ocr_service.extract_text(file_path, ext)
    extracted_text = ocr_result.get("text", "")

    # AI Metadata extraction
    metadata = await _extract_metadata_ai(extracted_text, document_type)

    # Store in DB
    doc = Document(
        vendor_id=vendor_id,
        tender_id=tender_id,
        file_name=filename,
        file_path=file_path,
        document_type=document_type,
        ocr_text=extracted_text,
        extracted_metadata=metadata,
        ocr_method=ocr_result.get("method", "unknown"),
        ocr_accuracy=ocr_result.get("accuracy_estimate", 0.0),
        file_size=len(content),
        vector_stored=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Store in Qdrant
    collection = "vendor_documents" if vendor_id else "tender_documents"
    vector_ok = await vector_service.store_document(
        collection=collection,
        doc_id=str(doc.id),
        text=extracted_text,
        metadata={
            "doc_id": doc.id,
            "tender_id": tender_id,
            "vendor_id": vendor_id,
            "document_type": document_type,
            "file_name": filename,
        }
    )
    doc.vector_stored = 1 if vector_ok else 0
    db.commit()

    db.add(AuditLog(
        tender_id=tender_id,
        user_id="system",
        action="DOCUMENT_UPLOADED",
        module="document",
        details={"file_name": filename, "doc_type": document_type, "size_bytes": len(content)},
    ))
    db.commit()

    preview = extracted_text

    return {
        "document_id": doc.id,
        "file_name": filename,
        "document_type": document_type,
        "file_size_bytes": len(content),
        "ocr_text_preview": preview,
        "ocr_method": doc.ocr_method,
        "accuracy_estimate": doc.ocr_accuracy,
        "total_chars_extracted": len(extracted_text),
        "metadata": metadata,
        "vector_stored": vector_ok,
        "processed_at": doc.created_at,
    }


@router.post("/extract", summary="Extract structured metadata from tender document")
async def extract_metadata(payload: dict, db: Session = Depends(get_db)):
    """
    **Module 4: Tender Metadata Extraction**
    
    Extracts:
    - Tender Number, Name, Category, Department
    - Submission Date, Eligibility Criteria
    - Evaluation Parameters
    """
    doc_id = payload.get("document_id")
    if not doc_id:
        raise HTTPException(status_code=400, detail="document_id required")

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    metadata = await _extract_metadata_ai(doc.ocr_text or "", "TENDER")
    doc.extracted_metadata = metadata
    db.commit()

    return {
        "document_id": doc.id,
        "file_name": doc.file_name,
        **metadata,
        "extracted_at": datetime.utcnow(),
    }


@router.get("/{doc_id}", summary="Get document details")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "file_name": doc.file_name,
        "document_type": doc.document_type,
        "ocr_method": doc.ocr_method,
        "ocr_accuracy": doc.ocr_accuracy,
        "text_length": len(doc.ocr_text or ""),
        "metadata": doc.extracted_metadata,
        "vector_stored": bool(doc.vector_stored),
        "created_at": doc.created_at,
    }


async def _extract_metadata_ai(text: str, doc_type: str) -> dict:
    if not text or len(text) < 50:
        return {"extraction_status": "insufficient_text"}

    system = "You are a document analysis expert for government procurement. Extract structured metadata."
    prompt = f"""Extract metadata from this {doc_type} document:
---
{text[:4000]}
---

Return JSON:
{{
  "tender_number": "e.g. MPSEDC/COE/2026/682 or null",
  "tender_name": "Full tender title or null",
  "category": "Works/Goods/Services or null",
  "department": "Issuing department or null",
  "submission_date": "DD/MM/YYYY or null",
  "budget_estimate": "INR amount or null",
  "eligibility_criteria": ["criterion 1", "criterion 2"],
  "evaluation_parameters": ["param 1", "param 2"],
  "contact_details": "email/phone or null",
  "key_dates": {{"pre_bid": "date", "submission": "date", "opening": "date"}}
}}"""

    response = await ai_service.generate(prompt, system, max_tokens=1000)
    try:
        start = response.find("{")
        end = response.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end])
    except Exception:
        pass
    return {"raw_extraction": response[:500], "extraction_status": "partial"}
