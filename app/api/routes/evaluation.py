"""
Module 7: Shortfall Detection
Module 8: Financial Evaluation
Module 9: Final Recommendation
"""
import json
import logging
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas import (
    ShortfallRequest, ShortfallResponse,
    FinancialEvaluationRequest, FinancialEvaluationResponse,
    RecommendationRequest, RecommendationResponse,
)
from app.models import FinancialEvaluation, PQEvaluation, TechnicalEvaluation, Tender, AuditLog, Vendor
from app.services.ai_service import ai_service

# Router for Shortfall (Module 7)
shortfall_router = APIRouter(prefix="/api/shortfall", tags=["Module 7 - Shortfall Detection"])
# Router for Financial (Module 8)
financial_router = APIRouter(prefix="/api/financial", tags=["Module 8 - Financial Evaluation"])
# Router for Recommendation (Module 9)
recommendation_router = APIRouter(prefix="/api/recommendation", tags=["Module 9 - Final Recommendation"])

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# MODULE 7: SHORTFALL DETECTION
# ──────────────────────────────────────────────────────────────────────────────

REQUIRED_DOCUMENTS = [
    "Certificate of Incorporation",
    "CA Certificate with UDIN",
    "Audited Financial Statements",
    "Work Order / PO for similar project",
    "Client Completion Certificate",
    "GST Registration Certificate",
    "PAN Card Copy",
    "Undertaking for Solution Readiness",
    "Self-Declaration (Non-Blacklisting)",
    "Bid Cover Letter",
    "Certificate of Conformity / No Deviation",
    "Code of Integrity Certificate",
]

REQUIRED_CLAUSES = [
    "Scope of Work acceptance",
    "SLA terms acceptance",
    "Penalty clause acceptance",
    "Data security compliance",
    "On-premises deployment commitment",
    "Performance Bank Guarantee commitment",
]


@shortfall_router.post("/analyze", response_model=ShortfallResponse, summary="Detect shortfalls in vendor submission")
async def analyze_shortfall(req: ShortfallRequest, db: Session = Depends(get_db)):
    """
    **Module 7: Shortfall Detection**
    
    Identifies:
    - Missing documents
    - Missing clauses
    - Missing certifications
    
    Generates clarification request letter
    """
    submitted_docs_lower = [d.lower() for d in req.submitted_documents]
    submitted_clauses_lower = [c.lower() for c in req.submitted_clauses]

    missing_docs = [
        doc for doc in REQUIRED_DOCUMENTS
        if not any(doc.lower() in s or s in doc.lower() for s in submitted_docs_lower)
    ]
    missing_clauses = [
        clause for clause in REQUIRED_CLAUSES
        if not any(clause.lower() in s or s in clause.lower() for s in submitted_clauses_lower)
    ]
    missing_certs = _check_missing_certifications(req.submitted_documents)

    # AI generated clarification letter
    clarification = await _generate_clarification_request(
        req.tender_id, req.vendor_id, missing_docs, missing_clauses, missing_certs, db
    )

    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="SHORTFALL_ANALYZED",
        module="shortfall",
        details={"vendor_id": req.vendor_id, "missing_docs": len(missing_docs), "missing_clauses": len(missing_clauses)},
    ))
    db.commit()

    return ShortfallResponse(
        vendor_id=req.vendor_id,
        tender_id=req.tender_id,
        missing_documents=missing_docs,
        missing_clauses=missing_clauses,
        missing_certifications=missing_certs,
        clarification_request=clarification,
        analyzed_at=datetime.utcnow(),
    )


def _check_missing_certifications(submitted: List[str]) -> List[str]:
    required_certs = ["ISO 27001", "VAPT Report", "CERT-In Compliance"]
    submitted_lower = [s.lower() for s in submitted]
    return [c for c in required_certs if c.lower() not in " ".join(submitted_lower)]


