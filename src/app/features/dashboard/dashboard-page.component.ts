import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { ActivityStoreService } from '../../core/state/activity-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { SuggestionStoreService } from '../../core/state/suggestion-store.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { Task } from '../../shared/models/task.models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink, MatRippleModule],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceContextService);
  readonly tasks = inject(TaskStoreService);
  readonly activities = inject(ActivityStoreService);
  readonly suggestions = inject(SuggestionStoreService);
  readonly members = inject(MemberDirectoryService);

  addQuickTask(): void {
    this.tasks.addQuickTask();
    void this.router.navigate(['/board']);
  }

  openTaskOnBoard(task: Task): void {
    this.tasks.selectTask(task);
    this.tasks.setBoardView('kanban');
    void this.router.navigate(['/board']);
  }
}
