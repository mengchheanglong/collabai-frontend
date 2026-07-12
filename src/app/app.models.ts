export type PageKey = 'dashboard' | 'board' | 'team' | 'profile';
export type BoardView = 'kanban' | 'list';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member' | 'Viewer';
  avatar: string;
  status: 'Active' | 'Away' | 'Offline';
  projects: number;
  joined: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  team: string;
  progress: number;
  icon: string;
  accent: string;
  members: string[];
  description?: string;
}

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

export interface Activity {
  actor: string;
  text: string;
  time: string;
  type: 'task' | 'ai' | 'comment' | 'project';
}

export interface Suggestion {
  id: string;
  title: string;
  body: string;
  category: 'Timeline' | 'Workload' | 'Tasks' | 'Risk' | 'Team';
  impact: 'High' | 'Medium' | 'Low';
  action: string;
}

export interface CommentPreview {
  author: string;
  body: string;
  time: string;
}

export interface NavItem {
  key: PageKey;
  label: string;
  icon: string;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  accent: string;
  projectNames: string[];
  description: string;
}
