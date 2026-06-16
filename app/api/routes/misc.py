"""
Audit Trail, Vendor Management, Health Check & Dashboard Stats
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models import AuditLog, Vendor, Tender, PQEvaluation, TechnicalEvaluation, FinancialEvaluation

audit_router = APIRouter(prefix="/api/audit", tags=["Audit Trail"])
vendor_router = APIRouter(prefix="/api/vendor", tags=["Vendor Management"])
health_router = APIRouter(prefix="/api", tags=["Health"])


# ─── Health ──────────────────────────────────────────────────────────────────

@health_router.get("/health", summary="Health check")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(db.bind.text("SELECT 1") if hasattr(db.bind, 'text') else __import__('sqlalchemy').text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "healthy",
        "app": "MPSEDC GenAI Procurement Platform",
        "version": "1.0.0",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
        "modules": [
            "rfp_generation", "prebid_query", "document_processing",
            "metadata_extraction", "pq_evaluation", "technical_evaluation",
            "shortfall_detection", "financial_evaluation", "recommendation"
        ]
    }


# ─── Audit ────────────────────────────────────────────────────────────────────

@audit_router.get("/logs", summary="Get audit logs")
def get_audit_logs(
    tender_id: int = None, module: str = None,
    skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog)
    if tender_id:
        query = query.filter(AuditLog.tender_id == tender_id)
    if module:
        query = query.filter(AuditLog.module == module)
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": l.id,
            "tender_id": l.tender_id,
            "user_id": l.user_id,
            "action": l.action,
            "module": l.module,
            "details": l.details,
            "created_at": l.created_at,
        }
        for l in logs
    ]


@audit_router.get("/summary", summary="Audit summary dashboard")
def audit_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    total_tenders = db.query(Tender).count()
    total_vendors = db.query(Vendor).count()
    total_logs = db.query(AuditLog).count()
    recent_actions = (
        db.query(AuditLog.action, func.count(AuditLog.id).label("count"))
        .group_by(AuditLog.action)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
        .all()
    )
    return {
        "total_tenders": total_tenders,
        "total_vendors": total_vendors,
        "total_audit_events": total_logs,
        "actions_summary": [{"action": a.action, "count": a.count} for a in recent_actions],
        "generated_at": datetime.utcnow(),
    }


# ─── Vendor ───────────────────────────────────────────────────────────────────

@vendor_router.post("/register", summary="Register a vendor")
def register_vendor(payload: dict, db: Session = Depends(get_db)):
    vendor = Vendor(
        vendor_name=payload.get("vendor_name", "Unknown"),
        gst_number=payload.get("gst_number"),
        pan_number=payload.get("pan_number"),
        email=payload.get("email"),
        phone=payload.get("phone"),
        address=payload.get("address"),
        annual_turnover=payload.get("annual_turnover"),
        years_of_experience=payload.get("years_of_experience"),
        certifications=payload.get("certifications", []),
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    db.add(AuditLog(
        tender_id=None,
        user_id="system",
        action="VENDOR_REGISTERED",
        module="vendor",
        details={"vendor_id": vendor.id, "vendor_name": vendor.vendor_name},
    ))
    db.commit()
    return {"vendor_id": vendor.id, "vendor_name": vendor.vendor_name, "created_at": vendor.created_at}


@vendor_router.get("/list", summary="List all vendors")
def list_vendors(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    vendors = db.query(Vendor).offset(skip).limit(limit).all()
    return [
        {"id": v.id, "vendor_name": v.vendor_name, "gst": v.gst_number, "pan": v.pan_number, "created_at": v.created_at}
        for v in vendors
    ]


@vendor_router.get("/{vendor_id}", summary="Get vendor details")
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return {
        "id": vendor.id,
        "vendor_name": vendor.vendor_name,
        "gst_number": vendor.gst_number,
        "pan_number": vendor.pan_number,
        "email": vendor.email,
        "annual_turnover": vendor.annual_turnover,
        "years_of_experience": vendor.years_of_experience,
        "certifications": vendor.certifications,
        "created_at": vendor.created_at,
    }


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

dashboard_router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@dashboard_router.get("/stats", summary="Aggregated stats for dashboard charts")
def dashboard_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func

    # 1. Procurement Pipeline Funnel
    total_vendors  = db.query(Vendor).count()
    pq_passed      = db.query(PQEvaluation).filter(PQEvaluation.overall_status == "PASS").count()
    tech_qualified = db.query(TechnicalEvaluation).filter(
        TechnicalEvaluation.qualification_status == "QUALIFIED"
    ).count()
    fin_ranked = db.query(FinancialEvaluation).count()
    l1_awarded = db.query(FinancialEvaluation).filter(FinancialEvaluation.ranking == 1).count()

    pipeline_funnel = [
        {"stage": "Registered Vendors", "count": total_vendors},
        {"stage": "PQ Passed",          "count": pq_passed},
        {"stage": "Tech Qualified",     "count": tech_qualified},
        {"stage": "Fin. Evaluated",     "count": fin_ranked},
        {"stage": "L1 Awarded",         "count": l1_awarded},
    ]

    # 2. Budget vs. Quoted Price
    tenders = db.query(Tender).filter(Tender.budget.isnot(None)).limit(8).all()
    budget_vs_quoted = []
    for t in tenders:
        l1 = db.query(FinancialEvaluation).filter(
            FinancialEvaluation.tender_id == t.id,
            FinancialEvaluation.ranking == 1
        ).first()
        budget_vs_quoted.append({
            "tender_number": t.tender_number,
            "title": t.title or "",
            "budget": float(t.budget or 0),
            "quoted": float(l1.quoted_price if l1 else 0),
        })

    # 3. Vendor Leaderboard
    vendors = db.query(Vendor).limit(6).all()
    leaderboard = []
    for v in vendors:
        pq  = db.query(PQEvaluation).filter(PQEvaluation.vendor_id == v.id)\
                 .order_by(PQEvaluation.created_at.desc()).first()
        tec = db.query(TechnicalEvaluation).filter(TechnicalEvaluation.vendor_id == v.id)\
                 .order_by(TechnicalEvaluation.created_at.desc()).first()
        fin = db.query(FinancialEvaluation).filter(FinancialEvaluation.vendor_id == v.id)\
                 .order_by(FinancialEvaluation.created_at.desc()).first()
        leaderboard.append({
            "vendor_id":   v.id,
            "vendor_name": v.vendor_name,
            "pq_status":   pq.overall_status if pq else "NOT_EVALUATED",
            "tech_score":  float(tec.score) if tec and tec.score is not None else None,
            "fin_rank":    fin.ranking_label if fin else None,
        })
    leaderboard.sort(key=lambda x: (x["tech_score"] or -1), reverse=True)

    # 4. Module Activity Heatmap (last 30 days)
    since = datetime.utcnow() - timedelta(days=29)
    logs  = db.query(
        AuditLog.module,
        func.date(AuditLog.created_at).label("day"),
        func.count(AuditLog.id).label("count")
    ).filter(AuditLog.created_at >= since).group_by(
        AuditLog.module, func.date(AuditLog.created_at)
    ).all()

    heatmap = [
        {"module": l.module, "day": str(l.day), "count": l.count}
        for l in logs
    ]

    return {
        "pipeline_funnel":  pipeline_funnel,
        "budget_vs_quoted": budget_vs_quoted,
        "leaderboard":      leaderboard,
        "heatmap":          heatmap,
        "generated_at":     datetime.utcnow().isoformat(),
    }
