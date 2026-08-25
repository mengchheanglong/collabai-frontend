import { Component, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { AuthStoreService } from '../../core/state/auth-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { BoardView } from '../../shared/models/navigation.models';
import type { Priority, TaskStatus } from '../../shared/models/task.models';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';
import { KanbanBoardComponent } from './kanban-board.component';
import { TaskDetailDrawerComponent } from './task-detail-drawer.component';
import { TaskListViewComponent } from './task-list-view.component';

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [
    DatePipe,
    TitleCasePipe,
    MatRippleModule,
    KanbanBoardComponent,
    TaskListViewComponent,
    TaskDetailDrawerComponent,
    ThemeToggleComponent,
  ],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
})
export class BoardPageComponent {
  readonly workspace = inject(WorkspaceContextService);
  readonly tasks = inject(TaskStoreService);
  readonly members = inject(MemberDirectoryService);
  private readonly auth = inject(AuthStoreService);
  private readonly toast = inject(ToastService);

  readonly currentDate = signal(new Date());

  /** Placeholder shapes for the loading state, mirroring the real column layout. */
  readonly skeletonColumns = [0, 1, 2];
  readonly skeletonCards = [0, 1, 2];

  // ── Create Task Dialog State ──
  readonly showCreateModal = signal(false);
  readonly newTitle = signal('');
  readonly newDescription = signal('');
  readonly newPriority = signal<Priority>('medium');
  readonly newAssigneeId = signal<string>('');
  readonly newDueDate = signal<string>('');
  readonly newStatus = signal<TaskStatus>('todo');
  readonly isCreatingTask = signal(false);

  readonly priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
  readonly statuses: TaskStatus[] = ['todo', 'in_progress', 'done'];

  setBoardView(view: BoardView): void {
    this.tasks.setBoardView(view);
  }

  openCreateModal(): void {
    const user = this.auth.currentUser();
    const myId = user ? (user._id || (user as any).id || '') : '';
    this.newTitle.set('');
    this.newDescription.set('');
    this.newPriority.set('medium');
    this.newAssigneeId.set(myId);
    this.newDueDate.set('');
    this.newStatus.set('todo');
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  submitCreateTask(): void {
    const title = this.newTitle().trim();
    if (!title) {
      this.toast.show('Please enter a task title', 'info');
      return;
    }

    const projectId = this.workspace.activeProjectId();
    const boardId = this.workspace.activeBoardId();
    if (!projectId || !boardId) {
      this.toast.show('No active board found', 'info');
      return;
    }

    this.isCreatingTask.set(true);
    const dueDateVal = this.newDueDate() ? new Date(this.newDueDate()).toISOString() : undefined;
    const assigneeVal = this.newAssigneeId() || undefined;

    this.tasks
      .createTaskFromAi(title, this.newDescription().trim(), projectId, boardId, {
        status: this.newStatus(),
        priority: this.newPriority(),
        assigneeId: assigneeVal,
        dueDate: dueDateVal,
        select: true,
      })
      .subscribe({
        next: (created) => {
          this.isCreatingTask.set(false);
          this.showCreateModal.set(false);
          this.toast.show(`Created task: ${created.title}`, 'success');
        },
        error: () => {
          this.isCreatingTask.set(false);
          this.toast.show('Failed to create task. Please try again.', 'info');
        },
      });
  }

  onFilterInput(value: string): void {
    this.tasks.clearSmartSearch();
    this.tasks.searchQuery.set(value);
  }

  clearAiFilter(): void {
    this.tasks.clearSmartSearch();
    this.tasks.searchQuery.set('');
  }

  reloadBoard(): void {
    const boardId = this.workspace.activeBoardId();
    if (boardId) this.tasks.loadBoard(boardId);
  }

  openProjectCreator(): void {
    this.workspace.isWorkspaceCreatorOpen.set(true);
  }
}
