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
  private requestedProjectId: string | null = null;

  readonly totalTasks = computed(() => this.summary()?.totalTasks ?? 0);
  readonly completionRate = computed(() => this.summary()?.completionRate ?? 0);
  readonly completedTasks = computed(() => this.summary()?.completedTasks ?? 0);
  readonly inProgressTasks = computed(() => this.summary()?.inProgressTasks ?? 0);
  readonly todoTasks = computed(() => this.summary()?.todoTasks ?? 0);
  readonly overdueTasks = computed(() => this.summary()?.overdueTasks ?? 0);

  loadForProject(projectId: string): void {
    if (!projectId) {
      this.requestedProjectId = null;
      this.summary.set(null);
      this.burndown.set([]);
      this.isLoading.set(false);
      return;
    }
    // Clear the previous project's numbers immediately and ignore late responses
    // for a project that is no longer the one being shown.
    this.requestedProjectId = projectId;
    this.summary.set(null);
    this.burndown.set([]);
    this.isLoading.set(true);
    const isCurrent = () => this.requestedProjectId === projectId;
    this.analyticsApi.getSummary(projectId).subscribe({
      next: (data: ProjectAnalyticsSummaryDto) => {
        if (!isCurrent()) return;
        this.summary.set(data);
        this.isLoading.set(false);
      },
      error: () => {
        if (!isCurrent()) return;
        this.summary.set(null);
        this.isLoading.set(false);
      },
    });
    this.analyticsApi.getBurndown(projectId).subscribe({
      next: (data: ProjectAnalyticsBurndownDto[]) => {
        if (isCurrent()) this.burndown.set(data || []);
      },
      error: () => {
        if (isCurrent()) this.burndown.set([]);
      },
    });
  }
}
