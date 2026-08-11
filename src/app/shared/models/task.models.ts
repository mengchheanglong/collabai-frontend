export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  boardId: string | null;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  position: number;
  assigneeId: string | null;
  createdById: string;
  dueDate: string | null;
  labels: string[];
  comments: number;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}
