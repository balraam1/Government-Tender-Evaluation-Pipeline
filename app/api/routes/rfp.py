"""
Module 1: AI RFP Generator
POST /api/rfp/generate
POST /api/rfp/list
GET  /api/rfp/{tender_id}
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json
import logging

from app.core.database import get_db
from app.schemas import RFPGenerateRequest, RFPGenerateResponse, TenderResponse, RFPUpdateRequest
from app.models import Tender, TenderStatus, AuditLog
from app.services.ai_service import ai_service, AIUnavailableError
from app.services.vector_service import vector_service

router = APIRouter(prefix="/api/rfp", tags=["Module 1 - RFP Generation"])
logger = logging.getLogger(__name__)


def _build_rfp_prompt(req: RFPGenerateRequest) -> tuple[str, str]:
    system = """You are an expert government procurement officer for MPSEDC (Madhya Pradesh State Electronics Development Corporation).
You create formal, comprehensive RFP/tender documents compliant with Indian government procurement standards.
Always generate structured, professional content with clear sections."""

    prompt = f"""Generate a complete RFP document for the following tender:

Title: {req.title}
Category: {req.category}  
Department: {req.department}
Description: {req.description}
Estimated Budget: INR {req.budget or 'To be quoted'}
Selection Method: {req.selection_method}
Contract Type: {req.contract_type}
EMD Amount: INR {req.emd_amount}
PBG Percentage: {req.pbg_percentage}%
Contract Duration: {req.contract_duration}
Minimum Annual Turnover required: INR {req.min_turnover}
Minimum Years of Experience required: {req.min_experience}
Proposal Submission Deadline: {req.submission_deadline or 'TBD'}
Pre-Bid Meeting Date: {req.pre_bid_date or 'TBD'}
Additional Requirements: {req.additional_requirements or 'None'}

Generate the document in professional Markdown format.
You must include the following sections with exactly these headings:
## Scope of Work
## Eligibility Criteria
## Service Level Agreements
## Evaluation Criteria
## Deliverables & Timeline

