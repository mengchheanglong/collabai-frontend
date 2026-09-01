import { Component, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
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
    MatMenuModule,
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

  assigneeLabel(id: string): string {
    if (!id) return 'Unassigned';
    return this.members.members().find((m) => m.id === id)?.name || 'Unassigned';
  }

  formatDueDateLabel(dueDate?: string | null): string {
    if (!dueDate) return 'No due date';
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) return 'No due date';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  isDateToday(dueDate?: string | null): boolean {
    if (!dueDate) return false;
    const date = new Date(dueDate);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  isDateTomorrow(dueDate?: string | null): boolean {
    if (!dueDate) return false;
    const date = new Date(dueDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate()
    );
  }

  setDatePreset(preset: 'today' | 'tomorrow' | 'next_week'): void {
    const d = new Date();
    if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (preset === 'next_week') {
      d.setDate(d.getDate() + 7);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    this.newDueDate.set(dateStr);
  }

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
