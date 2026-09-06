"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Briefcase, LogOut, PhoneCall } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show navbar on login page
  if (pathname === "/login") return null;

  function handleLogout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/jobs" className="flex items-center gap-2 font-bold text-slate-900 hover:opacity-90 transition">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <PhoneCall className="h-5 w-5" />
            </div>
            <span className="text-lg tracking-tight font-semibold text-slate-900">
              AI Hiring Assistant
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/jobs"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                pathname?.startsWith("/jobs")
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              Jobs
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-slate-600 hover:text-red-600 hover:bg-red-50 gap-1.5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
