import { Injectable, computed, inject, signal } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { tasks as seedTasks } from '../../data/mock/mock-tasks';
import { BOARD_COLUMNS, columnConnectedIds, statusLabel } from '../../shared/lib/board-columns';
import { priorityClass, priorityRank } from '../../shared/lib/person-display';
import type { BoardView } from '../../shared/models/navigation.models';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';
import { ToastService } from '../toast/toast.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { MemberDirectoryService } from './member-directory.service';

@Injectable({ providedIn: 'root' })
export class TaskStoreService {
  private readonly toast = inject(ToastService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly members = inject(MemberDirectoryService);

  readonly columns = BOARD_COLUMNS;
  readonly tasks = signal<Task[]>(structuredClone(seedTasks));
  readonly selectedTask = signal<Task | null>(null);
  readonly boardView = signal<BoardView>('kanban');
  readonly searchQuery = signal('');
  readonly isGeneratingSubtasks = signal(false);
  readonly isImprovingDescription = signal(false);

  readonly workspaceTasks = computed(() =>
    this.tasks().filter((t) => this.workspace.activeWorkspace().projectNames.includes(t.project)),
  );

  readonly totalTasks = computed(() => this.workspaceTasks().length);
  readonly doneTasks = computed(() => this.workspaceTasks().filter((t) => t.status === 'done').length);
  readonly inProgressTasks = computed(
    () => this.workspaceTasks().filter((t) => t.status === 'in_progress').length,
  );
  readonly completionRate = computed(() =>
    Math.round((this.doneTasks() / Math.max(this.totalTasks(), 1)) * 100),
  );

  readonly filteredTasks = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.workspaceTasks();
    return this.workspaceTasks().filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        task.id.toLowerCase().includes(q) ||
        task.assignee.toLowerCase().includes(q) ||
        task.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  });

  readonly upcomingTasks = computed(() =>
    [...this.workspaceTasks()]
      .filter((t) => t.status !== 'done')
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
      .slice(0, 4),
  );

  clearUiState(): void {
    this.searchQuery.set('');
    this.selectedTask.set(null);
  }

  setBoardView(view: BoardView): void {
    this.boardView.set(view);
  }

  tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter((task) => task.status === status);
  }

  statusLabel(status: TaskStatus): string {
    return statusLabel(status);
  }

  priorityClass(priority: Priority): string {
    return priorityClass(priority);
  }

  columnConnectedTo(): string[] {
    return columnConnectedIds();
  }

  selectTask(task: Task): void {
    this.selectedTask.set(task);
  }

  closeTask(): void {
    this.selectedTask.set(null);
  }

  refreshSelectedTask(taskId: string): void {
    this.selectedTask.set(this.tasks().find((item) => item.id === taskId) ?? null);
  }

  drop(event: CdkDragDrop<Task[]>, status: TaskStatus): void {
    const task = event.item.data as Task;
    if (!task || task.status === status) return;

    this.tasks.update((items) =>
      items.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );
    this.selectedTask.update((selected) =>
      selected?.id === task.id ? { ...selected, status } : selected,
    );
    this.toast.show(`Moved to ${this.statusLabel(status)}`, 'info');
  }

  toggleSubtask(task: Task, index: number): void {
    this.tasks.update((items) =>
      items.map((item) => {
        if (item.id !== task.id) return item;
        const subtasks = item.subtasks.map((subtask, i) =>
          i === index ? { ...subtask, done: !subtask.done } : subtask,
        );
        return { ...item, subtasks };
      }),
    );
    this.refreshSelectedTask(task.id);
  }

  completedSubtasks(task: Task): number {
    return task.subtasks.filter((s) => s.done).length;
  }

  subtaskProgress(task: Task): number {
    return Math.round((this.completedSubtasks(task) / Math.max(task.subtasks.length, 1)) * 100);
  }

  generateSubtasks(task: Task): void {
    if (this.isGeneratingSubtasks()) return;
    this.isGeneratingSubtasks.set(true);
    window.setTimeout(() => {
      const generated = ['Clarify acceptance criteria', 'Implement core path', 'Add tests and docs'].filter(
        (title) => !task.subtasks.some((s) => s.title === title),
      );
      this.tasks.update((items) =>
        items.map((item) =>
          item.id === task.id
            ? {
                ...item,
                subtasks: [
                  ...item.subtasks,
                  ...generated.slice(0, 3).map((title) => ({ title, done: false })),
                ],
              }
            : item,
        ),
      );
      this.refreshSelectedTask(task.id);
      this.isGeneratingSubtasks.set(false);
      this.toast.show('AI added subtasks', 'ai');
    }, 900);
  }

  improveDescription(task: Task): void {
    if (this.isImprovingDescription()) return;
    this.isImprovingDescription.set(true);
    window.setTimeout(() => {
      const improved = `${task.description}\n\nOutcome: ship a clear, testable change that matches the API contract.`;
      this.tasks.update((items) =>
        items.map((item) => (item.id === task.id ? { ...item, description: improved } : item)),
      );
      this.refreshSelectedTask(task.id);
      this.isImprovingDescription.set(false);
      this.toast.show('Description improved', 'ai');
    }, 700);
  }

  incrementCommentCount(taskId: string): void {
    this.tasks.update((items) =>
      items.map((item) => (item.id === taskId ? { ...item, comments: item.comments + 1 } : item)),
    );
    this.refreshSelectedTask(taskId);
  }

  addQuickTask(): Task {
    const id = `NEW-${100 + this.tasks().length}`;
    const task: Task = {
      id,
      title: 'Untitled task',
      description: 'Add a short description of the work.',
      status: 'todo',
      priority: 'medium',
      assignee: this.members.currentUser.name,
      reporter: this.members.currentUser.name,
      dueDate: 'TBD',
      project: this.workspace.activeProjectName(),
      tags: [],
      comments: 0,
      subtasks: [],
    };
    this.tasks.update((items) => [task, ...items]);
    this.selectTask(task);
    this.setBoardView('kanban');
    this.toast.show('Task created', 'success');
    return task;
  }
}
