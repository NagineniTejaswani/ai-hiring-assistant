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
from hunar_client import create_call, HunarAPIError, create_bulk_calls
import uuid
import json
from fastapi import Request, Response
from webhook_utils import verify_hunar_webhook_signature


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


@app.post("/jobs/{job_id}/candidates/{candidate_id}/screen", response_model=schemas.ScreeningCallOut)
async def screen_candidate(
    job_id: str,
    candidate_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    job = db.get(models.Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidate = db.get(models.Candidate, candidate_id)
    if not candidate or candidate.job_id != job_id:
        raise HTTPException(status_code=404, detail="Candidate not found for this job")

    # Create the DB row first — its id becomes our request_id, so incoming
    # webhooks can be matched back to this exact record.
    screening_call = models.ScreeningCall(
        candidate_id=candidate.id,
        job_id=job.id,
        status="NOT_STARTED",
        lifecycle_status="NOT_STARTED",
    )
    db.add(screening_call)
    db.commit()
    db.refresh(screening_call)

    custom_data = {
        "job_title": job.title,
        "company_name": settings.company_name or "Hunar",
        "job_description_summary": job.description if (job.description and job.description.strip()) else f"Role for {job.title}",
        "must_have_criteria": job.must_have_criteria if (job.must_have_criteria and job.must_have_criteria.strip()) else "Relevant experience and skills for the role",
    }

    try:
        hunar_response = await create_call(
            callee_name=candidate.name,
            mobile_number=candidate.phone_number,
            custom_data=custom_data,
            request_id=screening_call.id,
        )
    except HunarAPIError as e:
        screening_call.status = "FAILED"
        screening_call.lifecycle_status = "FAILED"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Hunar call creation failed: {e.message}")

    screening_call.hunar_call_id = hunar_response["id"]
    screening_call.status = hunar_response.get("status", "NOT_STARTED")
    db.commit()
    db.refresh(screening_call)

    return screening_call




@app.post("/jobs/{job_id}/screen-all")
async def screen_all_candidates(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    job = db.get(models.Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    candidates = db.query(models.Candidate).filter(models.Candidate.job_id == job_id).all()
    if not candidates:
        raise HTTPException(status_code=400, detail="No candidates to screen for this job")

    # Skip candidates who already have a screening call in progress or completed
    already_screened_ids = {
        sc.candidate_id for sc in
        db.query(models.ScreeningCall).filter(models.ScreeningCall.job_id == job_id).all()
        if sc.lifecycle_status not in ("FAILED", "CANCELLED")
    }
    to_screen = [c for c in candidates if c.id not in already_screened_ids]

    if not to_screen:
        return {"message": "All candidates already screened or in progress", "created": 0}

    # Create DB rows first, keyed by phone number for matching after Hunar responds
    screening_calls_by_phone = {}
    for candidate in to_screen:
        sc = models.ScreeningCall(
            candidate_id=candidate.id,
            job_id=job.id,
            status="NOT_STARTED",
            lifecycle_status="NOT_STARTED",
        )
        db.add(sc)
        screening_calls_by_phone[candidate.phone_number] = sc
    db.commit()

    custom_data = {
        "job_title": job.title,
        "company_name": settings.company_name or "Hunar",
        "job_description_summary": job.description if (job.description and job.description.strip()) else f"Role for {job.title}",
        "must_have_criteria": job.must_have_criteria if (job.must_have_criteria and job.must_have_criteria.strip()) else "Relevant experience and skills for the role",
    }

    recipients = [
        {
            "callee_name": c.name,
            "mobile_number": c.phone_number,
            "custom_data": custom_data,
        }
        for c in to_screen
    ]

    batch_request_id = f"batch-{job.id[:8]}-{uuid.uuid4().hex[:8]}"

    try:
        hunar_calls = await create_bulk_calls(batch_request_id=batch_request_id, recipients=recipients)
    except HunarAPIError as e:
        for sc in screening_calls_by_phone.values():
            sc.status = "FAILED"
            sc.lifecycle_status = "FAILED"
        db.commit()
        raise HTTPException(status_code=502, detail=f"Hunar bulk call creation failed: {e.message}")

    # Match each returned call back to our row via mobile_number
    updated = 0
    for hunar_call in hunar_calls:
        phone = hunar_call.get("mobile_number")
        sc = screening_calls_by_phone.get(phone)
        if sc:
            sc.hunar_call_id = hunar_call["id"]
            sc.status = hunar_call.get("status", "NOT_STARTED")
            updated += 1

    db.commit()
    return {"message": f"Triggered {updated} screening calls", "created": updated, "requested": len(to_screen)}


@app.post("/webhooks/hunar")
async def hunar_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()

    verified = verify_hunar_webhook_signature(
        signature_header=request.headers.get("X-Hunar-Signature"),
        timestamp_header=request.headers.get("X-Hunar-Timestamp"),
        request_body=raw_body,
        trusted_api_keys=[settings.hunar_api_key],
    )
    if not verified:
        return Response(status_code=401)

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return Response(status_code=400)

    event_type = payload.get("event_type")
    request_id = payload.get("request_id")
    call_id = payload.get("call_id")

    # Match back to our row: request_id (our screening_call.id) is primary key,
    # hunar_call_id is a fallback in case request_id wasn't preserved somehow.
    screening_call = None
    if request_id:
        screening_call = db.get(models.ScreeningCall, request_id)
    if not screening_call and call_id:
        screening_call = db.query(models.ScreeningCall).filter(
            models.ScreeningCall.hunar_call_id == call_id
        ).first()

    if not screening_call:
        # Acknowledge anyway (2XX) so Hunar doesn't keep retrying a webhook we can't match.
        return {"ok": True, "matched": False}

    if event_type == "call_status_updated":
        screening_call.status = payload.get("status", screening_call.status)
        screening_call.lifecycle_status = payload.get("lifecycle_status", screening_call.lifecycle_status)

    elif event_type == "call_recording_done":
        screening_call.recording_url = payload.get("recording_url")

    elif event_type == "call_result_done":
        screening_call.result = payload.get("result")

    elif event_type == "call_summary":
        screening_call.status = payload.get("status", screening_call.status)
        screening_call.lifecycle_status = payload.get("lifecycle_status", screening_call.lifecycle_status)
        if payload.get("recording_url"):
            screening_call.recording_url = payload.get("recording_url")
        if payload.get("result"):
            screening_call.result = payload.get("result")

    db.commit()
    return {"ok": True, "matched": True, "event_type": event_type}


@app.get("/jobs/{job_id}/screening-calls", response_model=list[schemas.ScreeningCallOut])
def list_screening_calls(job_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return (
        db.query(models.ScreeningCall)
        .filter(models.ScreeningCall.job_id == job_id)
        .order_by(models.ScreeningCall.created_at.desc())
        .all()
    )