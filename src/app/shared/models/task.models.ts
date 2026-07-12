export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Subtask {
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  reporter: string;
  dueDate: string;
  project: string;
  tags: string[];
  comments: number;
  subtasks: Subtask[];
}
