import "./FilterControls.css";
import type {
  PriorityFilter,
  CategoryFilter,
  StatusFilter,
} from "../../domain/board/boardFilters";
import { isTaskStatus } from "../../utils/typeGuards";

interface FilterControlsProps {
  priorityFilter: PriorityFilter;
  categoryFilter: CategoryFilter;
  statusFilter: StatusFilter;
  onPriorityChange: (value: PriorityFilter) => void;
  onCategoryChange: (value: CategoryFilter) => void;
  onStatusChange: (value: StatusFilter) => void;
}

export default function FilterControls({
  priorityFilter,
  categoryFilter,
  statusFilter,
  onPriorityChange,
  onCategoryChange,
  onStatusChange,
}: FilterControlsProps) {
  return (
    <div className="filter-controls">
      <div className="filter-group">
        <label htmlFor="priority-filter">Priority</label>

        <select
          aria-controls="taskflow-board"
          id="priority-filter"
          value={priorityFilter}
          onChange={(event) =>
            onPriorityChange(event.target.value as PriorityFilter)
          }
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="category-filter">Category</label>

        <select
          aria-controls="taskflow-board"
          id="category-filter"
          value={categoryFilter}
          onChange={(event) =>
            onCategoryChange(event.target.value as CategoryFilter)
          }
        >
          <option value="all">All categories</option>
          <option value="feature">Feature</option>
          <option value="ui">UI</option>
          <option value="bug">Bug</option>
          <option value="testing">Testing</option>
          <option value="refactor">Refactor</option>
          <option value="devops">DevOps</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="status-filter">Status</label>

        <select
          aria-controls="taskflow-board"
          id="status-filter"
          value={statusFilter}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "all" || isTaskStatus(value)) {
              onStatusChange(value);
            }
          }}
        >
          <option value="all">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="in-review">In Review</option>
          <option value="done">Done</option>
        </select>
      </div>
    </div>
  );
}