Do not output JSON. Output the pure, complete Markdown RFP document directly.
Ensure compliance with MPSEDC standards and Government of Madhya Pradesh procurement guidelines."""
    return system, prompt


@router.post("/generate", response_model=RFPGenerateResponse, summary="Generate AI-assisted RFP")
async def generate_rfp(req: RFPGenerateRequest, db: Session = Depends(get_db)):
    """
    **Module 1: AI RFP Generator**
    
    Generates a complete RFP document using AI with:
    - Scope of Work
    - Eligibility Criteria  
    - SLA Terms
    - Evaluation Criteria
    - Deliverables
    """
    logger.info(f"Generating RFP for: {req.title}")
    
    # Generate AI content
    system, prompt = _build_rfp_prompt(req)
    try:
        ai_response = await ai_service.generate(prompt, system)
    except AIUnavailableError as e:
        raise HTTPException(
            status_code=503,
            detail=f"AI service unavailable. Cannot generate RFP. Please ensure Ollama is running or Gemini API key is configured. {e}"
        )
    
    # Parse AI response
    sections = _parse_rfp_sections(ai_response, req)
    
    # Generate tender number
    tender_number = f"MPSEDC/COE/{datetime.now().year}/{uuid.uuid4().hex[:6].upper()}"
    
    # Save to DB
    tender = Tender(
        tender_number=tender_number,
        title=req.title,
        category=req.category,
        department=req.department,
        description=req.description,
        budget=req.budget,
        scope_of_work=sections["scope_of_work"],
        eligibility_criteria=sections["eligibility_criteria"],
        sla_terms=sections["sla_terms"],
        evaluation_criteria=sections["evaluation_criteria"],
        deliverables=sections["deliverables"],
        generated_rfp=sections["full_rfp"],
        status=TenderStatus.DRAFT,
        min_turnover=req.min_turnover,
        min_experience=req.min_experience,
        emd_amount=req.emd_amount,
        pbg_percentage=req.pbg_percentage,
        contract_duration=req.contract_duration,
        selection_method=req.selection_method,
        contract_type=req.contract_type,
        pre_bid_date=datetime.fromisoformat(req.pre_bid_date.replace("Z", "+00:00")) if req.pre_bid_date else None,
        submission_deadline=datetime.fromisoformat(req.submission_deadline.replace("Z", "+00:00")) if req.submission_deadline else None,
        vector_stored=0
    )
    db.add(tender)
    
    # Audit log
    log = AuditLog(
        tender_id=None,
        user_id="system",
        action="RFP_GENERATED",
        module="rfp",
        details={"title": req.title, "category": req.category},
    )
    db.add(log)
    db.commit()
    db.refresh(tender)
    
    log.tender_id = tender.id
    db.commit()

    logger.info(f"RFP generated: {tender_number}")
    
    return RFPGenerateResponse(
        tender_id=tender.id,
        tender_number=tender_number,
        title=tender.title,
        category=tender.category,
        department=tender.department,
        description=tender.description,
        budget=tender.budget,
        scope_of_work=tender.scope_of_work,
        eligibility_criteria=tender.eligibility_criteria,
        sla_terms=tender.sla_terms,
        evaluation_criteria=tender.evaluation_criteria,
        deliverables=tender.deliverables,
        full_rfp_document=tender.generated_rfp,
        generated_at=tender.created_at,
    )


@router.get("/list", response_model=list[TenderResponse], summary="List all tenders")
def list_tenders(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    tenders = db.query(Tender).offset(skip).limit(limit).all()
    return tenders


@router.get("/{tender_id}", summary="Get tender details")
def get_tender(tender_id: int, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return {
        "id": tender.id,
        "tender_number": tender.tender_number,
        "title": tender.title,
        "category": tender.category,
        "department": tender.department,
        "description": tender.description,
        "budget": tender.budget,
        "status": tender.status,
        "scope_of_work": tender.scope_of_work,
        "eligibility_criteria": tender.eligibility_criteria,
        "sla_terms": tender.sla_terms,
        "evaluation_criteria": tender.evaluation_criteria,
        "deliverables": tender.deliverables,
        "generated_rfp": tender.generated_rfp,
        "min_turnover": tender.min_turnover,
        "min_experience": tender.min_experience,
        "emd_amount": tender.emd_amount,
        "pbg_percentage": tender.pbg_percentage,
        "contract_duration": tender.contract_duration,
        "selection_method": tender.selection_method,
        "contract_type": tender.contract_type,
        "pre_bid_date": tender.pre_bid_date,
        "vector_stored": bool(tender.vector_stored),
        "created_at": tender.created_at,
    }


@router.put("/{tender_id}", summary="Update generated RFP document")
async def update_rfp(tender_id: int, req: RFPUpdateRequest, db: Session = Depends(get_db)):
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
        
    tender.generated_rfp = req.full_rfp_document
    
    # Audit log
    log = AuditLog(
        tender_id=tender.id,
        user_id="system",
        action="RFP_UPDATED",
        module="rfp",
        details={"tender_id": tender.id},
    )
    db.add(log)
    db.commit()
    
    # HITL Vectorization: Store to Qdrant after human confirms changes
    try:
        success = await vector_service.store_document(
            collection="tender_documents",
            doc_id=f"TENDER_{tender.id}",
            text=tender.generated_rfp,
            metadata={"tender_id": tender.id, "document_type": "RFP"}
        )
        if success:
            tender.vector_stored = 1
            db.commit()
    except Exception as e:
        logger.error(f"Auto-vectorization failed: {e}")

    db.refresh(tender)
    
    return {"status": "success", "message": "RFP document updated successfully"}


def _parse_rfp_sections(ai_response: str, req: RFPGenerateRequest) -> dict:
    import re
    
    def extract_section(text: str, header: str) -> str:
        pattern = rf"(?i)##\s*{header}\s*\n(.*?)(?=\n##\s|$)"
        match = re.search(pattern, text, re.DOTALL)
        return match.group(1).strip() if match else ""

    scope = extract_section(ai_response, "Scope of Work") or _default_scope(req)
    eligibility = extract_section(ai_response, "Eligibility Criteria") or _default_eligibility()
    sla = extract_section(ai_response, "Service Level Agreements") or _default_sla()
    eval_crit = extract_section(ai_response, "Evaluation Criteria") or _default_eval_criteria()
    deliv = extract_section(ai_response, "Deliverables.*") or _default_deliverables()

    return {
        "scope_of_work": scope,
        "eligibility_criteria": eligibility,
        "sla_terms": sla,
        "evaluation_criteria": eval_crit,
        "deliverables": deliv,
        "full_rfp": ai_response,
    }


def _default_scope(req: RFPGenerateRequest) -> str:
    return f"""## Scope of Work