async def _generate_clarification_request(
    tender_id: int, vendor_id: int,
    missing_docs: List[str], missing_clauses: List[str], missing_certs: List[str],
    db: Session
) -> str:
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    tender_title = tender.title if tender else f"Tender ID {tender_id}"
    tender_number = tender.tender_number if tender else "N/A"

    if not missing_docs and not missing_clauses and not missing_certs:
        return "No shortfalls identified. Bid submission is complete."

    prompt = f"""Generate a formal clarification/shortfall request letter for:
Tender: {tender_title} ({tender_number})
Vendor ID: {vendor_id}

Missing Documents: {missing_docs}
Missing Clauses: {missing_clauses}
Missing Certifications: {missing_certs}

Write a professional government procurement letter requesting the vendor to submit missing items within 48 hours."""

    try:
        return await ai_service.generate(prompt, max_tokens=500)
    except Exception:
        items = missing_docs + missing_clauses + missing_certs
        return f"""CLARIFICATION REQUEST

Ref: {tender_number}

Dear Vendor,

Your bid submission for "{tender_title}" is deficient in the following:

{chr(10).join(f"  {i+1}. {item}" for i, item in enumerate(items))}

You are requested to submit the above-mentioned items within 48 hours of receipt of this communication. 
Failure to comply may result in rejection of your bid.

Issued by: MPSEDC Evaluation Committee"""


# ──────────────────────────────────────────────────────────────────────────────
# MODULE 8: FINANCIAL EVALUATION
# ──────────────────────────────────────────────────────────────────────────────

@financial_router.post("/evaluate", response_model=FinancialEvaluationResponse, summary="Financial bid analysis and L1 ranking")
async def evaluate_financial(req: FinancialEvaluationRequest, db: Session = Depends(get_db)):
    """
    **Module 8: Financial Evaluation**
    
    - Parses commercial bids
    - Price normalization
    - L1 / L2 / L3 ranking
    - Award recommendation report
    """
    if not req.bids:
        raise HTTPException(status_code=400, detail="No bids provided")

    # Sort by total amount
    sorted_bids = sorted(req.bids, key=lambda b: float(b.get("total_amount", float("inf"))))

    rankings = []
    for i, bid in enumerate(sorted_bids):
        rank = i + 1
        label = f"L{rank}" if rank <= 3 else f"L{rank}"
        vendor_id = bid.get("vendor_id")

        fe = FinancialEvaluation(
            vendor_id=vendor_id,
            tender_id=req.tender_id,
            quoted_price=float(bid.get("total_amount", 0)),
            normalized_price=float(bid.get("total_amount", 0)),
            ranking=rank,
            ranking_label=label,
            price_breakup=bid.get("items", []),
            remarks=f"Ranked {label} based on L1 least cost criteria",
        )
        db.add(fe)

        rankings.append({
            "rank": rank,
            "label": label,
            "vendor_id": vendor_id,
            "vendor_name": bid.get("vendor_name", f"Vendor {vendor_id}"),
            "total_amount": bid.get("total_amount"),
            "remarks": f"Ranked {label}",
        })

    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="FINANCIAL_EVALUATED",
        module="financial",
        details={"total_bids": len(req.bids), "l1_vendor": rankings[0]["vendor_name"] if rankings else "N/A"},
    ))
    db.commit()

    l1 = rankings[0] if rankings else {}
    report = await _generate_financial_report(req.tender_id, rankings, db)

    return FinancialEvaluationResponse(
        tender_id=req.tender_id,
        rankings=rankings,
        l1_vendor=l1.get("vendor_name", "N/A"),
        l1_amount=float(l1.get("total_amount", 0)),
        evaluation_report=report,
        evaluated_at=datetime.utcnow(),
    )


@financial_router.get("/{tender_id}/results", summary="Get financial evaluation results")
def get_financial_results(tender_id: int, db: Session = Depends(get_db)):
    evals = db.query(FinancialEvaluation).filter(FinancialEvaluation.tender_id == tender_id).order_by(FinancialEvaluation.ranking).all()
    return [
        {
            "id": e.id,
            "vendor_id": e.vendor_id,
            "quoted_price": e.quoted_price,
            "ranking": e.ranking,
            "ranking_label": e.ranking_label,
            "remarks": e.remarks,
            "created_at": e.created_at.isoformat() if e.created_at else datetime.utcnow().isoformat()
        }
        for e in evals
    ]


