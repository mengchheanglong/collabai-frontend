import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { ProjectAnalyticsSummaryDto, ProjectAnalyticsBurndownDto } from './api.types';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly apiClient = inject(ApiClient);

  getSummary(projectId: string): Observable<ProjectAnalyticsSummaryDto> {
    return this.apiClient.get<ProjectAnalyticsSummaryDto>(`/projects/${projectId}/analytics/summary`);
  }

  getBurndown(projectId: string): Observable<ProjectAnalyticsBurndownDto[]> {
    return this.apiClient.get<ProjectAnalyticsBurndownDto[]>(`/projects/${projectId}/analytics/burndown`);
  }
}
