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