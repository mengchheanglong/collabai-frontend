import { Injectable, computed, inject, signal } from '@angular/core';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { AnalyticsApiService } from '../api/analytics-api.service';
import type { ProjectAnalyticsSummaryDto, ProjectAnalyticsBurndownDto } from '../api/api.types';

@Injectable({ providedIn: 'root' })
export class AnalyticsStoreService {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly workspace = inject(WorkspaceContextService);

  readonly summary = signal<ProjectAnalyticsSummaryDto | null>(null);
  readonly burndown = signal<ProjectAnalyticsBurndownDto[]>([]);
  readonly isLoading = signal(false);

  readonly totalTasks = computed(() => this.summary()?.totalTasks ?? 0);
  readonly completionRate = computed(() => this.summary()?.completionRate ?? 0);
  readonly completedTasks = computed(() => this.summary()?.completedTasks ?? 0);
  readonly inProgressTasks = computed(() => this.summary()?.inProgressTasks ?? 0);
  readonly todoTasks = computed(() => this.summary()?.todoTasks ?? 0);
  readonly overdueTasks = computed(() => this.summary()?.overdueTasks ?? 0);

  loadForProject(projectId: string): void {
    if (!projectId) return;
    this.isLoading.set(true);
    this.analyticsApi.getSummary(projectId).subscribe({
      next: (data: ProjectAnalyticsSummaryDto) => {
        this.summary.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
    this.analyticsApi.getBurndown(projectId).subscribe({
      next: (data: ProjectAnalyticsBurndownDto[]) => this.burndown.set(data),
    });
  }
}
