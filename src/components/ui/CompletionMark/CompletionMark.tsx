import "./CompletionMark.css";
export default function CompletionMark({ complete }: { complete: boolean }) {
  return <span className={`completion-mark${complete ? " is-complete" : ""}`} role="img" aria-label={complete ? "Completed subtask" : "Incomplete subtask"}>
    {complete && <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </span>;
}