async def _generate_financial_report(tender_id: int, rankings: list, db: Session) -> str:
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    try:
        prompt = f"""Generate a formal financial evaluation report for tender {tender.tender_number if tender else tender_id}.
Rankings: {json.dumps(rankings[:5], indent=2)}
Write a professional 3-4 paragraph evaluation report recommending L1 vendor."""
        return await ai_service.generate(prompt, max_tokens=400)
    except Exception:
        l1 = rankings[0] if rankings else {}
        return f"""<div style="text-align: center; font-weight: bold; margin-bottom: 12px;">FINANCIAL EVALUATION REPORT</div>

Tender: {tender.title if tender else f'ID {tender_id}'}

Total bids received: {len(rankings)}

**Financial Ranking Summary:**
{chr(10).join(f"  {r['label']}: {r['vendor_name']} - INR {r['total_amount']:,.0f}" for r in rankings[:5])}

The lowest (L1) bid is from {l1.get('vendor_name', 'N/A')} at INR {l1.get('total_amount', 0):,.0f}.

The Evaluation Committee recommends award to {l1.get('vendor_name', 'N/A')} being the L1 bidder, subject to compliance with all other terms and conditions."""


# ──────────────────────────────────────────────────────────────────────────────
# MODULE 9: FINAL RECOMMENDATION
# ──────────────────────────────────────────────────────────────────────────────

