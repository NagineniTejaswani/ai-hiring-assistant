import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-3 shadow-xs">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
