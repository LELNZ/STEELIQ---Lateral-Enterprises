import { type ReactNode, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";

interface PageShellProps {
  children: ReactNode;
  testId?: string;
}

export function PageShell({ children, testId }: PageShellProps) {
  return (
    <div className="flex flex-col h-full bg-background" data-testid={testId}>
      {children}
    </div>
  );
}

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  titleTestId?: string;
  testId?: string;
}

export function PageHeader({ icon, title, subtitle, badge, actions, titleTestId, testId }: PageHeaderProps) {
  return (
    <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0 flex-wrap" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight" data-testid={titleTestId}>{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground leading-tight">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

interface WorklistBodyProps {
  children: ReactNode;
  className?: string;
}

export function WorklistBody({ children, className }: WorklistBodyProps) {
  return (
    <div className={`flex-1 overflow-auto p-4 sm:p-6 ${className ?? ""}`}>
      {children}
    </div>
  );
}

interface SettingsBodyProps {
  children: ReactNode;
  className?: string;
}

export function SettingsBody({ children, className }: SettingsBodyProps) {
  return (
    <div className={`flex-1 overflow-auto p-4 sm:p-6 ${className ?? ""}`}>
      <div className="max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  );
}

interface SettingsFormGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
}

export function useDemoToggle() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showDemo, setShowDemo] = useState(false);
  const queryParam = isAdmin && showDemo ? "showDemo=true" : "";
  const toggle = useCallback(() => setShowDemo(v => !v), []);
  return { isAdmin, showDemo, queryParam, toggle };
}

export function DemoToggle({ showDemo, onToggle }: { showDemo: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
        showDemo
          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
          : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
      }`}
      data-testid="toggle-show-demo"
    >
      <span className={`inline-block w-2 h-2 rounded-full ${showDemo ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
      {showDemo ? "Demo visible" : "Demo hidden"}
    </button>
  );
}

export function SettingsFormGrid({ children, columns = 2, className }: SettingsFormGridProps) {
  const colClass = columns === 3
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    : columns === 2
      ? "grid grid-cols-1 md:grid-cols-2 gap-4"
      : "space-y-4";
  return (
    <div className={`${colClass} ${className ?? ""}`}>
      {children}
    </div>
  );
}
