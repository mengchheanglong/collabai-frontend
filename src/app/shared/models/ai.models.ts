import type { Priority, Task, TaskStatus } from './task.models';

/** Matches backend AI-FEATURES / API-CONTRACT filter shape (MVP). */
export interface AiSearchFilters {
  text?: string;
  labels?: string[];
  status?: TaskStatus[];
  statusNot?: TaskStatus[];
  /** Backend may use 'urgent'; UI maps critical ↔ urgent for mock. */
  priority?: Array<Priority | 'urgent'>;
  dueRange?: 'today' | 'this_week' | 'overdue' | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
}

export interface AiSubtasksRequest {
  projectId?: string;
  title: string;
  description?: string;
  count?: number;
}

export interface AiSubtasksResponse {
  subtasks: string[];
}

export type AiDescriptionMode = 'generate' | 'improve' | 'shorten';

export interface AiDescriptionRequest {
  projectId?: string;
  title: string;
  mode: AiDescriptionMode;
  currentDescription?: string;
}

export interface AiDescriptionResponse {
  description: string;
}

export interface AiSummarizeCommentsRequest {
  taskId: string;
}

export interface AiSummarizeCommentsResponse {
  summary: string;
}

export interface AiSearchTasksRequest {
  projectId: string;
  query: string;
}

export interface AiSearchTasksResponse {
  interpretedQuery: AiSearchFilters;
  tasks: Task[];
}

export interface AiSearchChip {
  key: string;
  label: string;
  tone?: 'default' | 'brand' | 'amber' | 'red' | 'green' | 'purple';
}
