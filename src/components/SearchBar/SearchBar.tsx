import { useRef } from "react";
import Button from "../ui/Button/Button";
import "./SearchBar.css";
interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export default function SearchBar({ searchTerm, onSearchChange }: SearchBarProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="search-bar">
      <label htmlFor="task-search">Search tasks</label>
      <div className="search-input-wrapper">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />
        </svg>
        <input ref={input} id="task-search" type="search" aria-controls="taskflow-board"
          placeholder="Search titles and descriptions" value={searchTerm}
          onChange={event => onSearchChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Escape" && !event.nativeEvent.isComposing) {
              event.preventDefault(); event.stopPropagation();
              if (searchTerm) onSearchChange("");
            }
          }} />
        {searchTerm.length > 0 && <Button variant="secondary" className="search-clear" aria-label="Clear search"
          onClick={() => { onSearchChange(""); input.current?.focus(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </Button>}
      </div>
    </div>
  );
}
