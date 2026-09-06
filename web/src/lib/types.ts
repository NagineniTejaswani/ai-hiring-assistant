export interface Job {
    id: string;
    title: string;
    description: string | null;
    must_have_criteria: string | null;
    status: string;
    created_at: string;
}

export interface Candidate {
    id: string;
    job_id: string;
    name: string;
    phone_number: string;
    notes: string | null;
    created_at: string;
}

export interface ScreeningCall {
    id: string;
    candidate_id: string;
    job_id: string;
    candidate_name: string;
    candidate_phone: string;
    hunar_call_id: string | null;
    status: string;
    lifecycle_status: string;
    result: Record<string, any> | null;
    recording_url: string | null;
    created_at: string;
    updated_at: string;
}