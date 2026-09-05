"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { apiFetch } from "@/lib/api";
import { Job } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function JobsPage() {
    useAuthGuard();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [mustHave, setMustHave] = useState("");

    async function loadJobs() {
        const data = await apiFetch<Job[]>("/jobs");
        setJobs(data);
    }

    useEffect(() => {
        loadJobs();
    }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        await apiFetch("/jobs", {
            method: "POST",
            body: JSON.stringify({ title, description, must_have_criteria: mustHave }),
        });
        setOpen(false);
        setTitle(""); setDescription(""); setMustHave("");
        loadJobs();
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Jobs</h1>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger render={<Button />}>
                        + New Job
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Create Job</DialogTitle></DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <Label>Title</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            <div>
                                <Label>Must-have Criteria</Label>
                                <Input value={mustHave} onChange={(e) => setMustHave(e.target.value)} />
                            </div>
                            <Button type="submit" className="w-full">Create</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader><CardTitle>All Jobs</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jobs.map((job) => (
                                <TableRow key={job.id}>
                                    <TableCell>
                                        <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:underline">
                                            {job.title}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{job.status}</TableCell>
                                    <TableCell>{new Date(job.created_at).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}