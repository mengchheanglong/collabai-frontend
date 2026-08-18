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
    subtasks?: string[];
  }): Observable<TaskDto> {
    return this.apiClient
      .post<any>(`/tasks`, { projectId, boardId, ...payload })
      .pipe(map((res) => res?.task || res));
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
  }>): Observable<TaskDto> {
    return this.apiClient
      .patch<any>(`/tasks/${taskId}`, payload)
      .pipe(map((res) => res?.task || res));
  }

  moveTask(taskId: string, status: TaskStatus, position: number): Observable<TaskDto> {
    return this.apiClient
      .patch<any>(`/tasks/${taskId}/status`, { status, position })
      .pipe(map((res) => res?.task || res));
  }

  addSubtask(taskId: string, title: string): Observable<TaskDto> {
    return this.apiClient
      .post<any>(`/tasks/${taskId}/subtasks`, { title })
      .pipe(map((res) => res?.task || res));
  }

  updateSubtask(taskId: string, subtaskId: string, payload: { title?: string; done?: boolean }): Observable<TaskDto> {
    return this.apiClient
      .patch<any>(`/tasks/${taskId}/subtasks/${subtaskId}`, payload)
      .pipe(map((res) => res?.task || res));
  }

  deleteTask(taskId: string): Observable<void> {
    return this.apiClient.delete<void>(`/tasks/${taskId}`);
  }
}
