import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useModalFocus } from "../../accessibility/useModalFocus";
import Button from "../ui/Button/Button";
import "./BoardToolbar.css";

export interface ActiveCondition { id: string; label: string; focusId?: string; onRemove: () => void; }
interface BoardToolbarProps {
  search: ReactNode;
  filters: ReactNode;
  filterCount: number;
  activeCriteria: boolean;
  activeConditions?: ActiveCondition[];
  onReset: () => void;
  resultSummary: ReactNode;
  ordering?: ReactNode;
  orderingHelp?: ReactNode;
}

export default function BoardToolbar({ search, filters, filterCount, activeCriteria, activeConditions = [], onReset, resultSummary, ordering, orderingHelp }: BoardToolbarProps) {
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
          <div className="toolbar-filter-row">
            {narrow ? <Button variant="secondary" className="toolbar-filter-trigger" id="board-filter-trigger" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? "board-filter-sheet" : undefined} onClick={() => setOpen(true)}>Filters ({filterCount})</Button> : filters}
          </div>
          {ordering && <div className="toolbar-ordering">{ordering}</div>}
        </div>
        <ActiveConditions conditions={activeConditions} />
        <div className="toolbar-context">{!(narrow && open) && resultSummary}{orderingHelp}
          <Button variant="secondary" className="toolbar-clear-all" aria-label="Clear all search and filters" onClick={onReset} disabled={!activeCriteria}>Clear all</Button>
        </div>
      </div>
      {narrow && open && (
        <FilterSheet filters={filters} resultSummary={resultSummary} searchCondition={activeConditions.find(condition => condition.id === "search")?.label} activeCriteria={activeCriteria} onReset={onReset} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ActiveConditions({ conditions }: { conditions: ActiveCondition[] }) {
  const list = useRef<HTMLUListElement>(null);
  const removed = useRef<{ index: number; focusId?: string } | null>(null);
  useLayoutEffect(() => {
    if (removed.current === null) return;
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("button");
    const next = buttons?.[Math.min(removed.current.index, buttons.length - 1)];
    const fallback = document.getElementById(removed.current.focusId ?? "") ?? document.getElementById("board-filter-trigger") ?? document.getElementById("task-search");
    (next ?? fallback)?.focus();
    removed.current = null;
  });
  // Keep the owner mounted when the last condition disappears, so focus can return to the corresponding control.
  return conditions.length > 0 ? <ul ref={list} className="toolbar-active-conditions" aria-label="Active search and filters">
    {conditions.map((condition, index) => <li key={condition.id}><Button variant="secondary" aria-label={`Remove ${condition.label}`} title={`Remove ${condition.label}`}
      onClick={() => { removed.current = { index, focusId: condition.focusId }; condition.onRemove(); }}><span>{condition.label}</span><span aria-hidden="true">×</span></Button></li>)}
  </ul> : null;
}

/** Visible counts update immediately; assistive feedback waits for a short pause in input. */
export function BoardResults({ total, matching, filtered }: { total: number; matching: number; filtered: boolean }) {
  const summary = filtered ? `Showing ${matching} of ${total} tasks` : `${total} ${total === 1 ? "task" : "tasks"} on board`;
  const [announcement, setAnnouncement] = useState(summary);
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnouncement(summary), 300);
    return () => window.clearTimeout(timer);
  }, [summary]);
  return <><p className="toolbar-result-count" aria-hidden="true">{summary}</p><span className="visually-hidden" role="status" aria-label="Search results" aria-atomic="true">{announcement}</span></>;
}

/** Mount per opening so the shared modal hook owns the current dialog element. */
function FilterSheet({ filters, resultSummary, searchCondition, activeCriteria, onReset, onClose }: Pick<BoardToolbarProps, "filters" | "resultSummary" | "activeCriteria" | "onReset"> & { searchCondition?: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef, onClose);
  function clearInSheet() {
    onReset();
    // Search is inert behind this modal; keep immediate changes and focus local.
    dialogRef.current?.querySelector<HTMLSelectElement>("#priority-filter")?.focus();
  }
  return (
    <div className="toolbar-filter-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} id="board-filter-sheet" className="toolbar-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="board-filter-title" aria-describedby="board-filter-help" tabIndex={-1}>
        <h2 id="board-filter-title" tabIndex={-1} data-initial-focus>Filter tasks</h2>
        <p id="board-filter-help">Changes apply immediately.</p>
        {searchCondition && <p className="toolbar-sheet-search">{searchCondition}</p>}
        {filters}
        <div className="toolbar-sheet-summary">{resultSummary}</div>
        <div className="toolbar-sheet-actions">
          <Button variant="secondary" aria-label="Clear all search and filters" onClick={clearInSheet} disabled={!activeCriteria}>Clear all</Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
