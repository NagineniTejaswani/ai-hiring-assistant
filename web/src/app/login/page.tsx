"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { PhoneCall, Lock, Mail, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      router.push("/jobs");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200/90 shadow-sm bg-white">
        <CardHeader className="space-y-2 text-center pb-6 border-b border-slate-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm mb-2">
            <PhoneCall className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            AI Hiring Assistant
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Sign in to your recruiter portal to manage jobs and AI screenings
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="recruiter@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="focus-visible:ring-indigo-600 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus-visible:ring-indigo-600 text-sm"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm gap-2 mt-2 shadow-xs"
            >
              {loading ? (
                <LoadingSpinner size="sm" text="Signing in..." className="flex-row text-white" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Sign In to Dashboard
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
