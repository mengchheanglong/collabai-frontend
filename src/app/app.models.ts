export type PageKey = 'dashboard' | 'projects' | 'tasks' | 'team' | 'ai' | 'calendar' | 'reports' | 'settings';
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
}

export interface Project {
  id: string;
  name: string;
  team: string;
  progress: number;
  icon: string;
  accent: string;
  members: string[];
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
  title: string;
  body: string;
  category: 'Timeline' | 'Workload' | 'Tasks' | 'Risk' | 'Team';
  impact: 'High' | 'Medium' | 'Low';
  action: string;
}
