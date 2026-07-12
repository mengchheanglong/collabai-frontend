import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  activities as seedActivities,
  members,
  projects,
  suggestions as seedSuggestions,
  taskComments,
  tasks as seedTasks,
} from './mock-data';
import {
  Activity,
  BoardView,
  NavItem,
  PageKey,
  Priority,
  Suggestion,
  Task,
  TaskStatus,
  Workspace,
} from './app.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DragDropModule, MatRippleModule, MatTooltipModule, MatProgressBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly members = members;
  readonly projects = projects;
  readonly taskComments = taskComments;

  readonly workspaces = signal<Workspace[]>([
    { id: 'collabai', name: 'CollabAI Team', icon: 'C', accent: '#3b82f6', projectNames: ['CollabAI Platform'], description: 'Product sprint' },
    { id: 'school', name: 'School Project', icon: 'S', accent: '#22c55e', projectNames: ['School Management', 'Green Campus App'], description: 'Campus apps' },
    { id: 'marketing', name: 'Marketing', icon: 'M', accent: '#f59e0b', projectNames: ['Marketing Website'], description: 'Launch work' },
    { id: 'personal', name: 'Personal', icon: 'P', accent: '#06b6d4', projectNames: ['Research Assistant'], description: 'AI experiments' },
  ]);

  readonly pages: NavItem[] = [
    { key: 'dashboard', label: 'Home', icon: 'home' },
    { key: 'board', label: 'Board', icon: 'view_kanban' },
    { key: 'team', label: 'Team', icon: 'group' },
  ];

  readonly columns: Array<{ key: TaskStatus; label: string }> = [
    { key: 'todo', label: 'To Do' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Done' },
  ];

  readonly currentUser = members[0];

  currentPage = signal<PageKey>('dashboard');
  boardView = signal<BoardView>('kanban');
  selectedWorkspaceId = signal('collabai');
  isWorkspaceCreatorOpen = signal(false);
  newWorkspaceName = signal('');
  tasks = signal<Task[]>(structuredClone(seedTasks));
  selectedTask = signal<Task | null>(null);
  activities = signal<Activity[]>([...seedActivities]);
  suggestions = signal<Suggestion[]>(seedSuggestions.slice(0, 3));

  searchQuery = signal('');
  commentDraft = signal('');
  inviteEmail = signal('');
  inviteRole = signal('Member');

  isGeneratingSubtasks = signal(false);
  isImprovingDescription = signal(false);
  toast = signal<{ message: string; tone: 'success' | 'info' | 'ai' } | null>(null);

  activeWorkspace = computed(
    () => this.workspaces().find((w) => w.id === this.selectedWorkspaceId()) ?? this.workspaces()[0],
  );

  filteredProjects = computed(() =>
    this.projects.filter((p) => this.activeWorkspace().projectNames.includes(p.name)),
  );

  activeProjectName = computed(
    () => this.filteredProjects()[0]?.name ?? this.activeWorkspace().name,
  );

  workspaceTasks = computed(() =>
    this.tasks().filter((t) => this.activeWorkspace().projectNames.includes(t.project)),
  );

  totalTasks = computed(() => this.workspaceTasks().length);
  doneTasks = computed(() => this.workspaceTasks().filter((t) => t.status === 'done').length);
  inProgressTasks = computed(() => this.workspaceTasks().filter((t) => t.status === 'in_progress').length);
  completionRate = computed(() => Math.round((this.doneTasks() / Math.max(this.totalTasks(), 1)) * 100));

  filteredTasks = computed(() => {
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

  upcomingTasks = computed(() =>
    [...this.workspaceTasks()]
      .filter((t) => t.status !== 'done')
      .sort((a, b) => this.priorityRank(b.priority) - this.priorityRank(a.priority))
      .slice(0, 4),
  );

  selectedTaskComments = computed(() => {
    const task = this.selectedTask();
    if (!task) return [];
    return this.taskComments[task.id] ?? [];
  });

  setPage(page: PageKey): void {
    this.currentPage.set(page);
    if (page !== 'board') this.selectedTask.set(null);
  }

  setBoardView(view: BoardView): void {
    this.boardView.set(view);
    this.setPage('board');
  }

  selectWorkspace(workspaceId: string): void {
    this.selectedWorkspaceId.set(workspaceId);
    this.currentPage.set('dashboard');
    this.isWorkspaceCreatorOpen.set(false);
    this.searchQuery.set('');
    this.selectedTask.set(null);
  }

  toggleWorkspaceCreator(): void {
    this.isWorkspaceCreatorOpen.update((open) => !open);
  }

  addWorkspace(rawName = this.newWorkspaceName()): void {
    const name = rawName.trim();
    if (!name) return;
    const baseId =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `workspace-${this.workspaces().length + 1}`;
    const id = this.workspaces().some((w) => w.id === baseId)
      ? `${baseId}-${this.workspaces().length + 1}`
      : baseId;
    const accents = ['#3b82f6', '#22c55e', '#06b6d4', '#f59e0b', '#a78bfa'];
    this.workspaces.update((items) => [
      ...items,
      {
        id,
        name,
        icon: name[0].toUpperCase(),
        accent: accents[items.length % accents.length],
        projectNames: [],
        description: 'New workspace',
      },
    ]);
    this.newWorkspaceName.set('');
    this.selectWorkspace(id);
    this.showToast(`Created ${name}`, 'success');
  }

  openProfile(): void {
    this.currentPage.set('profile');
    this.isWorkspaceCreatorOpen.set(false);
  }

  tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter((task) => task.status === status);
  }

  statusLabel(status: TaskStatus): string {
    return this.columns.find((c) => c.key === status)?.label ?? status;
  }

  priorityClass(priority: Priority): string {
    return `priority-${priority}`;
  }

  selectTask(task: Task): void {
    this.selectedTask.set(task);
  }

  closeTask(): void {
    this.selectedTask.set(null);
  }

  openTaskOnBoard(task: Task): void {
    this.selectTask(task);
    this.setBoardView('kanban');
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
    this.showToast(`Moved to ${this.statusLabel(status)}`, 'info');
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
    this.selectedTask.set(this.tasks().find((item) => item.id === task.id) ?? null);
  }

  completedSubtasks(task: Task): number {
    return task.subtasks.filter((s) => s.done).length;
  }

  subtaskProgress(task: Task): number {
    return Math.round((this.completedSubtasks(task) / Math.max(task.subtasks.length, 1)) * 100);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  memberColor(name: string): string {
    return this.members.find((m) => m.name === name)?.color ?? '#3b82f6';
  }

  private priorityRank(priority: Priority): number {
    return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
  }

  showToast(message: string, tone: 'success' | 'info' | 'ai' = 'info'): void {
    this.toast.set({ message, tone });
    window.setTimeout(() => {
      if (this.toast()?.message === message) this.toast.set(null);
    }, 2400);
  }

  generateSubtasks(task: Task): void {
    if (this.isGeneratingSubtasks()) return;
    this.isGeneratingSubtasks.set(true);
    window.setTimeout(() => {
      const generated = [
        'Clarify acceptance criteria',
        'Implement core path',
        'Add tests and docs',
      ].filter((title) => !task.subtasks.some((s) => s.title === title));
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
      this.selectedTask.set(this.tasks().find((item) => item.id === task.id) ?? null);
      this.isGeneratingSubtasks.set(false);
      this.showToast('AI added subtasks', 'ai');
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
      this.selectedTask.set(this.tasks().find((item) => item.id === task.id) ?? null);
      this.isImprovingDescription.set(false);
      this.showToast('Description improved', 'ai');
    }, 700);
  }

  applySuggestion(suggestion: Suggestion): void {
    this.suggestions.update((items) => items.filter((s) => s.id !== suggestion.id));
    this.showToast(`Applied: ${suggestion.title}`, 'success');
  }

  postComment(task: Task): void {
    const body = this.commentDraft().trim();
    if (!body) return;
    const existing = this.taskComments[task.id] ?? [];
    this.taskComments[task.id] = [
      { author: this.currentUser.name, body, time: 'just now' },
      ...existing,
    ];
    this.tasks.update((items) =>
      items.map((item) => (item.id === task.id ? { ...item, comments: item.comments + 1 } : item)),
    );
    this.selectedTask.set(this.tasks().find((item) => item.id === task.id) ?? null);
    this.commentDraft.set('');
    this.showToast('Comment posted', 'success');
  }

  addQuickTask(): void {
    const id = `NEW-${100 + this.tasks().length}`;
    const task: Task = {
      id,
      title: 'Untitled task',
      description: 'Add a short description of the work.',
      status: 'todo',
      priority: 'medium',
      assignee: this.currentUser.name,
      reporter: this.currentUser.name,
      dueDate: 'TBD',
      project: this.activeProjectName(),
      tags: [],
      comments: 0,
      subtasks: [],
    };
    this.tasks.update((items) => [task, ...items]);
    this.selectTask(task);
    this.setBoardView('kanban');
    this.showToast('Task created', 'success');
  }

  sendInvite(): void {
    const email = this.inviteEmail().trim();
    if (!email) {
      this.showToast('Enter an email', 'info');
      return;
    }
    this.inviteEmail.set('');
    this.showToast(`Invite sent to ${email}`, 'success');
  }

  columnConnectedTo(): string[] {
    return this.columns.map((c) => `col-${c.key}`);
  }
}