The selected agency shall provide, deploy, configure, and maintain:

1. **{req.title}** for {req.department}
2. Complete end-to-end implementation including:
   - Installation and commissioning at State Data Centre
   - Configuration as per department requirements  
   - Integration with existing systems
   - User training for all stakeholder groups
   - Ongoing support and maintenance during contract period

3. **Key Activities:**
   - Requirement gathering and solution design
   - Deployment and configuration
   - User Acceptance Testing (UAT)
   - Go-live support
   - Post-deployment maintenance

4. **Technology Requirements:**
   - On-premises deployment at State Data Centre
   - No external cloud dependency
   - Data residency within India"""


def _default_eligibility() -> str:
    return """## Eligibility / Pre-Qualification Criteria

1. **Legal Entity:** Registered in India, operational for at least 2 years
2. **Financial Turnover:** Minimum INR 50 Lakhs in FY 2024-25
3. **Technical Experience:** At least 1 similar project of INR 25 Lakhs in last 5 years
4. **PAN & GST:** Valid registrations required
5. **Blacklisting:** Not blacklisted by any Central/State Government
6. **Solution Readiness:** Production-ready COTS solution"""


def _default_sla() -> str:
    return """## Service Level Agreements

| Parameter | Requirement | Penalty |
|---|---|---|
| Platform Uptime | ≥ 99.5% during business hours | 0.5% per 0.5% drop |
| Response Time | ≤ 3 seconds | 0.5% per sustained breach |
| Critical Issue Resolution | ≤ 4 hours | ₹10,000/day |
| Major Issue Resolution | ≤ 8 hours | ₹5,000/day |
| Minor Issue Resolution | ≤ 24 hours | ₹2,000/day |
| OCR Accuracy | ≥ 95% | 0.5% per 2% deviation |
| AI Output Acceptance Rate | ≥ 90% | 0.5% per 5% deviation |"""


def _default_eval_criteria() -> str:
    return """## Evaluation Criteria

**Technical Evaluation (Demonstration Based):**
All 6 modules must qualify as PASS/FAIL:
1. Bid Preparation & RFP Authoring
2. Pre-Bid Query Management & Corrigendum
3. Pre-Qualification (PQ) Evaluation
4. Technical Evaluation & Compliance
5. Shortfall Identification & Clarification
6. Financial Evaluation & Report Generation

**Financial Evaluation:**
- L1 (Least Cost) basis
- Price inclusive of all taxes except GST"""


def _default_deliverables() -> str:
    return """## Deliverables & Timeline

| # | Deliverable | Timeline |
|---|---|---|
| 1 | Platform Deployment & Provisioning | Day 10 from WO |
| 2 | Document Pipeline Configuration | Day 10 from WO |
| 3 | Agentic Workflow Calibration | Day 10-15 from WO |
| 4 | Multi-Stage Evaluation Workflow | Day 10-15 from WO |
| 5 | Reporting & Audit Module | Day 15-20 from WO |
| 6 | Training & Documentation | Day 20-30 from WO |
| 7 | Go-Live & Acceptance | Day 30 from WO |"""


def _default_full_rfp(req: RFPGenerateRequest) -> str:
    return f"""# RFP for {req.title}

**Issuing Department:** {req.department}
**Category:** {req.category}
**Estimated Budget:** INR {req.budget or 'As quoted'}

{_default_scope(req)}

{_default_eligibility()}

{_default_sla()}

{_default_eval_criteria()}

{_default_deliverables()}"""
