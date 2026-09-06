"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiFetch } from "@/lib/api";
import { Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoader, LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Briefcase, Plus, Users, Calendar, ArrowRight, Sparkles } from "lucide-react";

export default function JobsPage() {
    useAuthGuard();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [mustHave, setMustHave] = useState("");

    async function loadJobs() {
        try {
            const data = await apiFetch<Job[]>("/jobs");
            setJobs(data);
        } catch (err) {
            console.error("Failed to load jobs", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadJobs();
    }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        try {
            await apiFetch("/jobs", {
                method: "POST",
                body: JSON.stringify({ title, description, must_have_criteria: mustHave }),
            });
            setOpen(false);
            setTitle("");
            setDescription("");
            setMustHave("");
            await loadJobs();
        } catch (err: any) {
            alert(err.message || "Failed to create job");
        } finally {
            setCreating(false);
        }
    }

    if (loading) {
        return <PageLoader text="Loading your jobs..." />;
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <Briefcase className="h-7 w-7 text-indigo-600" />
                        Job Postings
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage active roles and conduct automated AI voice screenings
                    </p>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger render={<Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm gap-2" />}>
                        <Plus className="h-4 w-4" />
                        Create Job
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-indigo-600" />
                                Create New Job
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-medium">Job Title *</Label>
                                <Input
                                    placeholder="e.g. Senior Frontend Engineer"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    className="focus-visible:ring-indigo-600"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-medium">Description</Label>
                                <Input
                                    placeholder="Brief overview of the responsibilities"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="focus-visible:ring-indigo-600"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-slate-700 font-medium">Must-have Criteria</Label>
                                <Input
                                    placeholder="e.g. 3+ yrs React experience, Bangalore based"
                                    value={mustHave}
                                    onChange={(e) => setMustHave(e.target.value)}
                                    className="focus-visible:ring-indigo-600"
                                />
                                <p className="text-xs text-slate-400">
                                    The AI agent will evaluate candidates against these criteria during the screening call.
                                </p>
                            </div>
                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                                >
                                    {creating ? <LoadingSpinner size="sm" text="Creating..." className="flex-row text-white" /> : "Create Job"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Jobs List / Empty State */}
            {jobs.length === 0 ? (
                <EmptyState
                    icon={Briefcase}
                    title="No jobs created yet"
                    description="Get started by creating your first job posting to upload candidates and launch AI phone screenings."
                    action={
                        <Button
                            onClick={() => setOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Create Your First Job
                        </Button>
                    }
                    className="py-16 bg-white shadow-xs"
                />
            ) : (
                <Card className="border-slate-200/90 shadow-xs overflow-hidden bg-white">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 px-6 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold text-slate-800">All Roles ({jobs.length})</CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Select a job to view candidates and screening call transcripts
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/75 hover:bg-slate-50/75">
                                    <TableHead className="font-semibold text-slate-700">Job Title</TableHead>
                                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                                    <TableHead className="font-semibold text-slate-700">Created</TableHead>
                                    <TableHead className="text-right font-semibold text-slate-700 pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {jobs.map((job) => (
                                    <TableRow key={job.id} className="hover:bg-slate-50/70 transition-colors">
                                        <TableCell className="font-medium text-slate-900 py-4">
                                            <Link
                                                href={`/jobs/${job.id}`}
                                                className="group inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-indigo-600 transition"
                                            >
                                                <span>{job.title}</span>
                                                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-600" />
                                            </Link>
                                            {job.description && (
                                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                                    {job.description}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`capitalize font-medium text-xs ${
                                                    job.status === "active"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                                }`}
                                            >
                                                {job.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500">
                                            <span className="inline-flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                {new Date(job.created_at).toLocaleDateString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                })}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Link href={`/jobs/${job.id}`}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-medium gap-1"
                                                >
                                                    <Users className="h-3.5 w-3.5" />
                                                    View Details
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}