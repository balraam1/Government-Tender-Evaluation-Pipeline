from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ─── RFP / Tender Schemas ───────────────────────────────────────────────────

class RFPGenerateRequest(BaseModel):
    title: str = Field(..., description="Tender title")
    category: str = Field(..., description="Works / Goods / Services")
    department: str = Field(..., description="Issuing department")
    description: str = Field(..., description="Brief description of requirement")
    budget: Optional[float] = Field(None, description="Estimated budget in INR")
    additional_requirements: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Supply of AI-enabled Procurement Platform",
                "category": "Services",
                "department": "MPSEDC - Department of Science & Technology",
                "description": "Deployment of Generative AI enabled procurement solution for bid preparation and evaluation",
                "budget": 2500000
            }
        }


class RFPGenerateResponse(BaseModel):
    tender_id: int
    tender_number: str
    title: str
    scope_of_work: str
    eligibility_criteria: str
    sla_terms: str
    evaluation_criteria: str
    deliverables: str
    full_rfp_document: str
    generated_at: datetime


class TenderResponse(BaseModel):
    id: int
    tender_number: str
    title: str
    category: str
    department: str
    description: Optional[str] = None
    budget: Optional[float] = None
    scope_of_work: Optional[str] = None
    eligibility_criteria: Optional[str] = None
    sla_terms: Optional[str] = None
    evaluation_criteria: Optional[str] = None
    deliverables: Optional[str] = None
    generated_rfp: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Pre-Bid Query Schemas ───────────────────────────────────────────────────

class PreBidQueryRequest(BaseModel):
    tender_id: int
    vendor_name: str
    query_text: str

    class Config:
        json_schema_extra = {
            "example": {
                "tender_id": 1,
                "vendor_name": "TechCorp Solutions Pvt Ltd",
                "query_text": "What is the minimum annual turnover required for eligibility under this tender?"
            }
        }


class PreBidQueryResponse(BaseModel):
    query_id: int
    tender_id: int
    vendor_name: str
    query_text: str
    relevant_clause: str
    draft_response: str
    corrigendum_draft: Optional[str]
    analyzed_at: datetime


# ─── Document Schemas ────────────────────────────────────────────────────────

class DocumentUploadResponse(BaseModel):
    document_id: int
    file_name: str
    document_type: str
    ocr_text_preview: str
    ocr_method: str
    accuracy_estimate: float
    metadata: Dict[str, Any]
    vector_stored: bool
    processed_at: datetime


class MetadataExtractionResponse(BaseModel):
    document_id: int
    tender_number: Optional[str]
    tender_name: Optional[str]
    category: Optional[str]
    department: Optional[str]
    submission_date: Optional[str]
    eligibility_criteria: Optional[List[str]]
    evaluation_parameters: Optional[List[str]]
    budget_estimate: Optional[str]
    contact_details: Optional[str]
    raw_metadata: Dict[str, Any]


# ─── PQ Evaluation Schemas ───────────────────────────────────────────────────

class PQEvaluationRequest(BaseModel):
    tender_id: int
    vendor_id: int
    annual_turnover: float
    years_experience: int
    has_gst: bool
    has_pan: bool
    certifications: Optional[List[str]] = []
    similar_project_value: Optional[float] = None
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "tender_id": 1,
                "vendor_id": 1,
                "annual_turnover": 7500000,
                "years_experience": 5,
                "has_gst": True,
                "has_pan": True,
                "certifications": ["ISO 27001", "CMMI Level 3"],
                "similar_project_value": 3000000
            }
        }


class PQEvaluationResponse(BaseModel):
    evaluation_id: int
    vendor_id: int
    tender_id: int
    turnover_status: str
    experience_status: str
    gst_status: str
    pan_status: str
    certifications_status: str
    overall_status: str
    shortfall_report: List[Dict[str, Any]]
    remarks: str
    evaluated_at: datetime


# ─── Technical Evaluation Schemas ────────────────────────────────────────────

class TechnicalEvaluationRequest(BaseModel):
    tender_id: int
    vendor_id: int
    document_id: Optional[int] = None
    bid_text: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "tender_id": 1,
                "vendor_id": 1,
                "bid_text": "Our solution offers 99.9% uptime with AI-powered procurement automation..."
            }
        }


class TechnicalEvaluationResponse(BaseModel):
    evaluation_id: int
    vendor_id: int
    tender_id: int
    overall_score: float
    max_score: float
    percentage: float
    qualification_status: str
    compliance_matrix: List[Dict[str, Any]]
    score_matrix: Dict[str, Any]
    shortfalls: List[str]
    remarks: str
    evaluated_at: datetime


# ─── Shortfall Schemas ───────────────────────────────────────────────────────

class ShortfallRequest(BaseModel):
    tender_id: int
    vendor_id: int
    submitted_documents: List[str]
    submitted_clauses: List[str]


class ShortfallResponse(BaseModel):
    vendor_id: int
    tender_id: int
    missing_documents: List[str]
    missing_clauses: List[str]
    missing_certifications: List[str]
    clarification_request: str
    analyzed_at: datetime


# ─── Financial Evaluation Schemas ────────────────────────────────────────────

class FinancialBidItem(BaseModel):
    item_description: str
    unit: str
    quantity: float
    unit_rate: float


class FinancialEvaluationRequest(BaseModel):
    tender_id: int
    bids: List[Dict[str, Any]]

    class Config:
        json_schema_extra = {
            "example": {
                "tender_id": 1,
                "bids": [
                    {"vendor_id": 1, "vendor_name": "TechCorp", "total_amount": 450000, "items": []},
                    {"vendor_id": 2, "vendor_name": "DataSoft", "total_amount": 520000, "items": []},
                    {"vendor_id": 3, "vendor_name": "AIVentures", "total_amount": 480000, "items": []}
                ]
            }
        }


class FinancialEvaluationResponse(BaseModel):
    tender_id: int
    rankings: List[Dict[str, Any]]
    l1_vendor: str
    l1_amount: float
    evaluation_report: str
    evaluated_at: datetime


# ─── Final Recommendation Schemas ────────────────────────────────────────────

class RecommendationRequest(BaseModel):
    tender_id: int


class RecommendationResponse(BaseModel):
    tender_id: int
    recommended_vendor_id: int
    recommended_vendor_name: str
    pq_status: str
    technical_score: float
    financial_ranking: str
    final_recommendation: str
    award_report: str
    generated_at: datetime
