import type { Priority, Task, TaskStatus } from './task.models';

/** Matches backend AI-FEATURES / API-CONTRACT filter shape (MVP). */
export interface AiSearchFilters {
  text?: string;
  labels?: string[];
  status?: TaskStatus[];
  statusNot?: TaskStatus[];
  priority?: Priority[];
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
  tone?: 'default' | 'brand' | 'amber' | 'red' | 'green' | 'cyan';
}

export interface StructuredTask {
  title: string;
  description: string;
  subtasks: string[];
  status?: TaskStatus;
  priority?: Priority;
  labels?: string[];
  dueDate?: string;
}

export interface GenerateTasksRequest {
  projectId: string;
  prompt: string;
  count?: number;
}

export interface GenerateTasksResponse {
  tasks: StructuredTask[];
}

export interface ChatMessageDto {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  projectId?: string;
  history?: ChatMessageDto[];
}

export interface ChatResponse {
  reply: string;
}

export interface ProjectInsightsResponse {
  projectId: string;
  projectName: string;
  generatedAt: string;
  source: 'ai' | 'fallback';
  recommendations: Array<{
    title: string;
    rationale: string;
    urgency: 'high' | 'medium' | 'low';
    action: 'review_task' | 'balance_workload' | 'plan';
    taskIds: string[];
  }>;
}

export interface AiTaskAction {
  id: string;
  taskId: string;
  taskTitle: string;
  rationale: string;
  previous: { status: string; priority: string; assigneeId: string | null; dueDate: string | null };
  changes: { status?: string; priority?: string; assigneeId?: string | null; dueDate?: string | null };
}

export interface AiTaskActionPlan {
  id: string;
  projectId: string;
  request: string;
  actions: AiTaskAction[];
  source: 'ai' | 'fallback';
  status: 'pending' | 'applied';
  expiresAt: string;
}
