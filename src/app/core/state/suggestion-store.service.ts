// Project-aware AI recommendations come from POST /ai/project-insights.
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Suggestion } from '../../shared/models/suggestion.models';
import { AiService } from '../api/ai.service';
import type { ProjectInsightsResponse } from '../../shared/models/ai.models';
import { finalize } from 'rxjs';
import { ToastService } from '../toast/toast.service';
import { TaskStoreService } from './task-store.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';

@Injectable({ providedIn: 'root' })
export class SuggestionStoreService {
  private readonly toast = inject(ToastService);
  private readonly tasks = inject(TaskStoreService);
  private readonly router = inject(Router);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly ai = inject(AiService);

  private readonly recommendations = signal<Suggestion[]>([]);
  readonly dismissed = signal<string[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal(false);
  readonly source = signal<'ai' | 'fallback' | null>(null);
  readonly suggestions = computed(() => this.recommendations().filter((s) => !this.dismissed().includes(s.id)));
  readonly nextTaskIds = computed(() => [...new Set(this.suggestions().flatMap((item) => item.taskIds ?? []))]);

  constructor() {
    effect(() => {
      const projectId = this.workspace.activeProjectId();
      this.dismissed.set([]);
      this.recommendations.set([]);
      this.error.set(false);
      this.source.set(null);
      if (!projectId) { this.isLoading.set(false); return; }
      this.isLoading.set(true);
      this.ai.projectInsights(projectId).subscribe({
        next: (response) => {
          if (this.workspace.activeProjectId() !== projectId) return;
          this.recommendations.set(response.recommendations.map((item, index) => mapRecommendation(projectId, item, index)));
          this.source.set(response.source);
          this.error.set(false);
          this.isLoading.set(false);
        },
        error: () => {
          if (this.workspace.activeProjectId() !== projectId) return;
          this.error.set(true);
          this.isLoading.set(false);
        },
      });
    });
  }

  refresh(): void {
    const projectId = this.workspace.activeProjectId();
    if (!projectId) return;
    this.isLoading.set(true);
    this.error.set(false);
    this.source.set(null);
    this.ai.projectInsights(projectId).pipe(finalize(() => this.isLoading.set(false))).subscribe({
      next: (response) => {
        if (this.workspace.activeProjectId() !== projectId) return;
        this.recommendations.set(response.recommendations.map((item, index) => mapRecommendation(projectId, item, index)));
        this.source.set(response.source);
      },
      error: () => { if (this.workspace.activeProjectId() === projectId) this.error.set(true); },
    });
  }

  applySuggestion(suggestion: Suggestion): void {
    this.dismissed.update((ids) => [...ids, suggestion.id]);
    if (suggestion.category === 'Workload') {
      void this.router.navigate(['/team']);
      return;
    }
    const taskId = suggestion.taskIds?.[0];
    const task = taskId ? this.tasks.tasks().find((item) => item.id === taskId) : undefined;
    if (task) {
      this.tasks.selectTask(task);
      void this.router.navigate(['/board']);
      return;
    }
    this.tasks.searchQuery.set(suggestion.category === 'Risk' ? 'overdue' : '');
    void this.router.navigate(['/board']);
    this.toast.show(`Opened the board for: ${suggestion.title}`, 'ai');
  }

  dismissSuggestion(suggestion: Suggestion): void {
    this.dismissed.update((ids) => [...ids, suggestion.id]);
  }
}

function mapRecommendation(projectId: string, item: ProjectInsightsResponse['recommendations'][number], index: number): Suggestion {
  return {
    id: `${projectId}:${index}:${item.title}`,
    title: item.title,
    body: item.rationale,
    category: item.action === 'balance_workload' ? 'Workload' : item.action === 'review_task' ? 'Risk' : 'Timeline',
    impact: item.urgency === 'high' ? 'High' : item.urgency === 'medium' ? 'Medium' : 'Low',
    action: item.action === 'balance_workload' ? 'Review team' : item.taskIds.length ? 'Open task' : 'Review plan',
    taskIds: item.taskIds,
  };
}