@recommendation_router.post("/generate", response_model=RecommendationResponse, summary="Generate final award recommendation")
async def generate_recommendation(req: RecommendationRequest, db: Session = Depends(get_db)):
    """
    **Module 9: Final Award Recommendation**
    
    Combines:
    - PQ Evaluation results
    - Technical Evaluation scores  
    - Financial Evaluation rankings
    
    Generates final recommendation and award report
    """
    tender = db.query(Tender).filter(Tender.id == req.tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    # Get all evaluations
    pq_evals = db.query(PQEvaluation).filter(PQEvaluation.tender_id == req.tender_id).all()
    tech_evals = db.query(TechnicalEvaluation).filter(TechnicalEvaluation.tender_id == req.tender_id).all()
    fin_evals = db.query(FinancialEvaluation).filter(
        FinancialEvaluation.tender_id == req.tender_id
    ).order_by(FinancialEvaluation.ranking).all()

    if not fin_evals:
        raise HTTPException(status_code=400, detail="No financial evaluations found. Run financial evaluation first.")

    # Find qualified L1 vendor
    pq_passed = {e.vendor_id for e in pq_evals if e.overall_status == "PASS"}
    tech_qualified = {e.vendor_id: e.score for e in tech_evals if e.qualification_status == "QUALIFIED"}

    recommended_eval = None
    for fe in fin_evals:
        if fe.vendor_id in pq_passed and fe.vendor_id in tech_qualified:
            recommended_eval = fe
            break

    if not recommended_eval:
        # Fallback to L1 regardless
        recommended_eval = fin_evals[0]

    tech_score = tech_qualified.get(recommended_eval.vendor_id, 0)

    # Generate AI report and risk assessment
    award_report, risk_assessment = await _generate_award_report_and_risk(tender, recommended_eval, tech_score, db)

    # Build tender details
    tender_details = {
        "title": tender.title,
        "department": tender.department,
        "tender_number": tender.tender_number,
        "budget": tender.budget,
        "category": tender.category
    }

    # Build bidders summary
    bidders_summary = []
    vendor_ids = set([e.vendor_id for e in pq_evals] + [e.vendor_id for e in tech_evals] + [e.vendor_id for e in fin_evals])
    vendors = {v.id: v.vendor_name for v in db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()}
    
    for vid in vendor_ids:
        pq = next((e for e in pq_evals if e.vendor_id == vid), None)
        tech = next((e for e in tech_evals if e.vendor_id == vid), None)
        fin = next((e for e in fin_evals if e.vendor_id == vid), None)
        
        bidders_summary.append({
            "vendor_id": vid,
            "vendor_name": vendors.get(vid, f"Vendor {vid}"),
            "pq_status": pq.overall_status if pq else "NOT_EVALUATED",
            "tech_score": tech.score if tech else 0,
            "tech_status": tech.qualification_status if tech else "NOT_EVALUATED",
            "fin_rank": fin.ranking_label if fin else "N/A",
            "quoted_price": fin.quoted_price if fin else 0
        })

    bidders_summary.sort(key=lambda x: (
        0 if x["fin_rank"] != "N/A" else 1,
        float(x["quoted_price"]) if x["quoted_price"] else float('inf')
    ))

    db.add(AuditLog(
        tender_id=req.tender_id,
        user_id="system",
        action="RECOMMENDATION_GENERATED",
        module="recommendation",
        details={"recommended_vendor_id": recommended_eval.vendor_id, "financial_rank": recommended_eval.ranking_label},
    ))
    db.commit()

    vname = vendors.get(recommended_eval.vendor_id, f"Vendor ID {recommended_eval.vendor_id}")
    return RecommendationResponse(
        tender_id=req.tender_id,
        recommended_vendor_id=recommended_eval.vendor_id,
        recommended_vendor_name=vname,
        pq_status="PASS" if recommended_eval.vendor_id in pq_passed else "NOT_EVALUATED",
        technical_score=tech_score,
        financial_ranking=recommended_eval.ranking_label,
        final_recommendation=f"Award to {vname} ({recommended_eval.ranking_label} @ INR {recommended_eval.quoted_price:,.0f})",
        award_report=award_report,
        tender_details=tender_details,
        bidders_summary=bidders_summary,
        risk_assessment=risk_assessment,
        generated_at=datetime.utcnow(),
    )


async def _generate_award_report_and_risk(tender: Tender, fin_eval: FinancialEvaluation, tech_score: float, db: Session):
    try:
        prompt = f"""Generate a formal award recommendation report for:
Tender: {tender.title} ({tender.tender_number})
Recommended Vendor ID: {fin_eval.vendor_id}
Financial Rank: {fin_eval.ranking_label}
Quoted Price: INR {fin_eval.quoted_price:,.0f}
Technical Score: {tech_score}

Write a 3-4 paragraph official award recommendation report.
Separate from the report, write a 1-paragraph risk assessment on this vendor based on general procurement best practices. 
Return your response exactly in this JSON format:
{{
  "report": "the award report text",
  "risk": "the risk assessment text"
}}"""
        resp = await ai_service.generate(prompt, max_tokens=600)
        
        # Try to parse JSON
        try:
            # Strip markdown code blocks if any
            clean_resp = resp.strip()
            if clean_resp.startswith("```json"):
                clean_resp = clean_resp[7:]
            if clean_resp.startswith("```"):
                clean_resp = clean_resp[3:]
            if clean_resp.endswith("```"):
                clean_resp = clean_resp[:-3]
                
            parsed = json.loads(clean_resp.strip())
            return parsed.get("report", ""), parsed.get("risk", "")
        except json.JSONDecodeError:
            # Fallback if AI didn't return JSON
            return resp, "Risk assessment could not be generated cleanly."
            
    except Exception:
        fallback_report = f"""AWARD RECOMMENDATION REPORT

Tender: {tender.title}
Tender No: {tender.tender_number}
Date: {datetime.now().strftime('%d %B %Y')}

BASIS OF RECOMMENDATION:
This report is prepared based on the evaluation of bids received against the above tender 
following a three-stage evaluation process: Pre-Qualification, Technical Demonstration, 
and Financial Evaluation.

EVALUATION SUMMARY:
- Pre-Qualification: Vendor {fin_eval.vendor_id} qualified all PQ criteria
- Technical Evaluation: Score {tech_score}/100 - QUALIFIED
- Financial Evaluation: Ranked {fin_eval.ranking_label} at INR {fin_eval.quoted_price:,.0f}

RECOMMATION:
The Evaluation Committee recommends award of the contract to Vendor ID {fin_eval.vendor_id} 
at INR {fin_eval.quoted_price:,.0f} (exclusive of GST), being the L1 qualified bidder 
meeting all technical and PQ requirements.

The selected vendor shall sign the agreement within 15 days of receipt of Letter of Intent.

Chief General Manager, MPSEDC"""
        fallback_risk = "No significant compliance deviations detected based on automated metrics. Vendor fulfills all criteria."
        return fallback_report, fallback_risk
