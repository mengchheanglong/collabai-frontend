import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Observable, concatMap, from, map, of, switchMap, throwError, toArray } from 'rxjs';
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
  /** Prevent an older board response from overwriting newer persisted task data. */
  private boardLoadVersion = 0;

  constructor() {
    effect(() => {
      const activeBoardId = this.workspace.activeBoardId();
      if (activeBoardId) {
        this.loadBoard(activeBoardId);
      } else {
        this.boardLoadVersion += 1;
        this.tasks.set([]);
        this.selectedTask.set(null);
        this.commentSummary.set(null);
        this.smartFilterIds.set(null);
        this.isLoading.set(false);
        this.hasError.set(false);
      }
    });
  }

  loadBoard(boardId: string): void {
    const loadVersion = ++this.boardLoadVersion;
    this.isLoading.set(true);
    this.hasError.set(false);
    this.boardApi.getBoardWithTasks(boardId).subscribe({
      next: (data) => {
        if (loadVersion !== this.boardLoadVersion) return;
        const mappedTasks: Task[] = (data.tasks || []).map((t) => ({
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
          labels: t.labels || [],
          comments: t.commentCount ?? 0,
          subtasks: (t.subtasks || []).map((s) => ({ id: s._id, title: s.title, done: s.done })),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));
        this.tasks.set(mappedTasks);
        const currentSelected = this.selectedTask();
        if (currentSelected) {
          const updatedSelected = mappedTasks.find((item) => item.id === currentSelected.id);
          this.selectedTask.set(updatedSelected ?? null);
        }
        this.isLoading.set(false);
      },
      error: () => {
        if (loadVersion !== this.boardLoadVersion) return;
        this.isLoading.set(false);
        this.hasError.set(true);
        this.toast.show('Failed to load board tasks', 'info');
      },
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
    return this.filteredTasks()
      .filter((task) => task.status === status)
      .sort((a, b) => a.position - b.position);
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
    if (!task) return;

    const isSameColumn = event.previousContainer === event.container;
    if (isSameColumn && event.previousIndex === event.currentIndex) {
      return; // No change
    }

    const currentList = this.tasksByStatus(status);
    let newPosition = task.position;

    // Remove task from list temporarily for calculation if same column
    const listWithoutTask = currentList.filter((t) => t.id !== task.id);

    const prevTask = listWithoutTask[event.currentIndex - 1];
    const nextTask = listWithoutTask[event.currentIndex];

    if (prevTask && nextTask) {
      newPosition = (prevTask.position + nextTask.position) / 2;
    } else if (prevTask) {
      newPosition = prevTask.position + 1024;
    } else if (nextTask) {
      newPosition = nextTask.position / 2;
    } else {
      newPosition = 1024;
    }

    this.tasks.update((items) =>
      items.map((item) => (item.id === task.id ? { ...item, status, position: newPosition } : item)),
    );
    this.selectedTask.update((selected) =>
      selected?.id === task.id ? { ...selected, status, position: newPosition } : selected,
    );

    // Status and position are intentionally handled by the dedicated move endpoint.
    this.taskApi.moveTask(task.id, status, newPosition).subscribe({
      error: () => {
        this.toast.show('Failed to update task status', 'info');
        const boardId = this.workspace.activeBoardId();
        if (boardId) this.loadBoard(boardId);
      },
    });

    if (!isSameColumn) {
      this.toast.show(`Moved to ${this.statusLabel(status)}`, 'info');
    }
  }

  toggleSubtask(task: Task, index: number): void {
    const updatedSubtasks = task.subtasks.map((subtask, i) =>
      i === index ? { ...subtask, done: !subtask.done } : subtask,
    );

    this.tasks.update((items) =>
      items.map((item) => {
        if (item.id !== task.id) return item;
        return { ...item, subtasks: updatedSubtasks };
      }),
    );
    this.refreshSelectedTask(task.id);

    const changedSubtask = updatedSubtasks[index];
    this.taskApi.updateSubtask(task.id, changedSubtask.id, { done: changedSubtask.done }).subscribe({
      error: () => {
        this.toast.show('Failed to update subtask', 'info');
        const boardId = this.workspace.activeBoardId();
        if (boardId) this.loadBoard(boardId);
      },
    });
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
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        count: 5,
      })
      .subscribe({
        next: ({ subtasks }) => {
          const list = subtasks || [];
          const generated = list
            .filter((title) => Boolean(title) && !task.subtasks.some((s) => s.title === title))
            .map((title) => ({ id: `new-${Date.now()}`, title, done: false }));
          if (!generated.length) {
            this.isGeneratingSubtasks.set(false);
            this.toast.show('No new subtasks to add', 'ai');
            return;
          }

          // The task update endpoint intentionally does not accept subtasks. Add each
          // generated item through the dedicated subtask endpoint so the result persists.
          from(generated)
            .pipe(
              concatMap((subtask) => this.taskApi.addSubtask(task.id, subtask.title)),
              toArray(),
            )
            .subscribe({
              next: (updatedTasks) => {
                const latest = updatedTasks.at(-1);
                if (latest) {
                  const mappedSubtasks = (latest.subtasks || []).map((subtask) => ({
                    id: subtask._id,
                    title: subtask.title,
                    done: subtask.done,
                  }));
                  this.tasks.update((items) =>
                    items.map((item) => (item.id === task.id ? { ...item, subtasks: mappedSubtasks } : item)),
                  );
                  this.refreshSelectedTask(task.id);
                }
                this.isGeneratingSubtasks.set(false);
                this.toast.show(`AI added ${generated.length} subtasks`, 'ai');
              },
              error: () => {
                this.isGeneratingSubtasks.set(false);
                this.toast.show('Could not save generated subtasks', 'info');
              },
            });
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
        projectId: task.projectId,
        title: task.title,
        mode: task.description?.trim() ? 'improve' : 'generate',
        currentDescription: task.description,
      })
      .subscribe({
        next: ({ description }) => {
          const desc = description || '';
          this.taskApi.updateTask(task.id, { description: desc }).subscribe({
            next: () => {
              this.tasks.update((items) =>
                items.map((item) => (item.id === task.id ? { ...item, description: desc } : item)),
              );
              this.refreshSelectedTask(task.id);
              this.isImprovingDescription.set(false);
              this.toast.show('Description improved', 'ai');
            },
            error: () => {
              this.isImprovingDescription.set(false);
              this.toast.show('Could not save the AI description', 'info');
            },
          });
        },
        error: () => {
          this.isImprovingDescription.set(false);
          this.toast.show('Could not improve description', 'info');
        },
      });
  }

  summarizeComments(task: Task): void {
    if (this.isSummarizingComments()) return;
    this.isSummarizingComments.set(true);
    this.ai.summarizeComments({ taskId: task.id }).subscribe({
      next: ({ summary }) => {
        this.commentSummary.set(summary || '');
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

  updateTask(
    taskId: string,
    patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assigneeId' | 'dueDate' | 'labels'>>,
  ): Task | null {
    const previousTask = this.tasks().find((item) => item.id === taskId) ?? null;
    let updatedTask: Task | null = null;
    this.tasks.update((items) =>
      items.map((item) => {
        if (item.id !== taskId) return item;
        updatedTask = { ...item, ...patch };
        return updatedTask;
      }),
    );

    if (updatedTask && this.selectedTask()?.id === taskId) {
      this.selectedTask.set(updatedTask);
    }

    const optimisticTask = this.tasks().find((item) => item.id === taskId) ?? null;
    if (!optimisticTask || !previousTask) return optimisticTask;

    const { status, ...editablePatch } = patch;
    const hasEditablePatch = Object.keys(editablePatch).length > 0;
    const save = status === undefined
      ? this.taskApi.updateTask(taskId, editablePatch)
      : this.taskApi.moveTask(taskId, status, optimisticTask.position).pipe(
          switchMap(() => (hasEditablePatch ? this.taskApi.updateTask(taskId, editablePatch) : of(null))),
        );

    save.subscribe({
      next: () => {
        this.toast.show('Saved changes', 'success');
      },
      error: () => {
        this.tasks.update((items) =>
          items.map((item) => (item.id === taskId ? previousTask : item)),
        );
        if (this.selectedTask()?.id === taskId) this.selectedTask.set(previousTask);
        const boardId = this.workspace.activeBoardId();
        if (boardId) this.loadBoard(boardId);
        this.toast.show('Failed to save task changes', 'info');
      },
    });
    return optimisticTask;
  }

  addManualSubtask(taskId: string, title: string): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    this.taskApi.addSubtask(taskId, cleanTitle).subscribe({
      next: (t) => {
        const subtasks = (t.subtasks || []).map((s) => ({
          id: s._id,
          title: s.title,
          done: s.done,
        }));
        this.tasks.update((items) =>
          items.map((item) => (item.id === taskId ? { ...item, subtasks } : item)),
        );
        this.refreshSelectedTask(taskId);
        this.toast.show('Subtask added', 'success');
      },
      error: () => {
        this.toast.show('Failed to add subtask', 'info');
      },
    });
  }

  addQuickTask(overrides?: { title?: string; assigneeId?: string | null }): void {
    const projectId = this.workspace.activeProjectId();
    const boardId = this.workspace.activeBoardId();
    if (!projectId || !boardId) {
      this.toast.show('No active board found', 'info');
      return;
    }

    this.taskApi.createTask(projectId, boardId, {
      title: overrides?.title || 'Untitled task',
      description: 'Add a short description of the work.',
      status: 'todo',
      priority: 'medium',
      assigneeId: overrides?.assigneeId ?? undefined,
    }).subscribe({
      next: (t) => {
        const task: Task = {
          id: t._id || (t as any).id,
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
          labels: t.labels || [],
          comments: t.commentCount ?? 0,
          subtasks: (t.subtasks || []).map((s) => ({ id: s._id || (s as any).id, title: s.title, done: s.done })),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
        this.tasks.update((items) => [task, ...items]);
        this.selectTask(task);
        this.setBoardView('kanban');
        this.loadBoard(boardId);
        this.toast.show('Task created', 'success');
      },
      error: () => {
        this.toast.show('Failed to create task', 'info');
      },
    });
  }

  /** Create a task requested by the Copilot and immediately add it to the active board. */
  createTaskFromAi(
    title: string,
    description: string,
    projectId?: string,
    boardId?: string,
    options?: {
      status?: TaskStatus;
      priority?: Priority;
      subtasks?: string[];
      labels?: string[];
      dueDate?: string;
      select?: boolean;
    },
  ): Observable<Task> {
    const targetProjectId = projectId ?? this.workspace.activeProjectId();
    const targetBoardId = boardId ?? this.workspace.activeBoardId();
    if (!targetProjectId || !targetBoardId) {
      return throwError(() => new Error('No active board found'));
    }

    return this.taskApi
      .createTask(targetProjectId, targetBoardId, {
        title,
        description,
        status: options?.status ?? 'todo',
        priority: options?.priority ?? 'medium',
        labels: options?.labels ?? [],
        subtasks: options?.subtasks ?? [],
        dueDate: options?.dueDate ?? undefined,
      })
      .pipe(
        map((dto) => {
          const task: Task = {
            id: dto._id || (dto as any).id,
            boardId: dto.boardId ?? null,
            projectId: dto.projectId,
            title: dto.title,
            description: dto.description ?? '',
            status: dto.status as TaskStatus,
            priority: dto.priority as Priority,
            position: dto.position,
            assigneeId: dto.assigneeId ?? null,
            createdById: dto.createdById,
            dueDate: dto.dueDate ?? null,
            labels: dto.labels || [],
            comments: dto.commentCount ?? 0,
            subtasks: (dto.subtasks || []).map((subtask) => ({
              id: subtask._id || (subtask as any).id,
              title: subtask.title,
              done: subtask.done,
            })),
            createdAt: dto.createdAt,
            updatedAt: dto.updatedAt,
          };
          this.tasks.update((items) => [task, ...items]);
          if (options?.select !== false) {
            this.selectTask(task);
          }
          this.setBoardView('kanban');
          // Reconcile with the API after the committed create. This also supersedes any
          // in-flight board request that started before the task existed.
          this.loadBoard(targetBoardId);
          return task;
        }),
      );
  }

  deleteTask(taskId: string): void {
    // Optimistic UI delete
    this.tasks.update((items) => items.filter((item) => item.id !== taskId));
    this.smartFilterIds.update((ids) => (ids ? ids.filter((id) => id !== taskId) : null));
    if (this.selectedTask()?.id === taskId) {
      this.closeTask();
    }

    // API Call
    this.taskApi.deleteTask(taskId).subscribe({
      next: () => this.toast.show('Task deleted', 'success'),
      error: () => {
        this.toast.show('Failed to delete task', 'info');
        // Re-load board on rollback
        const boardId = this.workspace.activeBoardId();
        if (boardId) this.loadBoard(boardId);
      },
    });
  }
}
