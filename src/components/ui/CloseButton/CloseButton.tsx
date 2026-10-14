import "./CloseButton.css";
export default function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" className="dialog-close" aria-label={label} onClick={onClick}>
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  </button>;
}
