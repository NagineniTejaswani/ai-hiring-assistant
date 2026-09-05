from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import csv, io

import re
from database import get_db, Base, engine
from config import settings
import models, schemas
from auth import verify_password, create_access_token, get_current_user
from pydantic import BaseModel

app = FastAPI(title="AI Hiring Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://web-kappa-sooty-71.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# ---- Auth ----
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(req: LoginRequest):
    if req.email.strip().lower() != settings.recruiter_email.strip().lower() or not verify_password(req.password, settings.recruiter_password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(req.email)}

# ---- Jobs ----
@app.post("/jobs", response_model=schemas.JobOut)
def create_job(job: schemas.JobCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db_job = models.Job(**job.model_dump())
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return db_job

@app.get("/jobs", response_model=list[schemas.JobOut])
def list_jobs(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Job).order_by(models.Job.created_at.desc()).all()

@app.get("/jobs/{job_id}", response_model=schemas.JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    job = db.get(models.Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

def normalize_phone(raw: str, default_country_code: str = "91") -> str | None:
    """Normalize a phone number to E.164. Assumes India (+91) if no country code present."""
    digits = re.sub(r"[^\d+]", "", raw.strip())
    if digits.startswith("+"):
        return digits if len(digits) >= 11 else None
    if len(digits) == 10:
        return f"+{default_country_code}{digits}"
    if len(digits) > 10:
        return f"+{digits}"
    return None

# ---- Candidates ----
@app.post("/jobs/{job_id}/candidates", response_model=schemas.CandidateOut)
def create_candidate(job_id: str, candidate: schemas.CandidateCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not db.get(models.Job, job_id):
        raise HTTPException(status_code=404, detail="Job not found")

    phone = normalize_phone(candidate.phone_number)
    if not phone:
        raise HTTPException(status_code=422, detail="Invalid phone number format")

    existing_candidates = db.query(models.Candidate).filter(models.Candidate.job_id == job_id).all()
    for c in existing_candidates:
        if c.phone_number == phone or normalize_phone(c.phone_number) == phone:
            raise HTTPException(status_code=409, detail="Candidate with this phone number already exists for this job")

    db_candidate = models.Candidate(job_id=job_id, name=candidate.name, phone_number=phone, notes=candidate.notes)
    db.add(db_candidate)
    db.commit()
    db.refresh(db_candidate)
    return db_candidate

@app.get("/jobs/{job_id}/candidates", response_model=list[schemas.CandidateOut])
def list_candidates(job_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Candidate).filter(models.Candidate.job_id == job_id).order_by(models.Candidate.created_at.asc()).all()

@app.delete("/jobs/{job_id}/candidates/{candidate_id}")
def delete_candidate(job_id: str, candidate_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    candidate = db.query(models.Candidate).filter(models.Candidate.job_id == job_id, models.Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(candidate)
    db.commit()
    return {"status": "deleted"}

@app.post("/jobs/{job_id}/candidates/deduplicate")
def deduplicate_candidates(job_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    candidates = db.query(models.Candidate).filter(models.Candidate.job_id == job_id).order_by(models.Candidate.created_at.asc()).all()
    seen = set()
    removed = 0
    for c in candidates:
        norm = normalize_phone(c.phone_number) or c.phone_number
        if norm in seen:
            db.delete(c)
            removed += 1
        else:
            seen.add(norm)
            if norm != c.phone_number:
                c.phone_number = norm
    db.commit()
    return {"removed": removed}

@app.post("/jobs/{job_id}/candidates/bulk-csv")
async def bulk_upload_candidates(job_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not db.get(models.Job, job_id):
        raise HTTPException(status_code=404, detail="Job not found")

    raw_bytes = await file.read()
    try:
        content = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(content))

    candidates = db.query(models.Candidate).filter(models.Candidate.job_id == job_id).all()
    existing = {}
    for c in candidates:
        norm = normalize_phone(c.phone_number)
        if norm:
            existing[norm] = c
        existing[c.phone_number] = c

    created, skipped_duplicate, skipped_invalid = 0, 0, 0

    for raw_row in reader:
        # Normalize header keys: strip and lowercase
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items() if k}

        raw_name = (
            row.get("name")
            or row.get("candidate name")
            or row.get("candidate_name")
            or row.get("full name")
            or row.get("fullname")
        )
        raw_phone = (
            row.get("phone_number")
            or row.get("phone")
            or row.get("phone number")
            or row.get("phone_no")
            or row.get("mobile")
            or row.get("mobile_number")
            or row.get("contact")
        )
        notes = row.get("notes") or row.get("note") or row.get("remarks") or None

        if not raw_name or not raw_phone:
            skipped_invalid += 1
            continue

        phone = normalize_phone(raw_phone)
        if not phone:
            skipped_invalid += 1
            continue

        if phone in existing:
            # Same candidate re-uploaded — skip rather than duplicate.
            skipped_duplicate += 1
            continue

        c = models.Candidate(job_id=job_id, name=raw_name, phone_number=phone, notes=notes)
        db.add(c)
        existing[phone] = c  # guard against duplicates within the same file too
        created += 1

    db.commit()
    return {
        "created": created,
        "skipped_duplicate": skipped_duplicate,
        "skipped_invalid": skipped_invalid,
    }