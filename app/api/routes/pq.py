"""
Module 5: PQ Evaluation
POST /api/pq/evaluate
GET  /api/pq/{tender_id}/results
"""
import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import PQEvaluationRequest, PQEvaluationResponse
from app.models import PQEvaluation, Vendor, Tender, AuditLog
from app.services.ai_service import ai_service

router = APIRouter(prefix="/api/pq", tags=["Module 5 - PQ Evaluation"])
logger = logging.getLogger(__name__)

# PQ thresholds aligned with RFP_682
PQ_RULES = {
    "min_turnover_lakhs": 50,          # INR 50 Lakhs
    "min_experience_years": 2,
    "min_project_value_lakhs": 25,     # INR 25 Lakhs
    "require_gst": True,
    "require_pan": True,
}


@router.post("/evaluate", response_model=PQEvaluationResponse, summary="Evaluate vendor PQ eligibility")
async def evaluate_pq(req: PQEvaluationRequest, db: Session = Depends(get_db)):
    """
    **Module 5: Pre-Qualification Evaluation**
    
    Checks:
    - Annual Turnover (min INR 50 Lakhs)
    - Years of Experience (min 2 years)
    - GST Registration
    - PAN Registration  
    - Similar project experience (min INR 25 Lakhs)
    - Certifications
    
    Returns: PASS / FAIL with shortfall report
    """
    # Rule-based checks
    results = _run_pq_checks(req)
    shortfalls = [item for item in results["checks"] if item["status"] == "FAIL"]
    overall = "PASS" if not shortfalls else "FAIL"

    # AI enhanced remarks
    ai_remarks = await _get_ai_pq_remarks(req, results, overall)

    # Save evaluation
    pq_eval = PQEvaluation(
        vendor_id=req.vendor_id,
        tender_id=req.tender_id,
        turnover_status=results["turnover_status"],
        experience_status=results["experience_status"],
        gst_status=results["gst_status"],
        pan_status=results["pan_status"],
        certifications_status=results["certifications_status"],
        overall_status=overall,
        shortfall_report=shortfalls,
        remarks=ai_remarks,
    )
    db.add(pq_eval)
    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="PQ_EVALUATED",
        module="pq",
        details={"vendor_id": req.vendor_id, "overall_status": overall, "shortfalls": len(shortfalls)},
    ))
    db.commit()
    db.refresh(pq_eval)

    return PQEvaluationResponse(
        evaluation_id=pq_eval.id,
        vendor_id=req.vendor_id,
        tender_id=req.tender_id,
        turnover_status=pq_eval.turnover_status,
        experience_status=pq_eval.experience_status,
        gst_status=pq_eval.gst_status,
        pan_status=pq_eval.pan_status,
        certifications_status=pq_eval.certifications_status,
        overall_status=overall,
        shortfall_report=shortfalls,
        remarks=ai_remarks,
        evaluated_at=pq_eval.created_at,
    )


@router.get("/{tender_id}/results", summary="Get all PQ evaluation results for tender")
def get_pq_results(tender_id: int, db: Session = Depends(get_db)):
    evals = db.query(PQEvaluation).filter(PQEvaluation.tender_id == tender_id).all()
    return [
        {
            "evaluation_id": e.id,
            "vendor_id": e.vendor_id,
            "turnover_status": e.turnover_status,
            "experience_status": e.experience_status,
            "gst_status": e.gst_status,
            "pan_status": e.pan_status,
            "certifications_status": e.certifications_status,
            "overall_status": e.overall_status,
            "shortfall_report": e.shortfall_report,
            "remarks": e.remarks,
            "created_at": e.created_at,
        }
        for e in evals
    ]


def _run_pq_checks(req: PQEvaluationRequest) -> dict:
    checks = []
    turnover_lakhs = (req.annual_turnover or 0) / 100000

    # Turnover check
    turnover_ok = turnover_lakhs >= PQ_RULES["min_turnover_lakhs"]
    checks.append({
        "criterion": "Annual Turnover",
        "required": f"≥ INR {PQ_RULES['min_turnover_lakhs']} Lakhs",
        "submitted": f"INR {turnover_lakhs:.2f} Lakhs",
        "status": "PASS" if turnover_ok else "FAIL",
        "shortfall": None if turnover_ok else f"Short by INR {PQ_RULES['min_turnover_lakhs'] - turnover_lakhs:.2f} Lakhs",
    })

    # Experience check
    exp_ok = (req.years_experience or 0) >= PQ_RULES["min_experience_years"]
    checks.append({
        "criterion": "Years of Operation",
        "required": f"≥ {PQ_RULES['min_experience_years']} years",
        "submitted": f"{req.years_experience} years",
        "status": "PASS" if exp_ok else "FAIL",
        "shortfall": None if exp_ok else f"Need {PQ_RULES['min_experience_years']} years, provided {req.years_experience}",
    })

    # GST check
    gst_ok = req.has_gst
    checks.append({
        "criterion": "GST Registration",
        "required": "Valid GST certificate",
        "submitted": "Provided" if gst_ok else "Not provided",
        "status": "PASS" if gst_ok else "FAIL",
        "shortfall": None if gst_ok else "GST registration certificate missing",
    })

    # PAN check
    pan_ok = req.has_pan
    checks.append({
        "criterion": "PAN Registration",
        "required": "Valid PAN card",
        "submitted": "Provided" if pan_ok else "Not provided",
        "status": "PASS" if pan_ok else "FAIL",
        "shortfall": None if pan_ok else "PAN card copy missing",
    })

    # Similar project check
    project_lakhs = (req.similar_project_value or 0) / 100000
    proj_ok = project_lakhs >= PQ_RULES["min_project_value_lakhs"]
    checks.append({
        "criterion": "Similar Project Experience",
        "required": f"≥ INR {PQ_RULES['min_project_value_lakhs']} Lakhs (last 5 years)",
        "submitted": f"INR {project_lakhs:.2f} Lakhs",
        "status": "PASS" if proj_ok else "FAIL",
        "shortfall": None if proj_ok else f"Project value short by INR {PQ_RULES['min_project_value_lakhs'] - project_lakhs:.2f} Lakhs",
    })

    # Certifications
    cert_ok = True  # Optional but noted
    checks.append({
        "criterion": "Certifications",
        "required": "Relevant certifications (ISO 27001 preferred)",
        "submitted": ", ".join(req.certifications) if req.certifications else "None provided",
        "status": "PASS",  # Not mandatory per RFP_682
        "shortfall": None,
    })

    return {
        "checks": checks,
        "turnover_status": "PASS" if turnover_ok else "FAIL",
        "experience_status": "PASS" if exp_ok else "FAIL",
        "gst_status": "PASS" if gst_ok else "FAIL",
        "pan_status": "PASS" if pan_ok else "FAIL",
        "certifications_status": "PASS" if cert_ok else "FAIL",
    }


async def _get_ai_pq_remarks(req: PQEvaluationRequest, results: dict, overall: str) -> str:
    prompt = f"""Generate a professional PQ evaluation remark for:
Overall Status: {overall}
Checks: {json.dumps(results['checks'], indent=2)[:1000]}

Write 2-3 sentences summarizing the evaluation outcome professionally."""
    try:
        return await ai_service.generate(prompt, max_tokens=200)
    except Exception:
        if overall == "PASS":
            return "Vendor meets all pre-qualification criteria. Eligible for technical evaluation stage."
        else:
            fails = [c["criterion"] for c in results["checks"] if c["status"] == "FAIL"]
            return f"Vendor does not meet PQ criteria for: {', '.join(fails)}. Not eligible for further evaluation."
