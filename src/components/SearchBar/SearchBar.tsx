interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export default function SearchBar({
  searchTerm,
  onSearchChange,
}: SearchBarProps) {
  return (
    <div className="search-bar">
      <label htmlFor="task-search">Search:</label>

      <div className="search-input-wrapper">
        <span className="search-icon" aria-hidden="true">
          🔍
        </span>

        <input
          id="task-search"
          type="search"
          placeholder="Search by title or description..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  );
}
