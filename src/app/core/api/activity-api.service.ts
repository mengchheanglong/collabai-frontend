import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client.service';

export interface ActivityDto {
  _id: string;
  projectId: string;
  actorId: string;
  actor: { _id: string; name: string; email: string };
  type: string;
  entityType: string;
  entityId?: string;
  message: string;
  createdAt: string;
}

export interface ActivityListDto {
  data: ActivityDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class ActivityApiService {
  private readonly apiClient = inject(ApiClient);

  getProjectActivity(projectId: string, page = 1, limit = 30): Observable<ActivityDto[]> {
    return this.apiClient.get<ActivityDto[]>(
      `/projects/${projectId}/activity`,
      { page, limit },
    );
  }
}
