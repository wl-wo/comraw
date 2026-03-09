import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

function loadStoredTasks(): TaskItem[] {
  try {
    const stored = localStorage.getItem("wo-desktop-tasks");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load tasks:", e);
  }
  return [];
}

export function Tasks() {
  const [tasks, setTasks] = useState<TaskItem[]>(loadStoredTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Save tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("wo-desktop-tasks", JSON.stringify(tasks));
    } catch (e) {
      console.error("Failed to save tasks:", e);
    }
  }, [tasks]);

  const addTask = () => {
    if (newTaskTitle.trim()) {
      const task: TaskItem = {
        id: Date.now().toString(),
        title: newTaskTitle.trim(),
        completed: false,
        createdAt: Date.now(),
      };
      setTasks([...tasks, task]);
      setNewTaskTitle("");
    }
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className={`wo-tasks-widget ${isExpanded ? "expanded" : ""}`}>
      <div className="wo-tasks-header" onClick={() => setIsExpanded(!isExpanded)}>
        <Icon icon="mdi:check-circle" className="wo-tasks-icon" />
        <div className="wo-tasks-title">Tasks</div>
        <div className="wo-tasks-count">
          {completedCount}/{tasks.length}
        </div>
        <Icon
          icon={isExpanded ? "mdi:chevron-up" : "mdi:chevron-down"}
          className="wo-tasks-toggle"
        />
      </div>

      {isExpanded && (
        <div className="wo-tasks-content">
          <div className="wo-tasks-input-group">
            <input
              type="text"
              className="wo-tasks-input"
              placeholder="Add a task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addTask();
                }
              }}
            />
            <button
              className="wo-tasks-add-btn"
              onClick={addTask}
              title="Add task"
              aria-label="Add task"
            >
              <Icon icon="mdi:plus" />
            </button>
          </div>

          <div className="wo-tasks-list">
            {tasks.length === 0 ? (
              <div className="wo-tasks-empty">No tasks yet</div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`wo-task-item ${task.completed ? "completed" : ""}`}
                >
                  <button
                    className="wo-task-checkbox"
                    onClick={() => toggleTask(task.id)}
                    aria-label={`Toggle task: ${task.title}`}
                  >
                    <Icon
                      icon={
                        task.completed ? "mdi:checkbox-marked" : "mdi:checkbox-blank-outline"
                      }
                    />
                  </button>
                  <span className="wo-task-title">{task.title}</span>
                  <button
                    className="wo-task-delete"
                    onClick={() => deleteTask(task.id)}
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <Icon icon="mdi:trash-can-outline" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
