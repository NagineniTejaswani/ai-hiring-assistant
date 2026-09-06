from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any

class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None
    must_have_criteria: Optional[str] = None

class JobOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    must_have_criteria: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class CandidateCreate(BaseModel):
    name: str
    phone_number: str
    notes: Optional[str] = None

class CandidateOut(BaseModel):
    id: str
    job_id: str
    name: str
    phone_number: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True



class ScreeningCallOut(BaseModel):
    id: str
    candidate_id: str
    job_id: str
    hunar_call_id: Optional[str] = None
    status: str
    lifecycle_status: str
    result: Optional[dict[str, Any]] = None
    recording_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScreeningCallWithCandidateOut(ScreeningCallOut):
    candidate_name: Optional[str] = None
    candidate_phone: Optional[str] = None