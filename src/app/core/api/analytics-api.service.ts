import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { ProjectAnalyticsSummaryDto, ProjectAnalyticsBurndownDto } from './api.types';
import { IndexedDbService } from '../pwa/indexed-db.service';
import { withOfflineCopy } from '../pwa/offline-copy';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly apiClient = inject(ApiClient);
  private readonly idb = inject(IndexedDbService);

  getSummary(projectId: string): Observable<ProjectAnalyticsSummaryDto> {
    return this.apiClient
      .get<ProjectAnalyticsSummaryDto>(`/projects/${projectId}/analytics/summary`)
      .pipe(withOfflineCopy(this.idb, `analytics-summary:${projectId}`));
  }

  getBurndown(projectId: string): Observable<ProjectAnalyticsBurndownDto[]> {
    return this.apiClient
      .get<ProjectAnalyticsBurndownDto[]>(`/projects/${projectId}/analytics/burndown`)
      .pipe(withOfflineCopy(this.idb, `analytics-burndown:${projectId}`));
  }
}
