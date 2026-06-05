"""
Module 2: Pre-Bid Query Management
POST /api/prebid/analyze
GET  /api/prebid/{tender_id}/queries
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.core.database import get_db
from app.schemas import PreBidQueryRequest, PreBidQueryResponse
from app.models import PreBidQuery, Tender, AuditLog
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/prebid", tags=["Module 2 - Pre-Bid Query Management"])
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=PreBidQueryResponse, summary="Analyze and respond to pre-bid query")
async def analyze_prebid_query(req: PreBidQueryRequest, db: Session = Depends(get_db)):
    """
    **Module 2: Pre-Bid Query Management**
    
    - Analyzes vendor query against tender document
    - Identifies relevant clause
    - Drafts AI-assisted response
    - Generates corrigendum draft if needed
    """
    tender = db.query(Tender).filter(Tender.id == req.tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    rfp_context = tender.generated_rfp or f"Tender: {tender.title}\nCategory: {tender.category}"

    system = """You are a senior procurement officer at MPSEDC. 
Respond to pre-bid queries professionally, citing specific tender clauses.
Always provide clear, unambiguous responses compliant with procurement rules."""

    prompt = f"""Tender RFP Document:
---
{rfp_context[:3000]}
---

Vendor: {req.vendor_name}
Query: {req.query_text}

Respond in JSON:
{{
  "relevant_clause": "Exact clause or section from the RFP that addresses this query",
  "draft_response": "Official response to the vendor query (2-3 paragraphs, professional tone)",
  "requires_corrigendum": true/false,
  "corrigendum_draft": "Draft corrigendum text if clarification changes the tender (null if not needed)"
}}"""

    ai_response = await ai_service.generate(prompt, system, max_tokens=1500)
    parsed = _parse_prebid_response(ai_response, req)

    query_obj = PreBidQuery(
        tender_id=req.tender_id,
        vendor_name=req.vendor_name,
        query_text=req.query_text,
        relevant_clause=parsed["relevant_clause"],
        draft_response=parsed["draft_response"],
        corrigendum_draft=parsed.get("corrigendum_draft"),
        status="ANSWERED",
    )
    db.add(query_obj)

    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="PREBID_QUERY_ANALYZED",
        module="prebid",
        details={"vendor": req.vendor_name, "query_preview": req.query_text[:100]},
    ))
    db.commit()
    db.refresh(query_obj)

    return PreBidQueryResponse(
        query_id=query_obj.id,
        tender_id=req.tender_id,
        vendor_name=req.vendor_name,
        query_text=req.query_text,
        relevant_clause=query_obj.relevant_clause,
        draft_response=query_obj.draft_response,
        corrigendum_draft=query_obj.corrigendum_draft,
        analyzed_at=query_obj.created_at,
    )


@router.get("/{tender_id}/queries", summary="Get all pre-bid queries for a tender")
def get_prebid_queries(tender_id: int, db: Session = Depends(get_db)):
    queries = db.query(PreBidQuery).filter(PreBidQuery.tender_id == tender_id).all()
    return [
        {
            "id": q.id,
            "vendor_name": q.vendor_name,
            "query_text": q.query_text,
            "relevant_clause": q.relevant_clause,
            "draft_response": q.draft_response,
            "corrigendum_draft": q.corrigendum_draft,
            "status": q.status,
            "created_at": q.created_at,
        }
        for q in queries
    ]


def _parse_prebid_response(ai_response: str, req: PreBidQueryRequest) -> dict:
    import json
    try:
        start = ai_response.find("{")
        end = ai_response.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(ai_response[start:end])
    except Exception:
        pass
    return {
        "relevant_clause": "Section 3 - Pre-Qualification Criteria",
        "draft_response": f"Thank you for your query regarding '{req.query_text[:80]}...'. Please refer to the relevant section in the RFP document. For further clarification, please contact marketing@mpsedc.com.",
        "corrigendum_draft": None,
    }
