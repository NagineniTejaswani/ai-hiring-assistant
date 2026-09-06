import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ text, size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-10 w-10",
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-600 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-indigo-600`} />
      {text && <p className="text-sm font-medium text-slate-600 animate-pulse">{text}</p>}
    </div>
  );
}

export function PageLoader({ text = "Loading data..." }: { text?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-white border border-slate-100 shadow-sm max-w-xs w-full">
        <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-700">{text}</p>
      </div>
    </div>
  );
}
