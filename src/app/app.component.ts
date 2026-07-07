import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatRippleModule } from '@angular/material/core';
import { activities, members, projects, tasks as seedTasks } from './mock-data';
import { PageKey, Priority, Task, TaskStatus } from './app.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DragDropModule, MatRippleModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly members = members;
  readonly projects = projects;
  readonly activities = activities;

  readonly workspaces = signal<Array<{ id: string; name: string; icon: string; accent: string; projectNames: string[]; description: string }>>([
    { id: 'collabai', name: 'CollabAI Team', icon: 'C', accent: '#8a6cff', projectNames: ['CollabAI Platform'], description: 'Product sprint workspace' },
    { id: 'school', name: 'School Project', icon: 'S', accent: '#2fd39b', projectNames: ['School Management', 'Green Campus App'], description: 'Education and campus apps' },
    { id: 'marketing', name: 'Marketing Team', icon: 'M', accent: '#f3b95f', projectNames: ['Marketing Website'], description: 'Campaigns and launch work' },
    { id: 'personal', name: 'Personal', icon: 'P', accent: '#67a7ff', projectNames: ['Research Assistant'], description: 'Personal AI experiments' },
  ]);
  readonly pages: Array<{ key: PageKey; label: string; icon: string; badge?: string }> = [
    { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
    { key: 'projects', label: 'Projects', icon: '□' },
    { key: 'tasks', label: 'Tasks', icon: '☷' },
    { key: 'team', label: 'Team', icon: '♟' },
  ];
  readonly columns: Array<{ key: TaskStatus; label: string; tone: string }> = [
    { key: 'todo', label: 'To Do', tone: 'muted' },
    { key: 'in_progress', label: 'In Progress', tone: 'blue' },
    { key: 'review', label: 'Review', tone: 'orange' },
    { key: 'done', label: 'Done', tone: 'green' },
  ];

  currentPage = signal<PageKey>('dashboard');
  selectedWorkspaceId = signal('collabai');
  isWorkspaceCreatorOpen = signal(false);
  newWorkspaceName = signal('');
  tasks = signal<Task[]>(seedTasks);
  selectedTask = signal<Task | null>(seedTasks[0]);

  activeWorkspace = computed(() => this.workspaces().find((workspace) => workspace.id === this.selectedWorkspaceId()) ?? this.workspaces()[0]);
  filteredProjects = computed(() => this.projects.filter((project) => this.activeWorkspace().projectNames.includes(project.name)));
  activeProjectName = computed(() => this.filteredProjects()[0]?.name ?? this.activeWorkspace().name);
  workspaceTasks = computed(() => this.tasks().filter((task) => this.activeWorkspace().projectNames.includes(task.project)));
  totalTasks = computed(() => this.workspaceTasks().length);
  doneTasks = computed(() => this.workspaceTasks().filter((task) => task.status === 'done').length);
  inProgressTasks = computed(() => this.workspaceTasks().filter((task) => task.status === 'in_progress').length);
  completionRate = computed(() => Math.round((this.doneTasks() / Math.max(this.totalTasks(), 1)) * 100));
  filteredTasks = computed(() => this.workspaceTasks());

  setPage(page: PageKey): void {
    this.currentPage.set(page);
    if (page === 'projects' && !this.selectedTask()) this.selectedTask.set(this.workspaceTasks()[0] ?? null);
  }

  selectWorkspace(workspaceId: string): void {
    this.selectedWorkspaceId.set(workspaceId);
    this.currentPage.set('dashboard');
    this.isWorkspaceCreatorOpen.set(false);
    this.selectedTask.set(this.workspaceTasks()[0] ?? null);
  }

  toggleWorkspaceCreator(): void {
    this.isWorkspaceCreatorOpen.update((isOpen) => !isOpen);
  }

  openWorkspaceCreator(): void {
    this.isWorkspaceCreatorOpen.set(true);
  }

  addWorkspace(rawName = this.newWorkspaceName()): void {
    const name = rawName.trim();
    if (!name) return;
    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `workspace-${this.workspaces().length + 1}`;
    const id = this.workspaces().some((workspace) => workspace.id === baseId) ? `${baseId}-${this.workspaces().length + 1}` : baseId;
    const workspace = { id, name, icon: name[0].toUpperCase(), accent: '#8a6cff', projectNames: [], description: 'New workspace' };
    this.workspaces.update((items) => [...items, workspace]);
    this.newWorkspaceName.set('');
    this.selectWorkspace(id);
  }

  openProfile(): void {
    this.currentPage.set('profile');
    this.isWorkspaceCreatorOpen.set(false);
  }

  tasksByStatus(status: TaskStatus): Task[] {
    return this.filteredTasks().filter((task) => task.status === status);
  }

  statusLabel(status: TaskStatus): string {
    return this.columns.find((column) => column.key === status)?.label ?? status;
  }

  priorityClass(priority: Priority): string {
    return `priority-${priority}`;
  }

  selectTask(task: Task): void {
    this.selectedTask.set(task);
  }

  drop(event: CdkDragDrop<Task[]>, status: TaskStatus): void {
    const task = event.item.data as Task;
    if (!task) return;
    this.tasks.update((items) => {
      const copy = [...items];
      const currentIndex = copy.findIndex((item) => item.id === task.id);
      if (currentIndex === -1) return items;
      copy[currentIndex] = { ...copy[currentIndex], status };
      if (event.previousContainer === event.container) {
        const sameStatus = copy.filter((item) => item.status === status);
        moveItemInArray(sameStatus, event.previousIndex, event.currentIndex);
      }
      return copy;
    });
    this.selectedTask.update((selected) => selected?.id === task.id ? { ...selected, status } : selected);
  }

  toggleSubtask(task: Task, index: number): void {
    this.tasks.update((items) => items.map((item) => {
      if (item.id !== task.id) return item;
      const subtasks = item.subtasks.map((subtask, i) => i === index ? { ...subtask, done: !subtask.done } : subtask);
      return { ...item, subtasks };
    }));
    const updated = this.tasks().find((item) => item.id === task.id) ?? null;
    this.selectedTask.set(updated);
  }

  completedSubtasks(task: Task): number {
    return task.subtasks.filter((item) => item.done).length;
  }

  subtaskProgress(task: Task): number {
    return Math.round((this.completedSubtasks(task) / Math.max(task.subtasks.length, 1)) * 100);
  }

  initials(name: string): string {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
