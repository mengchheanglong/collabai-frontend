import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { priorityRank } from '../../shared/lib/person-display';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

type WorkStatusFilter = 'all' | 'open' | 'done';
type WorkGroupKey = 'overdue' | 'today' | 'in_progress' | 'upcoming' | 'unscheduled' | 'completed';

interface WorkGroup {
  key: WorkGroupKey;
  title: string;
  description: string;
  icon: string;
  tasks: Task[];
}

const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

@Component({
  selector: 'app-work-page',
  standalone: true,
  imports: [RouterLink, MatRippleModule, MatTooltipModule, ThemeToggleComponent, DatePipe],
  templateUrl: './work-page.component.html',
  styleUrl: './work-page.component.scss',
})
export class WorkPageComponent {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly taskStore = inject(TaskStoreService);
  readonly memberDirectory = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);

  readonly query = signal('');
  readonly projectFilter = signal('all');
  readonly priorityFilter = signal<'all' | Priority>('all');
  readonly statusFilter = signal<WorkStatusFilter>('open');
  readonly editingTaskId = signal<string | null>(null);
  readonly expandedGroups = signal<Set<WorkGroupKey>>(new Set());

  readonly currentDate = signal(new Date());

  readonly priorities = PRIORITIES;
  readonly statuses = this.taskStore.columns;

  readonly personalTasks = computed(() =>
    this.taskStore
      .tasks()
      .filter((task) => task.assigneeId === this.memberDirectory.currentUser.id),
  );

  readonly projects = computed(() =>
    [...new Set(this.personalTasks().map((task) => this.projectName(task)))].sort((a, b) =>
      a.localeCompare(b),
    ),
  );

  readonly filteredTasks = computed(() => {
    const query = this.query().trim().toLowerCase();
    const project = this.projectFilter();
    const priority = this.priorityFilter();
    const status = this.statusFilter();

    return this.personalTasks()
      .filter((task) => {
        if (project !== 'all' && this.projectName(task) !== project) return false;
        if (priority !== 'all' && task.priority !== priority) return false;
        if (status === 'open' && task.status === 'done') return false;
        if (status === 'done' && task.status !== 'done') return false;
        if (!query) return true;
        const searchable = [
          task.id,
          task.title,
          this.projectName(task),
          task.assigneeId ?? '',
          task.priority,
          ...task.labels,
        ]
          .join(' ')
          .toLowerCase();
        return query
          .split(/\s+/)
          .filter(Boolean)
          .every((term) => searchable.includes(term));
      })
      .sort((a, b) => this.compareTasks(a, b));
  });

  readonly workGroups = computed<WorkGroup[]>(() => {
    const tasks = this.filteredTasks();
    const definitions: Array<Omit<WorkGroup, 'tasks'>> = [
      {
        key: 'overdue',
        title: 'Needs attention',
        description: 'Your work past its due date',
        icon: 'warning',
      },
      {
        key: 'today',
        title: 'Due today',
        description: 'Your tasks to move today',
        icon: 'today',
      },
      {
        key: 'in_progress',
        title: 'In motion',
        description: 'Your active tasks',
        icon: 'progress_activity',
      },
      {
        key: 'upcoming',
        title: 'Coming up',
        description: 'Your scheduled tasks that have not started',
        icon: 'event_upcoming',
      },
      {
        key: 'unscheduled',
        title: 'Needs scheduling',
        description: 'Your open tasks without a due date',
        icon: 'calendar_add_on',
      },
      {
        key: 'completed',
        title: 'Completed',
        description: 'Your finished tasks in this result set',
        icon: 'check_circle',
      },
    ];

    return definitions
      .map((definition) => ({
        ...definition,
        tasks: tasks.filter((task) => this.groupForTask(task) === definition.key),
      }))
      .filter((group) => group.tasks.length > 0);
  });

  readonly overview = computed(() => {
    const tasks = this.personalTasks();
    return {
      open: tasks.filter((task) => task.status !== 'done').length,
      inProgress: tasks.filter((task) => task.status === 'in_progress').length,
      overdue: tasks.filter((task) => this.isOverdue(task)).length,
      completed: tasks.filter((task) => task.status === 'done').length,
    };
  });

  readonly totalAssigned = computed(() => this.personalTasks().length);

  readonly completionRate = computed(() => {
    const total = this.totalAssigned();
    return total ? Math.round((this.overview().completed / total) * 100) : 0;
  });

  /** Matches the dashboard's greeting so the two pages read as one product. */
  readonly greeting = computed(() => {
    const hour = this.currentDate().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly firstName = computed(() => this.memberDirectory.currentUser.name.split(' ')[0]);

  readonly hasFilters = computed(
    () =>
      Boolean(this.query()) ||
      this.projectFilter() !== 'all' ||
      this.priorityFilter() !== 'all',
  );

  clearFilters(): void {
    this.query.set('');
    this.projectFilter.set('all');
    this.priorityFilter.set('all');
  }

  visibleGroupTasks(group: WorkGroup): Task[] {
    return this.expandedGroups().has(group.key) ? group.tasks : group.tasks.slice(0, 5);
  }

  remainingGroupTasks(group: WorkGroup): number {
    return Math.max(group.tasks.length - this.visibleGroupTasks(group).length, 0);
  }

  toggleGroup(groupKey: WorkGroupKey): void {
    this.expandedGroups.update((expanded) => {
      const next = new Set(expanded);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  }

  toggleTaskEditor(taskId: string): void {
    this.editingTaskId.update((current) => (current === taskId ? null : taskId));
  }

  addQuickTask(): void {
    this.taskStore.addQuickTask();
    void this.router.navigate(['/board']);
  }

  openTask(task: Task): void {
    this.taskStore.clearUiState();
    this.taskStore.selectTask(task);
    this.taskStore.setBoardView('kanban');
    void this.router.navigate(['/board']);
  }

  projectName(task: Task): string {
    return (
      this.workspace.filteredProjects().find((project) => project.id === task.projectId)?.name ??
      task.projectId
    );
  }

  updateStatus(task: Task, status: TaskStatus): void {
    if (task.status === status) return;
    this.taskStore.updateTask(task.id, { status });
    this.toast.show(`Moved ${task.id} to ${this.taskStore.statusLabel(status)}`, 'success');
  }

  updatePriority(task: Task, priority: Priority): void {
    if (task.priority === priority) return;
    this.taskStore.updateTask(task.id, { priority });
    this.toast.show(`Updated ${task.id} priority`, 'success');
  }

  dueLabel(task: Task): string {
    const date = this.parseDueDate(task.dueDate);
    if (!date) return 'No date';
    const days = this.dayDifference(date, this.today());
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days === -1) return 'Yesterday';
    if (days < 0 && task.status !== 'done') {
      const overdueDays = Math.abs(days);
      return `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
    }
    return task.dueDate ?? 'No date';
  }

  dueTone(task: Task): 'overdue' | 'today' | 'normal' | 'none' {
    const date = this.parseDueDate(task.dueDate);
    if (!date) return 'none';
    const days = this.dayDifference(date, this.today());
    if (task.status !== 'done' && days < 0) return 'overdue';
    if (task.status !== 'done' && days === 0) return 'today';
    return 'normal';
  }

  private groupForTask(task: Task): WorkGroupKey {
    if (task.status === 'done') return 'completed';
    const due = this.parseDueDate(task.dueDate);
    if (!due) return 'unscheduled';
    const days = this.dayDifference(due, this.today());
    if (days < 0) return 'overdue';
    if (days === 0) return 'today';
    if (task.status === 'in_progress') return 'in_progress';
    return 'upcoming';
  }

  private isOverdue(task: Task): boolean {
    if (task.status === 'done') return false;
    const due = this.parseDueDate(task.dueDate);
    return Boolean(due && due < this.today());
  }

  private compareTasks(a: Task, b: Task): number {
    const dueA = this.parseDueDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dueB = this.parseDueDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return dueA - dueB || priorityRank(b.priority) - priorityRank(a.priority);
  }

  private parseDueDate(value: string | null): Date | null {
    if (!value || value.toLowerCase() === 'tbd') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private today(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  private dayDifference(date: Date, from: Date): number {
    return Math.round((date.getTime() - from.getTime()) / 86_400_000);
  }
}
