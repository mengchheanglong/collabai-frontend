import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { BOARD_COLUMNS, columnConnectedIds, statusLabel } from '../../shared/lib/board-columns';
import { priorityClass, priorityRank } from '../../shared/lib/person-display';
import type { BoardView } from '../../shared/models/navigation.models';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';
import { AiService } from '../api/ai.service';
import { BoardApiService } from '../api/board-api.service';
import { TaskApiService } from '../api/task-api.service';
import { ToastService } from '../toast/toast.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { MemberDirectoryService } from './member-directory.service';

@Injectable({ providedIn: 'root' })
export class TaskStoreService {
  private readonly toast = inject(ToastService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly members = inject(MemberDirectoryService);
  private readonly ai = inject(AiService);
  private readonly boardApi = inject(BoardApiService);
  private readonly taskApi = inject(TaskApiService);

  readonly columns = BOARD_COLUMNS;
  readonly tasks = signal<Task[]>([]);
  readonly selectedTask = signal<Task | null>(null);
  readonly boardView = signal<BoardView>('kanban');
  readonly searchQuery = signal('');
  
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  /** When set, board only shows these task ids (AI smart search). */
  readonly smartFilterIds = signal<string[] | null>(null);
  readonly isGeneratingSubtasks = signal(false);
  readonly isImprovingDescription = signal(false);
  readonly isSummarizingComments = signal(false);
  readonly commentSummary = signal<string | null>(null);

  constructor() {
    effect(() => {
      const activeBoardId = this.workspace.activeBoardId();
      if (activeBoardId) {
        this.loadBoard(activeBoardId);
      } else {
        this.tasks.set([]);
      }
    });
  }

  loadBoard(boardId: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.boardApi.getBoardWithTasks(boardId).subscribe({
      next: (data) => {
        const mappedTasks: Task[] = data.tasks.map(t => ({
          id: t._id,
          boardId: t.boardId ?? null,
          projectId: t.projectId,
          title: t.title,
          description: t.description ?? '',
          status: t.status as TaskStatus,
          priority: t.priority as Priority,
          position: t.position,
          assigneeId: t.assigneeId ?? null,
          createdById: t.createdById,
          dueDate: t.dueDate ?? null,
          labels: t.labels,
          comments: t.commentCount,
          subtasks: t.subtasks.map(s => ({ id: s._id, title: s.title, done: s.done })),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));
        this.tasks.set(mappedTasks);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasError.set(true);
        this.toast.show('Failed to load board tasks', 'info');
      }
    });
  }

  readonly totalTasks = computed(() => this.tasks().length);
  readonly doneTasks = computed(() => this.tasks().filter((t) => t.status === 'done').length);
  readonly inProgressTasks = computed(
    () => this.tasks().filter((t) => t.status === 'in_progress').length,
  );
  readonly completionRate = computed(() =>
    Math.round((this.doneTasks() / Math.max(this.totalTasks(), 1)) * 100),
  );

  readonly filteredTasks = computed(() => {
    let list = this.tasks();
    const smartIds = this.smartFilterIds();
    if (smartIds) {
      const set = new Set(smartIds);
      list = list.filter((task) => set.has(task.id));
    }

    const q = this.searchQuery().trim().toLowerCase();
    if (!q || smartIds) return list;

    return list.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        task.id.toLowerCase().includes(q) ||
        (task.assigneeId && task.assigneeId.toLowerCase().includes(q)) ||
        task.labels.some((tag) => tag.toLowerCase().includes(q)),
    );
  });

  readonly upcomingTasks = computed(() =>
    [...this.tasks()]
      .filter((t) => t.status !== 'done')
      .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
      .slice(0, 4),
  );

  clearUiState(): void {
    this.searchQuery.set('');
    this.smartFilterIds.set(null);
    this.selectedTask.set(null);
    this.commentSummary.set(null);
  }

  applySmartSearchResults(taskIds: string[], queryLabel = ''): void {
    this.smartFilterIds.set(taskIds);
    if (queryLabel) this.searchQuery.set(queryLabel);
  }

  clearSmartSearch(): void {
    this.smartFilterIds.set(null);
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
    this.commentSummary.set(null);
  }

  closeTask(): void {
    this.selectedTask.set(null);
    this.commentSummary.set(null);
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
    
    // API update
    this.taskApi.updateTask(task.id, { status }).subscribe({
      error: () => this.toast.show('Failed to update task status', 'info')
    });
    
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
    this.ai
      .generateSubtasks({
        title: task.title,
        description: task.description,
        count: 5,
      })
      .subscribe({
        next: ({ subtasks }) => {
          const generated = subtasks
            .filter((title) => !task.subtasks.some((s) => s.title === title))
            .map((title) => ({ id: `new-${Date.now()}`, title, done: false }));
          this.tasks.update((items) =>
            items.map((item) =>
              item.id === task.id
                ? { ...item, subtasks: [...item.subtasks, ...generated] }
                : item,
            ),
          );
          this.refreshSelectedTask(task.id);
          this.isGeneratingSubtasks.set(false);
          this.toast.show(
            generated.length ? `AI added ${generated.length} subtasks` : 'No new subtasks to add',
            'ai',
          );
        },
        error: () => {
          this.isGeneratingSubtasks.set(false);
          this.toast.show('Could not generate subtasks', 'info');
        },
      });
  }

  improveDescription(task: Task): void {
    if (this.isImprovingDescription()) return;
    this.isImprovingDescription.set(true);
    this.ai
      .generateDescription({
        title: task.title,
        mode: task.description?.trim() ? 'improve' : 'generate',
        currentDescription: task.description,
      })
      .subscribe({
        next: ({ description }) => {
          this.tasks.update((items) =>
            items.map((item) => (item.id === task.id ? { ...item, description } : item)),
          );
          this.taskApi.updateTask(task.id, { description }).subscribe();
          this.refreshSelectedTask(task.id);
          this.isImprovingDescription.set(false);
          this.toast.show('Description improved', 'ai');
        },
        error: () => {
          this.isImprovingDescription.set(false);
          this.toast.show('Could not improve description', 'info');
        },
      });
  }

  summarizeComments(task: Task, comments: { author: string; body: string; time: string }[] = []): void {
    if (this.isSummarizingComments()) return;
    this.isSummarizingComments.set(true);
    this.ai.summarizeComments({ taskId: task.id }, comments).subscribe({
      next: ({ summary }) => {
        this.commentSummary.set(summary);
        this.isSummarizingComments.set(false);
        this.toast.show('Discussion summarized', 'ai');
      },
      error: () => {
        this.isSummarizingComments.set(false);
        this.toast.show('Could not summarize comments', 'info');
      },
    });
  }

  clearCommentSummary(): void {
    this.commentSummary.set(null);
  }

  incrementCommentCount(taskId: string): void {
    this.tasks.update((items) =>
      items.map((item) => (item.id === taskId ? { ...item, comments: item.comments + 1 } : item)),
    );
    this.refreshSelectedTask(taskId);
  }

  addQuickTask(): void {
    const projectId = this.workspace.activeProjectId();
    const boardId = this.workspace.activeBoardId();
    if (!projectId || !boardId) {
      this.toast.show('No active board found', 'info');
      return;
    }

    this.taskApi.createTask(projectId, boardId, {
      title: 'Untitled task',
      description: 'Add a short description of the work.',
      status: 'todo',
      priority: 'medium',
    }).subscribe({
      next: (t) => {
        const task: Task = {
          id: t._id,
          boardId: t.boardId ?? null,
          projectId: t.projectId,
          title: t.title,
          description: t.description ?? '',
          status: t.status as TaskStatus,
          priority: t.priority as Priority,
          position: t.position,
          assigneeId: t.assigneeId ?? null,
          createdById: t.createdById,
          dueDate: t.dueDate ?? null,
          labels: t.labels,
          comments: t.commentCount,
          subtasks: [],
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
        this.tasks.update((items) => [task, ...items]);
        this.selectTask(task);
        this.setBoardView('kanban');
        this.toast.show('Task created', 'success');
      },
      error: () => {
        this.toast.show('Failed to create task', 'info');
      }
    });
  }
}
