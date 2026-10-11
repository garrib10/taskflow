import { useEffect, useRef, useState, type ReactNode } from "react";
import { useModalFocus } from "../../accessibility/useModalFocus";
import Button from "../ui/Button/Button";
import "./BoardToolbar.css";

interface BoardToolbarProps {
  search: ReactNode;
  filters: ReactNode;
  filterCount: number;
  activeCriteria: boolean;
  onReset: () => void;
  resultSummary: ReactNode;
  ordering?: ReactNode;
  capacity?: ReactNode;
}

export default function BoardToolbar({ search, filters, filterCount, activeCriteria, onReset, resultSummary, ordering, capacity }: BoardToolbarProps) {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.("(max-width: 600px)").matches ?? false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 600px)");
    if (!media) return;
    const update = () => { setNarrow(media.matches); if (!media.matches) setOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <>
      <div className="board-toolbar" role="search" aria-label="Search and filter tasks">
        <div className={`toolbar-controls${ordering ? " toolbar-controls-with-order" : ""}`}>
          {search}
          {narrow ? <Button variant="secondary" className="toolbar-filter-trigger" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? "board-filter-sheet" : undefined} onClick={() => setOpen(true)}>Filters ({filterCount})</Button> : filters}
          {ordering && <div className="toolbar-ordering">{ordering}</div>}
          <Button variant="secondary" onClick={onReset} disabled={!activeCriteria}>Reset</Button>
        </div>
        <div className="toolbar-context">{!(narrow && open) && resultSummary}{capacity}</div>
      </div>
      {narrow && open && (
        <FilterSheet filters={filters} resultSummary={resultSummary} activeCriteria={activeCriteria} onReset={onReset} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** Mount per opening so the shared modal hook owns the current dialog element. */
function FilterSheet({ filters, resultSummary, activeCriteria, onReset, onClose }: Pick<BoardToolbarProps, "filters" | "resultSummary" | "activeCriteria" | "onReset"> & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);
  function clearInSheet() {
    onReset();
    // Search is inert behind this modal; keep immediate changes and focus local.
    dialogRef.current?.querySelector<HTMLSelectElement>("select")?.focus();
  }
  return (
    <div className="toolbar-filter-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} id="board-filter-sheet" className="toolbar-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="board-filter-title" aria-describedby="board-filter-help" tabIndex={-1}>
        <h2 id="board-filter-title" tabIndex={-1} data-initial-focus>Filter tasks</h2>
        <p id="board-filter-help">Changes apply immediately. Done keeps your current search and filters.</p>
        {filters}
        <div className="toolbar-sheet-summary">{resultSummary}</div>
        <div className="toolbar-sheet-actions">
          <Button variant="secondary" onClick={clearInSheet} disabled={!activeCriteria}>Clear all criteria</Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
