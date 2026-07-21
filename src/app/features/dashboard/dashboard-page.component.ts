import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivityStoreService } from '../../core/state/activity-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { SuggestionStoreService } from '../../core/state/suggestion-store.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { Suggestion } from '../../shared/models/suggestion.models';
import type { Task } from '../../shared/models/task.models';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { SmartSearchComponent } from '../ai/smart-search.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    RouterLink,
    MatRippleModule,
    MatProgressBarModule,
    MatTooltipModule,
    SmartSearchComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceContextService);
  readonly tasks = inject(TaskStoreService);
  readonly activities = inject(ActivityStoreService);
  readonly suggestions = inject(SuggestionStoreService);
  readonly members = inject(MemberDirectoryService);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly reviewTasks = computed(
    () => this.tasks.workspaceTasks().filter((t) => t.status === 'review').length,
  );

  readonly highPriorityOpen = computed(
    () =>
      this.tasks
        .workspaceTasks()
        .filter((t) => t.status !== 'done' && (t.priority === 'high' || t.priority === 'critical'))
        .length,
  );

  readonly recentActivities = computed(() => this.activities.activities().slice(0, 6));

  addQuickTask(): void {
    this.tasks.addQuickTask();
    void this.router.navigate(['/board']);
  }

  openTaskOnBoard(task: Task): void {
    this.tasks.selectTask(task);
    this.tasks.setBoardView('kanban');
    void this.router.navigate(['/board']);
  }

  openBoard(): void {
    void this.router.navigate(['/board']);
  }

  impactClass(impact: Suggestion['impact']): string {
    return `impact-${impact.toLowerCase()}`;
  }

  categoryIcon(category: Suggestion['category']): string {
    const map: Record<Suggestion['category'], string> = {
      Timeline: 'schedule',
      Workload: 'group',
      Tasks: 'account_tree',
      Risk: 'warning',
      Team: 'handshake',
    };
    return map[category] ?? 'auto_awesome';
  }
}
