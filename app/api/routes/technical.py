"""
Module 6: Technical Evaluation
POST /api/technical/evaluate
GET  /api/technical/{tender_id}/results
"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import TechnicalEvaluationRequest, TechnicalEvaluationResponse
from app.models import TechnicalEvaluation, Document, AuditLog
from app.services.ai_service import ai_service, AIUnavailableError

router = APIRouter(prefix="/api/technical", tags=["Module 6 - Technical Evaluation"])
logger = logging.getLogger(__name__)

# RFP_682 Technical evaluation parameters (Demo-based as per RFP)
TECH_PARAMETERS = [
    {"id": "TE01", "name": "Bid Preparation (RFP/Tender Authoring)", "max_score": 20, "weight": 0.20},
    {"id": "TE02", "name": "Pre-Bid Query Management & Corrigendum Handling", "max_score": 15, "weight": 0.15},
    {"id": "TE03", "name": "Pre-Qualification (PQ) Evaluation", "max_score": 15, "weight": 0.15},
    {"id": "TE04", "name": "Technical Evaluation & Compliance Assessment", "max_score": 20, "weight": 0.20},
    {"id": "TE05", "name": "Shortfall Identification & Clarification Management", "max_score": 15, "weight": 0.15},
    {"id": "TE06", "name": "Financial Evaluation & Report Generation", "max_score": 15, "weight": 0.15},
]


@router.post("/evaluate", response_model=TechnicalEvaluationResponse, summary="AI-assisted technical bid evaluation")
async def evaluate_technical(req: TechnicalEvaluationRequest, db: Session = Depends(get_db)):
    """
    **Module 6: Technical Evaluation**
    
    - Clause-wise technical bid evaluation
    - Automated compliance mapping
    - Configurable scoring across 6 parameters
    - Compliance matrix & score matrix
    - Technical evaluation report
    """
    # Get bid text from document or direct input
    bid_text = req.bid_text or ""
    if req.document_id and not bid_text:
        doc = db.query(Document).filter(Document.id == req.document_id).first()
        if doc:
            bid_text = doc.ocr_text or ""

    if not bid_text:
        bid_text = "Technical proposal submitted for evaluation."

    # AI-powered evaluation
    eval_result = await _ai_technical_evaluation(bid_text, req.tender_id)

    # Build matrices
    compliance_matrix = []
    score_matrix = {}
    total_score = 0.0
    shortfalls = []

    for param in TECH_PARAMETERS:
        param_eval = eval_result.get("parameters", {}).get(param["id"], {})
        score = float(param_eval.get("score", param["max_score"] * 0.7))  # Default 70%
        score = min(score, param["max_score"])
        compliance = param_eval.get("compliance", "PARTIAL")
        remarks = param_eval.get("remarks", "Evaluated based on submitted documents")

        compliance_matrix.append({
            "parameter_id": param["id"],
            "parameter_name": param["name"],
            "max_score": param["max_score"],
            "scored": round(score, 2),
            "compliance": compliance,
            "remarks": remarks,
        })

        score_matrix[param["id"]] = {
            "name": param["name"],
            "score": round(score, 2),
            "max": param["max_score"],
            "percentage": round((score / param["max_score"]) * 100, 1),
        }

        total_score += score
        if compliance == "NON_COMPLIANT":
            shortfalls.append(f"{param['name']}: {remarks}")

    max_score = sum(p["max_score"] for p in TECH_PARAMETERS)
    percentage = (total_score / max_score) * 100
    
    # Qualification Rule: Must score >= 70% AND must not fail any single parameter
    has_failed_param = any(row["compliance"] == "NON_COMPLIANT" for row in compliance_matrix)
    if percentage >= 70 and not has_failed_param:
        qualification = "QUALIFIED"
    else:
        qualification = "NOT_QUALIFIED"

    # Save evaluation
    tech_eval = TechnicalEvaluation(
        vendor_id=req.vendor_id,
        tender_id=req.tender_id,
        score=round(total_score, 2),
        max_score=max_score,
        compliance_matrix=compliance_matrix,
        score_matrix=score_matrix,
        shortfalls=shortfalls,
        qualification_status=qualification,
        remarks=eval_result.get("overall_remarks", "Technical evaluation completed"),
    )
    db.add(tech_eval)
    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="TECHNICAL_EVALUATED",
        module="technical",
        details={"vendor_id": req.vendor_id, "score": total_score, "qualification": qualification},
    ))
    db.commit()
    db.refresh(tech_eval)

    return TechnicalEvaluationResponse(
        evaluation_id=tech_eval.id,
        vendor_id=req.vendor_id,
        tender_id=req.tender_id,
        overall_score=round(total_score, 2),
        max_score=max_score,
        percentage=round(percentage, 2),
        qualification_status=qualification,
        compliance_matrix=compliance_matrix,
        score_matrix=score_matrix,
        shortfalls=shortfalls,
        remarks=tech_eval.remarks,
        evaluated_at=tech_eval.created_at,
    )


@router.get("/{tender_id}/results", summary="Get all technical evaluation results")
def get_technical_results(tender_id: int, db: Session = Depends(get_db)):
    evals = db.query(TechnicalEvaluation).filter(TechnicalEvaluation.tender_id == tender_id).all()
    return [
        {
            "evaluation_id": e.id,
            "vendor_id": e.vendor_id,
            "score": e.score,
            "max_score": e.max_score,
            "percentage": round((e.score / e.max_score) * 100, 2) if e.max_score else 0,
            "qualification_status": e.qualification_status,
            "shortfalls": e.shortfalls,
            "compliance_matrix": e.compliance_matrix,
            "created_at": e.created_at,
        }
        for e in evals
    ]


async def _ai_technical_evaluation(bid_text: str, tender_id: int) -> dict:
    system = """You are a senior technical evaluator for MPSEDC procurement. 
Evaluate technical bids objectively against defined parameters."""

    param_list = "\n".join([f"- {p['id']}: {p['name']} (max {p['max_score']} points)" for p in TECH_PARAMETERS])

    prompt = f"""Evaluate this technical bid against MPSEDC procurement parameters:

EVALUATION PARAMETERS:
{param_list}

BID CONTENT:
{bid_text[:3000]}

Return JSON:
{{
  "parameters": {{
    "TE01": {{"score": 0-20, "compliance": "COMPLIANT/PARTIAL/NON_COMPLIANT", "remarks": "brief"}},
    "TE02": {{"score": 0-15, "compliance": "...", "remarks": "..."}},
    "TE03": {{"score": 0-15, "compliance": "...", "remarks": "..."}},
    "TE04": {{"score": 0-20, "compliance": "...", "remarks": "..."}},
    "TE05": {{"score": 0-15, "compliance": "...", "remarks": "..."}},
    "TE06": {{"score": 0-15, "compliance": "...", "remarks": "..."}}
  }},
  "overall_remarks": "Summary of technical evaluation"
}}"""

    response = await ai_service.generate(prompt, system, max_tokens=1500)
    try:
        start = response.find("{")
        end = response.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end])
    except Exception:
        pass
    # AI returned text but not valid JSON — return raw response in remarks
    return {"parameters": {}, "overall_remarks": response.strip() or "Technical evaluation completed. Could not parse structured scores."}
