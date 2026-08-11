// src/app/core/api/task-api.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TaskDto, ObjectIdString } from './api.types';
import { ApiClient } from './api-client.service';
import { TaskStatus, Priority } from '../../shared/models/task.models';

@Injectable({
  providedIn: 'root',
})
export class TaskApiService {
  private apiClient = inject(ApiClient);

  createTask(projectId: string, boardId: string, payload: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    position?: number;
    assigneeId?: ObjectIdString;
    dueDate?: string;
    labels?: string[];
  }): Observable<TaskDto> {
    return this.apiClient.post<TaskDto>(`/tasks`, { projectId, boardId, ...payload });
  }

  updateTask(taskId: string, payload: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: Priority;
    position: number;
    assigneeId: string | null;
    dueDate: string | null;
    labels: string[];
    subtasks: { id?: string; title: string; done: boolean }[];
  }>): Observable<TaskDto> {
    return this.apiClient.patch<TaskDto>(`/tasks/${taskId}`, payload);
  }

  deleteTask(taskId: string): Observable<void> {
    return this.apiClient.delete<void>(`/tasks/${taskId}`);
  }
}
