"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiFetch, getToken, API_URL } from "@/lib/api";
import { Candidate, Job, ScreeningCall } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageLoader, LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import {
    ArrowLeft,
    UserPlus,
    Upload,
    PhoneCall,
    PhoneOutgoing,
    Trash2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    FileText,
    Users,
    Headphones,
    Sparkles,
} from "lucide-react";

export default function JobDetailPage() {
    useAuthGuard();
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<Job | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [screeningCalls, setScreeningCalls] = useState<ScreeningCall[]>([]);
    const [initialLoading, setInitialLoading] = useState(true);

    // Action loaders
    const [addingCandidate, setAddingCandidate] = useState(false);
    const [uploadingCsv, setUploadingCsv] = useState(false);
    const [refreshingCalls, setRefreshingCalls] = useState(false);
    const [screeningLoading, setScreeningLoading] = useState<string | null>(null); // candidate_id or "all"
    const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);

    // Form states
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvStatus, setCsvStatus] = useState("");
    const [addError, setAddError] = useState("");

    async function loadScreeningCalls(showSpinner = false) {
        if (showSpinner) setRefreshingCalls(true);
        try {
            const data = await apiFetch<ScreeningCall[]>(`/jobs/${jobId}/screening-calls`);
            setScreeningCalls(data);
        } catch (err) {
            console.error("Failed to load screening calls", err);
        } finally {
            if (showSpinner) setRefreshingCalls(false);
        }
    }

    async function loadData() {
        try {
            const [jobData, candidateData, callsData] = await Promise.all([
                apiFetch<Job>(`/jobs/${jobId}`),
                apiFetch<Candidate[]>(`/jobs/${jobId}/candidates`),
                apiFetch<ScreeningCall[]>(`/jobs/${jobId}/screening-calls`),
            ]);
            setJob(jobData);
            setCandidates(candidateData);
            setScreeningCalls(callsData);
        } catch (err) {
            console.error("Failed to load data", err);
        } finally {
            setInitialLoading(false);
        }
    }

    useEffect(() => {
        if (jobId) {
            loadData();
        }
    }, [jobId]);

    async function handleAddCandidate(e: React.FormEvent) {
        e.preventDefault();
        setAddError("");
        setAddingCandidate(true);
        try {
            await apiFetch(`/jobs/${jobId}/candidates`, {
                method: "POST",
                body: JSON.stringify({ name, phone_number: phone }),
            });
            setName("");
            setPhone("");
            const updatedCandidates = await apiFetch<Candidate[]>(`/jobs/${jobId}/candidates`);
            setCandidates(updatedCandidates);
        } catch (err: any) {
            setAddError(err.message || "Failed to add candidate");
        } finally {
            setAddingCandidate(false);
        }
    }

    async function handleDeleteCandidate(candidateId: string) {
        if (!confirm("Are you sure you want to delete this candidate? Any associated call records will also be removed.")) return;
        setDeletingCandidateId(candidateId);
        try {
            await apiFetch(`/jobs/${jobId}/candidates/${candidateId}`, {
                method: "DELETE",
            });
            const [updatedCandidates, updatedCalls] = await Promise.all([
                apiFetch<Candidate[]>(`/jobs/${jobId}/candidates`),
                apiFetch<ScreeningCall[]>(`/jobs/${jobId}/screening-calls`),
            ]);
            setCandidates(updatedCandidates);
            setScreeningCalls(updatedCalls);
        } catch (err: any) {
            alert(err.message || "Failed to delete candidate");
        } finally {
            setDeletingCandidateId(null);
        }
    }

    async function handleCsvUpload() {
        if (!csvFile) return;
        setUploadingCsv(true);
        setCsvStatus("Uploading and parsing candidates...");
        try {
            const formData = new FormData();
            formData.append("file", csvFile);
            const res = await fetch(`${API_URL}/jobs/${jobId}/candidates/bulk-csv`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to upload CSV");
            const msg = `Imported ${data.created} new candidate${data.created === 1 ? "" : "s"}${data.skipped_duplicate ? ` (${data.skipped_duplicate} duplicate${data.skipped_duplicate === 1 ? "" : "s"} skipped)` : ""}`;
            setCsvStatus(msg);
            setCsvFile(null);
            const updatedCandidates = await apiFetch<Candidate[]>(`/jobs/${jobId}/candidates`);
            setCandidates(updatedCandidates);
        } catch (err: any) {
            setCsvStatus(`Error: ${err.message}`);
        } finally {
            setUploadingCsv(false);
        }
    }

    async function handleScreenOne(candidateId: string) {
        setScreeningLoading(candidateId);
        try {
            await apiFetch(`/jobs/${jobId}/candidates/${candidateId}/screen`, { method: "POST" });
            await loadScreeningCalls();
            alert("AI Screening call initiated. Live results and audio will appear in the Screening Results section below.");
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
            await loadScreeningCalls();
            alert(res.message);
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

    if (initialLoading) {
        return <PageLoader text="Loading job details & candidates..." />;
    }

    if (!job) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <EmptyState
                    icon={AlertCircle}
                    title="Job not found"
                    description="The requested job posting could not be found or has been removed."
                    action={
                        <Link href="/jobs">
                            <Button variant="outline" className="gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to Jobs
                            </Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
            {/* Navigation Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Link href="/jobs" className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition font-medium">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Jobs
                </Link>
            </div>

            {/* Job Header Card */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-6 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
                            <Badge
                                variant="outline"
                                className={`capitalize text-xs font-semibold ${
                                    job.status === "active"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                            >
                                {job.status}
                            </Badge>
                        </div>
                        {job.description && (
                            <p className="text-sm text-slate-600 mt-1 max-w-3xl">{job.description}</p>
                        )}
                    </div>
                </div>

                {job.must_have_criteria && (
                    <div className="pt-2 border-t border-slate-100 flex items-start gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mt-0.5">
                            Must-Have
                        </span>
                        <p className="text-xs text-slate-600">{job.must_have_criteria}</p>
                    </div>
                )}
            </div>

            {/* Candidate Addition Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manual Add Form */}
                <Card className="border-slate-200/90 shadow-xs bg-white">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/40">
                        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-indigo-600" />
                            Add Candidate Manually
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <form onSubmit={handleAddCandidate} className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-700">Full Name</Label>
                                <Input
                                    placeholder="e.g. Jane Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="focus-visible:ring-indigo-600 text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-medium text-slate-700">Phone (E.164, e.g. +91XXXXXXXXXX)</Label>
                                <Input
                                    placeholder="+919876543210"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                    className="focus-visible:ring-indigo-600 text-sm"
                                />
                            </div>
                            {addError && <p className="text-xs text-red-600 font-medium">{addError}</p>}
                            <Button
                                type="submit"
                                disabled={addingCandidate}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium gap-1.5"
                            >
                                {addingCandidate ? (
                                    <LoadingSpinner size="sm" text="Adding..." className="flex-row text-white" />
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        Add Candidate
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Bulk CSV Upload */}
                <Card className="border-slate-200/90 shadow-xs bg-white">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/40">
                        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                            <Upload className="h-4 w-4 text-indigo-600" />
                            Bulk Upload Candidates (CSV)
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            CSV with <code className="text-indigo-600 font-medium">name</code> and <code className="text-indigo-600 font-medium">phone_number</code> headers
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-medium text-slate-700">Choose CSV File</Label>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                                className="text-xs file:bg-slate-100 file:border-0 file:rounded-md file:text-xs file:font-semibold file:text-slate-700 file:mr-3 hover:file:bg-slate-200 cursor-pointer"
                            />
                        </div>
                        <Button
                            onClick={handleCsvUpload}
                            disabled={!csvFile || uploadingCsv}
                            variant="outline"
                            className="w-full border-slate-300 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 text-sm font-medium gap-1.5"
                        >
                            {uploadingCsv ? (
                                <LoadingSpinner size="sm" text="Uploading..." className="flex-row text-indigo-600" />
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Upload & Import
                                </>
                            )}
                        </Button>
                        {csvStatus && (
                            <p className="text-xs text-slate-600 font-medium bg-slate-50 p-2 rounded border border-slate-200">
                                {csvStatus}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Candidates Table */}
            <Card className="border-slate-200/90 shadow-xs bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        <div>
                            <CardTitle className="text-base font-semibold text-slate-900">
                                Candidates ({candidates.length})
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Candidate roster ready for AI phone interview screening
                            </CardDescription>
                        </div>
                    </div>
                    {candidates.length > 0 && (
                        <Button
                            onClick={handleScreenAll}
                            disabled={screeningLoading === "all"}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs gap-1.5 shadow-sm"
                        >
                            {screeningLoading === "all" ? (
                                <LoadingSpinner size="sm" text="Screening..." className="flex-row text-white" />
                            ) : (
                                <>
                                    <PhoneOutgoing className="h-3.5 w-3.5" />
                                    Screen All Candidates
                                </>
                            )}
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {candidates.length === 0 ? (
                        <EmptyState
                            icon={Users}
                            title="No candidates added yet"
                            description="Add candidates above manually or upload a CSV roster to trigger automated voice screenings."
                            className="m-6 bg-white"
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                                    <TableHead className="font-semibold text-slate-700">Name</TableHead>
                                    <TableHead className="font-semibold text-slate-700">Phone</TableHead>
                                    <TableHead className="font-semibold text-slate-700">Notes</TableHead>
                                    <TableHead className="text-right font-semibold text-slate-700 pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {candidates.map((c) => (
                                    <TableRow key={c.id} className="hover:bg-slate-50/70 transition-colors">
                                        <TableCell className="font-medium text-slate-900">{c.name}</TableCell>
                                        <TableCell className="text-slate-600 font-mono text-xs">{c.phone_number}</TableCell>
                                        <TableCell className="text-slate-500 text-xs">{c.notes ?? "—"}</TableCell>
                                        <TableCell className="text-right pr-6 space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleScreenOne(c.id)}
                                                disabled={screeningLoading === c.id || screeningLoading === "all"}
                                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-medium gap-1"
                                            >
                                                {screeningLoading === c.id ? (
                                                    <LoadingSpinner size="sm" text="Calling..." className="flex-row text-indigo-700" />
                                                ) : (
                                                    <>
                                                        <PhoneCall className="h-3.5 w-3.5" />
                                                        Screen
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                disabled={deletingCandidateId === c.id}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium gap-1"
                                                onClick={() => handleDeleteCandidate(c.id)}
                                            >
                                                {deletingCandidateId === c.id ? (
                                                    <LoadingSpinner size="sm" text="" className="text-red-500" />
                                                ) : (
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Screening Results Card */}
            <Card className="border-slate-200/90 shadow-xs bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Headphones className="h-5 w-5 text-indigo-600" />
                        <div>
                            <CardTitle className="text-base font-semibold text-slate-900">
                                Screening Results ({screeningCalls.length})
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                AI evaluation scores, transcripts, CTC, and call recordings
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadScreeningCalls(true)}
                        disabled={refreshingCalls}
                        className="text-xs border-slate-200 hover:bg-slate-100 font-medium gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshingCalls ? "animate-spin text-indigo-600" : ""}`} />
                        {refreshingCalls ? "Refreshing..." : "Refresh"}
                    </Button>
                </CardHeader>
                <CardContent className="p-6">
                    {screeningCalls.length === 0 ? (
                        <EmptyState
                            icon={PhoneCall}
                            title="No screening calls yet"
                            description="Click 'Screen' on a candidate or 'Screen All' above to initiate AI phone interviews."
                        />
                    ) : (
                        <div className="space-y-4">
                            {screeningCalls.map((sc) => (
                                <div
                                    key={sc.id}
                                    className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 bg-white hover:border-slate-300 transition-colors shadow-2xs"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 font-semibold text-xs">
                                                {sc.candidate_name ? sc.candidate_name.charAt(0).toUpperCase() : "C"}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-slate-900">{sc.candidate_name || "Unknown Candidate"}</p>
                                                <p className="text-xs text-slate-500 font-mono">{sc.candidate_phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={statusBadgeVariant(sc.lifecycle_status)}
                                                className="text-xs font-medium tracking-wide uppercase px-2 py-0.5"
                                            >
                                                {sc.lifecycle_status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Structured AI Results */}
                                    {sc.result && Object.keys(sc.result).length > 0 ? (
                                        <div className="space-y-3 pt-1">
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                                                {sc.result.overall_qualified !== undefined && sc.result.overall_qualified !== "" && (
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="text-slate-500 block mb-0.5">Qualified</span>
                                                        <span className="font-semibold flex items-center gap-1">
                                                            {sc.result.overall_qualified === true ? (
                                                                <span className="text-emerald-700 flex items-center gap-1">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Yes
                                                                </span>
                                                            ) : sc.result.overall_qualified === false ? (
                                                                <span className="text-rose-700 flex items-center gap-1">
                                                                    <XCircle className="h-3.5 w-3.5" /> No
                                                                </span>
                                                            ) : (
                                                                "—"
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                                {sc.result.interest_level && (
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="text-slate-500 block mb-0.5">Interest Level</span>
                                                        <span className="font-semibold text-slate-800 capitalize">
                                                            {sc.result.interest_level}
                                                        </span>
                                                    </div>
                                                )}
                                                {sc.result.availability_to_join && (
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="text-slate-500 block mb-0.5">Availability</span>
                                                        <span className="font-semibold text-slate-800">
                                                            {sc.result.availability_to_join}
                                                        </span>
                                                    </div>
                                                )}
                                                {sc.result.current_ctc && (
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="text-slate-500 block mb-0.5">Current CTC</span>
                                                        <span className="font-semibold text-slate-800">{sc.result.current_ctc}</span>
                                                    </div>
                                                )}
                                                {sc.result.expected_ctc && (
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="text-slate-500 block mb-0.5">Expected CTC</span>
                                                        <span className="font-semibold text-slate-800">{sc.result.expected_ctc}</span>
                                                    </div>
                                                )}
                                                {sc.result.relevant_experience_years !== undefined && sc.result.relevant_experience_years !== "" && (
                                                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                                        <span className="text-slate-500 block mb-0.5">Experience</span>
                                                        <span className="font-semibold text-slate-800">{sc.result.relevant_experience_years} yrs</span>
                                                    </div>
                                                )}
                                            </div>

                                            {sc.result.qualification_summary && (
                                                <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-100 text-xs">
                                                    <span className="font-semibold text-slate-700 block mb-1">AI Evaluation Summary:</span>
                                                    <p className="text-slate-600 leading-relaxed">{sc.result.qualification_summary}</p>
                                                </div>
                                            )}

                                            {sc.result.key_skills_mentioned && (
                                                <div className="text-xs text-slate-600">
                                                    <span className="font-semibold text-slate-700">Skills Identified: </span>
                                                    {sc.result.key_skills_mentioned}
                                                </div>
                                            )}

                                            {sc.result.candidate_questions_or_concerns && (
                                                <div className="text-xs text-slate-600">
                                                    <span className="font-semibold text-slate-700">Candidate Questions: </span>
                                                    {sc.result.candidate_questions_or_concerns}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                            <span>
                                                {sc.lifecycle_status === "IN_PROGRESS"
                                                    ? "Screening call is in progress. Results will appear once completed."
                                                    : "Awaiting evaluation results from AI agent."}
                                            </span>
                                        </div>
                                    )}

                                    {/* Call Audio Player */}
                                    {sc.recording_url && (
                                        <div className="pt-2 border-t border-slate-100">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                                                <Headphones className="h-3.5 w-3.5 text-indigo-600" />
                                                <span>Call Audio Recording</span>
                                            </div>
                                            <audio controls className="w-full h-9 rounded-lg">
                                                <source src={sc.recording_url} type="audio/wav" />
                                                Your browser does not support audio playback.
                                            </audio>
                                        </div>
                                    )}

                                    {/* Timestamp Footer */}
                                    <div className="pt-2 border-t border-slate-100/70 text-[11px] text-slate-400 flex flex-wrap justify-between items-center gap-2">
                                        <span>Triggered: {formatDateTime(sc.created_at)}</span>
                                        <span>Last updated: {formatDateTime(sc.updated_at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}