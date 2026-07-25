import { useEffect, useState } from "react";
import type { Priority, Task } from "../../domain/task/Task";
import type { TaskCategory } from "../../domain/task/taskCategory";
import { createTask, updateTask } from "../../domain/task/taskActions";
import type { BoardAction } from "../../hooks/useBoardReducer";

interface TaskFormProps {
  task?: Task | null;
  onClose: () => void;
  dispatch: React.Dispatch<BoardAction>;
  onSuccess: (message: string) => void;
}

export default function TaskForm({
  task,
  onClose,
  dispatch,
  onSuccess,
}: TaskFormProps) {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState<TaskCategory>("feature");
  const [error, setError] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setCategory(task.category);
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("feature");
    }

    setError("");
  }, [task]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setError("");

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }

    if (trimmedTitle.length < 3) {
      setError("Task title must be at least 3 characters long.");
      return;
    }

    if (trimmedTitle.length > 150) {
      setError("Task title cannot exceed 150 characters.");
      return;
    }

    if (!trimmedDescription) {
      setError("Task description is required.");
      return;
    }

    if (trimmedDescription.length > 300) {
      setError("Task description cannot exceed 300 characters.");
      return;
    }

    if (isEditing && task) {
      dispatch({
        type: "UPDATE_TASK",
        task: updateTask(
          task,
          trimmedTitle,
          trimmedDescription,
          priority,
          category,
        ),
      });

      onSuccess("Task updated successfully.");
    } else {
      dispatch({
        type: "CREATE_TASK",
        task: createTask(trimmedTitle, trimmedDescription, priority, category),
      });

      onSuccess("Task created successfully.");
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setCategory("feature");
    setError("");

    onClose();
  }

  return (
    <div className="create-task-modal">
      <form onSubmit={handleSubmit}>
        <h2>{isEditing ? "Edit Task" : "Create New Task"}</h2>

        {error && <p className="form-error">{error}</p>}

        <label htmlFor="task-title">Title</label>

        <input
          id="task-title"
          type="text"
          placeholder="Task title"
          maxLength={150}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <small className="character-count">{title.trim().length}/150</small>

        <label htmlFor="task-description">Description</label>

        <textarea
          id="task-description"
          placeholder="Task description"
          maxLength={300}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <small className="character-count">
          {description.trim().length}/300
        </small>

        <label htmlFor="task-priority">Priority</label>

        <select
          id="task-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <label htmlFor="task-category">Category</label>

        <select
          id="task-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as TaskCategory)}
        >
          <option value="feature">Feature</option>
          <option value="ui">UI</option>
          <option value="bug">Bug</option>
          <option value="testing">Testing</option>
          <option value="refactor">Refactor</option>
          <option value="devops">DevOps</option>
        </select>

        <div className="create-task-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>

          <button type="submit">
            {isEditing ? "Save Changes" : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
}
