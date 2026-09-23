import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from './api-client.service';

export interface ActivityDto {
  _id?: string;
  id?: string;
  projectId: string;
  actorId: string;
  actor: { _id: string; name: string; email: string };
  type: string;
  entityType: string;
  entityId?: string;
  message: string;
  details?: { previous: unknown[]; applied: unknown[] };
  createdAt: string;
}

export interface ActivityListDto {
  items: ActivityDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class ActivityApiService {
  private readonly apiClient = inject(ApiClient);

  getProjectActivity(projectId: string, page = 1, limit = 30): Observable<ActivityDto[]> {
    return this.apiClient.get<ActivityListDto>(
      `/projects/${projectId}/activity`,
      { page, limit },
    ).pipe(map(({ items }) => (items ?? []).map((item) => ({ ...item, _id: item._id ?? item.id }))));
  }
}
