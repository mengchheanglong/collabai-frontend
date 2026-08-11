// src/app/core/api/task-api.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
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
    return this.apiClient
      .post<{ task: TaskDto }>(`/tasks`, { projectId, boardId, ...payload })
      .pipe(map(({ task }) => task));
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
    return this.apiClient
      .patch<{ task: TaskDto }>(`/tasks/${taskId}`, payload)
      .pipe(map(({ task }) => task));
  }

  deleteTask(taskId: string): Observable<void> {
    return this.apiClient.delete<void>(`/tasks/${taskId}`);
  }
}
