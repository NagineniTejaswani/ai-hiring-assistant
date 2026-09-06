"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiFetch, getToken, API_URL } from "@/lib/api";
import { Candidate, Job, ScreeningCall } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function JobDetailPage() {
    useAuthGuard();
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<Job | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvStatus, setCsvStatus] = useState("");
    const [screeningLoading, setScreeningLoading] = useState<string | null>(null);
    const [screeningCalls, setScreeningCalls] = useState<ScreeningCall[]>([]);
    const [addError, setAddError] = useState("");


    async function loadScreeningCalls() {
        const data = await apiFetch<ScreeningCall[]>(`/jobs/${jobId}/screening-calls`);
        setScreeningCalls(data);
    }

    async function loadData() {
        const jobData = await apiFetch<Job>(`/jobs/${jobId}`);
        setJob(jobData);
        const candidateData = await apiFetch<Candidate[]>(`/jobs/${jobId}/candidates`);
        setCandidates(candidateData);
    }

    useEffect(() => {
        if (jobId) {
            loadData();
            loadScreeningCalls();
        }
    }, [jobId]);


    async function handleAddCandidate(e: React.FormEvent) {
        e.preventDefault();
        setAddError("");
        try {
            await apiFetch(`/jobs/${jobId}/candidates`, {
                method: "POST",
                body: JSON.stringify({ name, phone_number: phone }),
            });
            setName(""); setPhone("");
            loadData();
        } catch (err: any) {
            setAddError(err.message || "Failed to add candidate");
        }
    }

    async function handleDeleteCandidate(candidateId: string) {
        if (!confirm("Are you sure you want to delete this candidate?")) return;
        try {
            await apiFetch(`/jobs/${jobId}/candidates/${candidateId}`, {
                method: "DELETE",
            });
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to delete candidate");
        }
    }

    async function handleCsvUpload() {
        if (!csvFile) return;
        setCsvStatus("Uploading...");
        const formData = new FormData();
        formData.append("file", csvFile);
        const res = await fetch(`${API_URL}/jobs/${jobId}/candidates/bulk-csv`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
        });
        const data = await res.json();
        const msg = `Imported ${data.created} new candidate${data.created === 1 ? "" : "s"}${data.skipped_duplicate ? ` (${data.skipped_duplicate} duplicate${data.skipped_duplicate === 1 ? "" : "s"} skipped)` : ""}`;
        setCsvStatus(msg);
        loadData();
    }

    async function handleScreenOne(candidateId: string) {
        setScreeningLoading(candidateId);
        try {
            await apiFetch(`/jobs/${jobId}/candidates/${candidateId}/screen`, { method: "POST" });
            alert("Screening call triggered. Check results below in a few minutes.");
            loadScreeningCalls();
        } catch (err: any) {
            alert(`Failed to trigger call: ${err.message}`);
        } finally {
            setScreeningLoading(null);
        }
    }

    async function handleScreenAll() {
        setScreeningLoading("all");
        try {
            const res = await apiFetch<{ message: string; created: number }>(`/jobs/${jobId}/screen-all`, { method: "POST" });
            alert(res.message);
            loadScreeningCalls();
        } catch (err: any) {
            alert(`Failed to trigger bulk screening: ${err.message}`);
        } finally {
            setScreeningLoading(null);
        }
    }

    function statusBadgeVariant(lifecycleStatus: string): "default" | "secondary" | "destructive" | "outline" {
        if (lifecycleStatus === "COMPLETED") return "default";
        if (lifecycleStatus === "IN_PROGRESS") return "secondary";
        if (lifecycleStatus === "NOT_CONNECTED" || lifecycleStatus === "FAILED" || lifecycleStatus === "CANCELLED") return "destructive";
        return "outline";
    }

    function formatDateTime(dateStr: string) {
        if (!dateStr) return "—";
        const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : `${dateStr}Z`;
        return new Date(utcStr).toLocaleString();
    }

    if (!job) return <div className="p-8">Loading...</div>;


    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <p className="text-muted-foreground">{job.description}</p>

            <Card>
                <CardHeader><CardTitle>Add Candidate</CardTitle></CardHeader>
                <CardContent>
                    <form onSubmit={handleAddCandidate} className="space-y-3">
                        <div className="flex gap-3 items-end">
                            <div className="flex-1">
                                <Label>Name</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} required />
                            </div>
                            <div className="flex-1">
                                <Label>Phone (E.164, e.g. +91XXXXXXXXXX)</Label>
                                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
                            </div>
                            <Button type="submit">Add</Button>
                        </div>
                        {addError && <p className="text-sm text-red-500">{addError}</p>}
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Bulk Import (CSV)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">Columns supported: Name, Phone (or phone_number), Notes</p>
                    <input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
                    <Button onClick={handleCsvUpload} disabled={!csvFile}>Upload CSV</Button>
                    {csvStatus && <p className="text-sm">{csvStatus}</p>}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Candidates ({candidates.length})</CardTitle>
                    <Button onClick={handleScreenAll} disabled={screeningLoading === "all" || candidates.length === 0}>
                        {screeningLoading === "all" ? "Triggering..." : "Screen All"}
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {candidates.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell>{c.phone_number}</TableCell>
                                    <TableCell>{c.notes ?? "—"}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleScreenOne(c.id)}
                                            disabled={screeningLoading === c.id}
                                        >
                                            {screeningLoading === c.id ? "Calling..." : "Screen"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => handleDeleteCandidate(c.id)}
                                        >
                                            Delete
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Screening Results ({screeningCalls.length})</CardTitle>
                    <Button variant="outline" size="sm" onClick={loadScreeningCalls}>
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent>
                    {screeningCalls.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No screening calls yet. Click "Screen" or "Screen All" above to start.</p>
                    ) : (
                        <div className="space-y-4">
                            {screeningCalls.map((sc) => (
                                <div key={sc.id} className="border rounded-lg p-4 space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium">{sc.candidate_name}</p>
                                            <p className="text-sm text-muted-foreground">{sc.candidate_phone}</p>
                                        </div>
                                        <Badge variant={statusBadgeVariant(sc.lifecycle_status)}>
                                            {sc.lifecycle_status}
                                        </Badge>
                                    </div>

                                    {sc.result && Object.keys(sc.result).length > 0 && (
                                        <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                                            {sc.result.interest_level && (
                                                <p><span className="text-muted-foreground">Interest:</span> {sc.result.interest_level}</p>
                                            )}
                                            {sc.result.overall_qualified !== undefined && sc.result.overall_qualified !== "" && (
                                                <p>
                                                    <span className="text-muted-foreground">Qualified:</span>{" "}
                                                    {sc.result.overall_qualified === true ? "Yes" : sc.result.overall_qualified === false ? "No" : "—"}
                                                </p>
                                            )}
                                            {sc.result.availability_to_join && (
                                                <p><span className="text-muted-foreground">Availability:</span> {sc.result.availability_to_join}</p>
                                            )}
                                            {sc.result.current_ctc && (
                                                <p><span className="text-muted-foreground">Current CTC:</span> {sc.result.current_ctc}</p>
                                            )}
                                            {sc.result.expected_ctc && (
                                                <p><span className="text-muted-foreground">Expected CTC:</span> {sc.result.expected_ctc}</p>
                                            )}
                                            {sc.result.relevant_experience_years !== undefined && sc.result.relevant_experience_years !== "" && (
                                                <p><span className="text-muted-foreground">Experience:</span> {sc.result.relevant_experience_years} yrs</p>
                                            )}
                                            {sc.result.key_skills_mentioned && (
                                                <p className="col-span-2"><span className="text-muted-foreground">Skills:</span> {sc.result.key_skills_mentioned}</p>
                                            )}
                                            {sc.result.qualification_summary && (
                                                <p className="col-span-2"><span className="text-muted-foreground">Summary:</span> {sc.result.qualification_summary}</p>
                                            )}
                                            {sc.result.candidate_questions_or_concerns && (
                                                <p className="col-span-2"><span className="text-muted-foreground">Questions raised:</span> {sc.result.candidate_questions_or_concerns}</p>
                                            )}
                                        </div>
                                    )}

                                    {sc.recording_url && (
                                        <audio controls className="w-full mt-2">
                                            <source src={sc.recording_url} type="audio/wav" />
                                            Your browser does not support audio playback.
                                        </audio>
                                    )}

                                    <p className="text-xs text-muted-foreground pt-1">
                                        Triggered {formatDateTime(sc.created_at)} · Last updated {formatDateTime(sc.updated_at)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}