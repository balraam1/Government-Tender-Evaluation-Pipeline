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
from app.schemas import RFPGenerateRequest, RFPGenerateResponse, TenderResponse
from app.models import Tender, TenderStatus, AuditLog
from app.services.ai_service import ai_service

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
Additional Requirements: {req.additional_requirements or 'None'}

Generate the following sections in JSON format:
{{
  "scope_of_work": "Detailed scope covering all deliverables and activities",
  "eligibility_criteria": "PQ criteria including turnover, experience, certifications required",
  "sla_terms": "SLA requirements with uptime, response time, resolution time",
  "evaluation_criteria": "Technical and financial evaluation parameters with weightages",
  "deliverables": "List of all deliverables with timelines",
  "full_rfp": "Complete RFP document text"
}}

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
    ai_response = await ai_service.generate(prompt, system)
    
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
        "created_at": tender.created_at,
    }


def _parse_rfp_sections(ai_response: str, req: RFPGenerateRequest) -> dict:
    """Parse AI response, fallback to structured defaults if JSON fails"""
    try:
        # Try to extract JSON from response
        start = ai_response.find("{")
        end = ai_response.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(ai_response[start:end])
            return {
                "scope_of_work": data.get("scope_of_work", _default_scope(req)),
                "eligibility_criteria": data.get("eligibility_criteria", _default_eligibility()),
                "sla_terms": data.get("sla_terms", _default_sla()),
                "evaluation_criteria": data.get("evaluation_criteria", _default_eval_criteria()),
                "deliverables": data.get("deliverables", _default_deliverables()),
                "full_rfp": data.get("full_rfp", ai_response),
            }
    except Exception:
        pass
    
    # Fallback: use full AI response as RFP
    return {
        "scope_of_work": _default_scope(req),
        "eligibility_criteria": _default_eligibility(),
        "sla_terms": _default_sla(),
        "evaluation_criteria": _default_eval_criteria(),
        "deliverables": _default_deliverables(),
        "full_rfp": ai_response or _default_full_rfp(req),
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
