import type { ReactNode } from "react";
import Button from "../ui/Button/Button";
import "./AppShell.css";

interface AppShellProps {
  lastUpdated: Date;
  onCreateTask: () => void;
  feedback: ReactNode;
  toolbar: ReactNode;
  overlays: ReactNode;
  children: ReactNode;
}

/** Page structure only. Board operations and dialog lifecycle stay with their owners. */
export default function AppShell({ lastUpdated, onCreateTask, feedback, toolbar, overlays, children }: AppShellProps) {
  const updated = lastUpdated.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
  return (
    <div className="app-shell">
      <header className="app-shell-header">
        <div className="app-shell-identity">
          <h1>TaskFlow</h1>
          <p>Rule-Based Workflow Board</p>
          <p className="last-updated">Last updated: <time dateTime={lastUpdated.toISOString()}>{updated}</time></p>
        </div>
        <Button className="shell-create-task" data-focus-fallback onClick={onCreateTask}>+ Create Task</Button>
      </header>
      <main className="app-shell-main" aria-label="Task board">
        <div className="app-shell-feedback">{feedback}</div>
        {toolbar}
        <div className="app-shell-board">{children}</div>
      </main>
      {/* Fixed modal layers have no transformed/clipped ancestor. #45 owns future details. */}
      <div className="app-shell-overlays">{overlays}</div>
    </div>
  );
}
