"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiFetch, getToken, API_URL } from "@/lib/api";
import { Candidate, Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function JobDetailPage() {
    useAuthGuard();
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<Job | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvStatus, setCsvStatus] = useState("");

    async function loadData() {
        const jobData = await apiFetch<Job>(`/jobs/${jobId}`);
        setJob(jobData);
        const candidateData = await apiFetch<Candidate[]>(`/jobs/${jobId}/candidates`);
        setCandidates(candidateData);
    }

    useEffect(() => {
        if (jobId) loadData();
    }, [jobId]);

    const [addError, setAddError] = useState("");

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

    async function handleDeduplicate() {
        try {
            const res = await apiFetch<{ removed: number }>(`/jobs/${jobId}/candidates/deduplicate`, {
                method: "POST",
            });
            alert(`Cleaned up ${res.removed} duplicate candidates.`);
            loadData();
        } catch (err: any) {
            alert(err.message || "Failed to remove duplicates");
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
                    {candidates.length > 1 && (
                        <Button variant="outline" size="sm" onClick={handleDeduplicate}>
                            Remove Duplicates
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="w-20 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {candidates.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell>{c.name}</TableCell>
                                    <TableCell>{c.phone_number}</TableCell>
                                    <TableCell>{c.notes ?? "—"}</TableCell>
                                    <TableCell className="text-right">
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
        </div>
    );
}