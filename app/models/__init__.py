from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class TenderStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    PRE_BID = "PRE_BID"
    SUBMITTED = "SUBMITTED"
    EVALUATION = "EVALUATION"
    AWARDED = "AWARDED"
    CANCELLED = "CANCELLED"


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    tender_number = Column(String(100), unique=True, index=True)
    title = Column(String(500), nullable=False)
    category = Column(String(100))  # Works / Goods / Services
    department = Column(String(200))
    description = Column(Text)
    budget = Column(Float)
    generated_rfp = Column(Text)
    scope_of_work = Column(Text)
    eligibility_criteria = Column(Text)
    sla_terms = Column(Text)
    evaluation_criteria = Column(Text)
    deliverables = Column(Text)
    status = Column(Enum(TenderStatus), default=TenderStatus.DRAFT)
    submission_deadline = Column(DateTime)
    min_turnover = Column(Float, default=0.0)
    min_experience = Column(Integer, default=0)
    emd_amount = Column(Float, default=0.0)
    pbg_percentage = Column(Float, default=0.0)
    contract_duration = Column(String(100))
    selection_method = Column(String(100))
    contract_type = Column(String(100))
    pre_bid_date = Column(DateTime)
    vector_stored = Column(Integer, default=0)
    version = Column(Integer, default=1)
    is_deleted = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    vendors = relationship("Vendor", secondary="tender_vendors", back_populates="tenders")
    documents = relationship("Document", back_populates="tender")
    pre_bid_queries = relationship("PreBidQuery", back_populates="tender")


class TenderVendor(Base):
    __tablename__ = "tender_vendors"
    tender_id = Column(Integer, ForeignKey("tenders.id"), primary_key=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), primary_key=True)


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    vendor_name = Column(String(300), nullable=False)
    gst_number = Column(String(20), unique=True, index=True)
    pan_number = Column(String(20), unique=True, index=True)
    email = Column(String(200))
    phone = Column(String(20))
    address = Column(Text)
    annual_turnover = Column(Float)
    years_of_experience = Column(Integer)
    certifications = Column(JSON)
    created_at = Column(DateTime, default=func.now())

    tenders = relationship("Tender", secondary="tender_vendors", back_populates="vendors")
    documents = relationship("Document", back_populates="vendor")
    pq_evaluations = relationship("PQEvaluation", back_populates="vendor")
    technical_evaluations = relationship("TechnicalEvaluation", back_populates="vendor")
    financial_evaluations = relationship("FinancialEvaluation", back_populates="vendor")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=True)
    file_name = Column(String(500))
    file_path = Column(String(1000))
    document_type = Column(String(100))  # RFP, NIT, TECHNICAL_BID, PQ_DOC, FINANCIAL_BID
    ocr_text = Column(Text)
    extracted_metadata = Column(JSON)
    ocr_method = Column(String(50))
    ocr_accuracy = Column(Float)
    vector_stored = Column(Integer, default=0)
    file_size = Column(Integer)
    status = Column(String(50), default="PENDING")
    confidence_scores = Column(JSON)
    created_at = Column(DateTime, default=func.now())

    vendor = relationship("Vendor", back_populates="documents")
    tender = relationship("Tender", back_populates="documents")


class PreBidQuery(Base):
    __tablename__ = "pre_bid_queries"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    vendor_name = Column(String(300))
    query_text = Column(Text)
    relevant_clause = Column(Text)
    draft_response = Column(Text)
    corrigendum_draft = Column(Text)
    status = Column(String(50), default="PENDING")  # PENDING, ANSWERED, ESCALATED
    created_at = Column(DateTime, default=func.now())

    tender = relationship("Tender", back_populates="pre_bid_queries")


class PQEvaluation(Base):
    __tablename__ = "pq_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    turnover_status = Column(String(20))   # PASS / FAIL
    experience_status = Column(String(20))
    gst_status = Column(String(20))
    pan_status = Column(String(20))
    certifications_status = Column(String(20))
    overall_status = Column(String(20))    # PASS / FAIL
    shortfall_report = Column(JSON)
    remarks = Column(Text)
    evaluator_override = Column(String(20))
    created_at = Column(DateTime, default=func.now())

    vendor = relationship("Vendor", back_populates="pq_evaluations")


class TechnicalEvaluation(Base):
    __tablename__ = "technical_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    score = Column(Float)
    max_score = Column(Float, default=100.0)
    compliance_matrix = Column(JSON)
    score_matrix = Column(JSON)
    remarks = Column(Text)
    shortfalls = Column(JSON)
    qualification_status = Column(String(20))  # QUALIFIED / NOT_QUALIFIED / CONDITIONAL
    evaluator_annotations = Column(JSON)
    created_at = Column(DateTime, default=func.now())

    vendor = relationship("Vendor", back_populates="technical_evaluations")


class FinancialEvaluation(Base):
    __tablename__ = "financial_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    quoted_price = Column(Float)
    normalized_price = Column(Float)
    ranking = Column(Integer)  # 1=L1, 2=L2, 3=L3
    ranking_label = Column(String(10))  # L1, L2, L3
    price_breakup = Column(JSON)
    remarks = Column(Text)
    created_at = Column(DateTime, default=func.now())

    vendor = relationship("Vendor", back_populates="financial_evaluations")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"))
    recommended_vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    award_report = Column(Text)
    bidders_summary = Column(JSON)
    risk_assessment = Column(JSON)
    created_at = Column(DateTime, default=func.now())

    tender = relationship("Tender")
    recommended_vendor = relationship("Vendor")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=True)
    user_id = Column(String(100))
    action = Column(String(200))
    module = Column(String(100))
    details = Column(JSON)
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=func.now())


class ShortfallRecord(Base):
    """Stores AI-generated shortfall clarification letter for each vendor/tender analysis."""
    __tablename__ = "shortfall_records"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=True)
    missing_documents = Column(JSON)
    missing_clauses = Column(JSON)
    missing_certifications = Column(JSON)
    clarification_letter = Column(Text)   # Full AI-generated letter text
    created_at = Column(DateTime, default=func.now())

    tender = relationship("Tender")
    vendor = relationship("Vendor")


class FinancialReport(Base):
    """Stores the AI-generated financial evaluation report paragraph per tender."""
    __tablename__ = "financial_reports"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    report_text = Column(Text)            # Full AI-generated report
    l1_vendor_name = Column(String(300))
    l1_amount = Column(Float)
    total_bids = Column(Integer)
    created_at = Column(DateTime, default=func.now())

    tender = relationship("Tender")


class PreBidReport(Base):
    """Stores the AI-generated comprehensive pre-bid queries export report per tender."""
    __tablename__ = "prebid_reports"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False)
    report_markdown = Column(Text)        # Full AI Markdown report
    query_count = Column(Integer)
    created_at = Column(DateTime, default=func.now())

    tender = relationship("Tender")

