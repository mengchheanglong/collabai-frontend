import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { TaskDto } from './api.types';
import type {
  AiDescriptionRequest,
  AiDescriptionResponse,
  AiSearchFilters,
  AiSearchTasksRequest,
  AiSearchTasksResponse,
  AiSubtasksRequest,
  AiSubtasksResponse,
  AiSummarizeCommentsRequest,
  AiSummarizeCommentsResponse,
  ChatRequest,
  ChatResponse,
  GenerateTasksRequest,
  GenerateTasksResponse,
} from '../../shared/models/ai.models';
import type { Task } from '../../shared/models/task.models';

/**
 * Contract-aligned AI client. Provider keys remain on the backend and API failures
 * deliberately reach the UI rather than being replaced with client-side mock data.
 */
@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly apiClient = inject(ApiClient);

  generateSubtasks(body: AiSubtasksRequest): Observable<AiSubtasksResponse> {
    return this.apiClient.post<AiSubtasksResponse>('/ai/subtasks', body);
  }

  generateDescription(body: AiDescriptionRequest): Observable<AiDescriptionResponse> {
    return this.apiClient.post<AiDescriptionResponse>('/ai/description', body);
  }

  generateTasks(body: GenerateTasksRequest): Observable<GenerateTasksResponse> {
    return this.apiClient.post<GenerateTasksResponse>('/ai/generate-tasks', body);
  }

  summarizeComments(body: AiSummarizeCommentsRequest): Observable<AiSummarizeCommentsResponse> {
    // The backend validates task access and loads the comment thread itself.
    return this.apiClient.post<AiSummarizeCommentsResponse>('/ai/summarize-comments', body);
  }

  searchTasks(body: AiSearchTasksRequest): Observable<AiSearchTasksResponse> {
    return this.apiClient
      .post<{ interpretedQuery: AiSearchFilters; tasks: TaskDto[] }>('/ai/search-tasks', body)
      .pipe(
        map(({ interpretedQuery, tasks }) => ({
          interpretedQuery: interpretedQuery || {},
          tasks: (tasks || []).map(toTask),
        })),
      );
  }

  chat(body: ChatRequest): Observable<ChatResponse> {
    return this.apiClient.post<ChatResponse>('/ai/chat', body);
  }
}

/** Maps the API DTO to the UI task model used by the copilot and board. */
function toTask(task: TaskDto): Task {
  return {
    id: task._id || (task as any).id,
    boardId: task.boardId ?? null,
    projectId: task.projectId,
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    position: task.position,
    assigneeId: task.assigneeId ?? null,
    createdById: task.createdById,
    dueDate: task.dueDate ?? null,
    labels: task.labels || [],
    comments: task.commentCount ?? 0,
    subtasks: (task.subtasks || []).map((subtask) => ({
      id: subtask._id || (subtask as any).id,
      title: subtask.title,
      done: subtask.done,
    })),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
