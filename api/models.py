import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

def gen_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    must_have_criteria: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")  # draft/active/closed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[str] = mapped_column(String, nullable=False)  # E.164 format
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    job: Mapped["Job"] = relationship(back_populates="candidates")
    screening_calls: Mapped[list["ScreeningCall"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")


class ScreeningCall(Base):
    __tablename__ = "screening_calls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), nullable=False)
    hunar_call_id: Mapped[str] = mapped_column(String, nullable=True)  # set once Hunar responds
    status: Mapped[str] = mapped_column(String, default="NOT_STARTED")
    lifecycle_status: Mapped[str] = mapped_column(String, default="NOT_STARTED")
    result: Mapped[dict] = mapped_column(JSON, nullable=True)
    recording_url: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    candidate: Mapped["Candidate"] = relationship(back_populates="screening_calls")