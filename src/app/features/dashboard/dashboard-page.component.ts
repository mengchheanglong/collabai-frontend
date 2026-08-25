import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivityStoreService } from '../../core/state/activity-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { SuggestionStoreService } from '../../core/state/suggestion-store.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { AnalyticsStoreService } from '../../core/state/analytics-store.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { priorityRank } from '../../shared/lib/person-display';
import type { Suggestion } from '../../shared/models/suggestion.models';
import type { Task } from '../../shared/models/task.models';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

/** Segments in the delivery meter — 20 bars, so each bar is 5% of the board. */
const METER_SEGMENTS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

import { CollabSidebarComponent } from './collab-sidebar.component';

interface StatusSegment {
  key: 'done' | 'in_progress' | 'todo';
  label: string;
  value: number;
  share: number;
}

interface WorkloadRow {
  userId: string;
  name: string;
  total: number;
  done: number;
  share: number;
  rate: number;
}

interface DeliveryTrend {
  icon: string;
  tone: '' | 'is-good' | 'is-bad';
  text: string;
}

interface Sparkline {
  line: string;
  area: string;
  last: { x: number; y: number };
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink, MatRippleModule, MatTooltipModule, ThemeToggleComponent, DatePipe, CollabSidebarComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceContextService);
  readonly tasks = inject(TaskStoreService);
  readonly activities = inject(ActivityStoreService);
  readonly suggestions = inject(SuggestionStoreService);
  readonly members = inject(MemberDirectoryService);
  readonly analytics = inject(AnalyticsStoreService);

  readonly today = signal(new Date());
  readonly isCollabSidebarOpen = signal(true);

  toggleCollabSidebar(): void {
    this.isCollabSidebarOpen.update(open => !open);
  }

  // ----- insights overlay -----

  @ViewChild('insightsDialog') private insightsDialog?: ElementRef<HTMLElement>;
  @ViewChild('insightsClose') private insightsClose?: ElementRef<HTMLButtonElement>;

  readonly isInsightsOpen = signal(false);
  private lastFocusedElement: HTMLElement | null = null;
  private previousBodyOverflow = '';

  ngOnInit(): void {
    const projectId = this.workspace.activeProjectId();
    if (projectId) {
      this.analytics.loadForProject(projectId);
      this.activities.loadForProject(projectId);
    }
  }

  // ----- header -----

  readonly greeting = computed(() => {
    const hour = this.today().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly firstName = computed(() => this.members.currentUser.name.split(' ')[0]);

  // ----- metrics -----
  //
  // Analytics is scoped to the active project and the task store to the active board.
  // Prefer the server summary whenever it has loaded and fall back to local task counts
  // otherwise, checking presence rather than truthiness so a real 0 survives.

  private readonly hasSummary = computed(() => this.analytics.summary() !== null);

  readonly totalTasks = computed(() =>
    this.hasSummary() ? this.analytics.totalTasks() : this.tasks.totalTasks(),
  );

  readonly completedTasks = computed(() =>
    this.hasSummary() ? this.analytics.completedTasks() : this.tasks.doneTasks(),
  );

  readonly inProgressTasks = computed(() =>
    this.hasSummary() ? this.analytics.inProgressTasks() : this.tasks.inProgressTasks(),
  );

  readonly todoTasks = computed(() => {
    if (this.hasSummary()) return this.analytics.todoTasks();
    return this.tasks.tasks().filter((t) => t.status === 'todo').length;
  });

  readonly completionRate = computed(() =>
    this.hasSummary() ? this.analytics.completionRate() : this.tasks.completionRate(),
  );

  readonly openTasks = computed(() => Math.max(this.totalTasks() - this.completedTasks(), 0));

  private readonly localOverdue = computed(() =>
    this.tasks.tasks().filter((t) => t.status !== 'done' && this.isOverdue(t)),
  );

  readonly overdueTasks = computed(() =>
    this.hasSummary() ? this.analytics.overdueTasks() : this.localOverdue().length,
  );

  readonly highPriorityOpen = computed(
    () =>
      this.tasks
        .tasks()
        .filter((t) => t.status !== 'done' && (t.priority === 'high' || t.priority === 'urgent'))
        .length,
  );

  /** Filled-vs-empty flags for the segmented delivery meter. */
  readonly meterSegments = computed<boolean[]>(() => {
    const filled = Math.round((this.clampPercent(this.completionRate()) / 100) * METER_SEGMENTS);
    return Array.from({ length: METER_SEGMENTS }, (_, i) => i < filled);
  });

  readonly statusSegments = computed<StatusSegment[]>(() => {
    const done = this.completedTasks();
    const inProgress = this.inProgressTasks();
    const todo = this.todoTasks();
    const total = Math.max(done + inProgress + todo, 1);
    return [
      { key: 'done', label: 'Done', value: done, share: (done / total) * 100 },
      {
        key: 'in_progress',
        label: 'In progress',
        value: inProgress,
        share: (inProgress / total) * 100,
      },
      { key: 'todo', label: 'To do', value: todo, share: (todo / total) * 100 },
    ];
  });

  // ----- burndown sparkline -----

  readonly burndown = computed<Sparkline | null>(() => {
    const points = this.analytics.burndown();
    if (points.length < 2) return null;

    const width = 260;
    const height = 64;
    const padY = 6;
    const max = Math.max(...points.map((p) => p.remainingTasks), 1);
    const step = width / (points.length - 1);

    const coords = points.map((point, index) => ({
      x: index * step,
      y: padY + (height - padY * 2) * (1 - point.remainingTasks / max),
    }));

    const line = coords
      .map((c, i) => (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ' ' + c.y.toFixed(1))
      .join(' ');

    const first = coords[0];
    const last = coords[coords.length - 1];
    const area = line + ' L' + last.x.toFixed(1) + ' ' + height + ' L' + first.x.toFixed(1) + ' ' + height + ' Z';

    return { line, area, last };
  });

  readonly burndownRemaining = computed(() => {
    const points = this.analytics.burndown();
    return points.length ? points[points.length - 1].remainingTasks : this.openTasks();
  });

  /** Negative means remaining work is trending down, which is the healthy direction. */
  readonly burndownDelta = computed(() => {
    const points = this.analytics.burndown();
    if (points.length < 2) return 0;
    return points[points.length - 1].remainingTasks - points[0].remainingTasks;
  });

  /** Footer line under the meter: which way remaining work is moving. */
  readonly deliveryTrend = computed<DeliveryTrend>(() => {
    const delta = this.burndownDelta();
    if (delta < 0) {
      const n = Math.abs(delta);
      return { icon: 'trending_down', tone: 'is-good', text: n + ' fewer remaining than at the start' };
    }
    if (delta > 0) {
      return { icon: 'trending_up', tone: 'is-bad', text: delta + ' more remaining than at the start' };
    }
    if (this.totalTasks() > 0 && this.openTasks() === 0) {
      return { icon: 'check_circle', tone: 'is-good', text: 'Everything on the board is done' };
    }
    return {
      icon: 'trending_flat',
      tone: '',
      text: this.openTasks() + ' still open · ' + this.completionRate() + '% complete',
    };
  });

  // ----- workload -----

  readonly workload = computed<WorkloadRow[]>(() => {
    const rows = this.analytics.summary()?.tasksByUser ?? [];
    if (!rows.length) return [];
    const max = Math.max(...rows.map((r) => r.total), 1);
    return [...rows]
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
      .map((row) => ({
        ...row,
        share: (row.total / max) * 100,
        rate: Math.round((row.done / Math.max(row.total, 1)) * 100),
      }));
  });

  // ----- lists -----

  /** Soonest-due open work first, then by priority, so the queue is genuinely actionable. */
  readonly upNext = computed(() =>
    [...this.tasks.tasks()]
      .filter((t) => t.status !== 'done')
      .sort((a, b) => {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue) return aDue - bDue;
        return priorityRank(b.priority) - priorityRank(a.priority);
      })
      .slice(0, 6),
  );

  readonly recentActivities = computed(() => this.activities.activities().slice(0, 6));

  readonly topSuggestions = computed(() => this.suggestions.suggestions().slice(0, 3));

  readonly skeletonRows = [0, 1, 2, 3];

  // ----- task helpers -----

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'done') return false;
    const due = new Date(task.dueDate);
    return !Number.isNaN(due.getTime()) && this.startOfDay(due) < this.startOfToday();
  }

  /** Human due label: "Overdue 2d", "Due today", "Tomorrow", "In 4d", else a short date. */
  dueLabel(task: Task): string {
    if (!task.dueDate) return 'No due date';
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return 'No due date';

    const days = Math.round((this.startOfDay(due) - this.startOfToday()) / DAY_MS);
    if (days < 0) return 'Overdue ' + Math.abs(days) + 'd';
    if (days === 0) return 'Due today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return 'In ' + days + 'd';
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  assigneeName(task: Task): string | null {
    if (!task.assigneeId) return null;
    return this.members.members().find((m) => m.id === task.assigneeId)?.name ?? null;
  }

  subtaskProgress(task: Task): string | null {
    if (!task.subtasks.length) return null;
    return task.subtasks.filter((s) => s.done).length + '/' + task.subtasks.length;
  }

  // ----- actions -----

  openInsights(): void {
    if (this.isInsightsOpen()) return;
    this.lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.isInsightsOpen.set(true);
    this.lockBodyScroll(true);
    queueMicrotask(() => this.insightsClose?.nativeElement.focus());
  }

  closeInsights(): void {
    if (!this.isInsightsOpen()) return;
    this.isInsightsOpen.set(false);
    this.lockBodyScroll(false);
    queueMicrotask(() => this.lastFocusedElement?.focus());
  }

  /** Escape closes the overlay; Tab stays inside it while it is open. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isInsightsOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeInsights();
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event);
  }

  ngOnDestroy(): void {
    // Navigating away with the overlay open must not leave the page unscrollable.
    if (this.isInsightsOpen()) this.lockBodyScroll(false);
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.insightsDialog?.nativeElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private lockBodyScroll(lock: boolean): void {
    if (lock) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = this.previousBodyOverflow;
    }
  }

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

  // ----- presentation maps -----

  impactClass(impact: Suggestion['impact']): string {
    return 'impact-' + impact.toLowerCase();
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

  activityIcon(type: string): string {
    const map: Record<string, string> = {
      ai: 'auto_awesome',
      comment: 'chat_bubble',
      project: 'folder',
      task: 'task_alt',
    };
    return map[type] ?? 'bolt';
  }

  // ----- internals -----

  private clampPercent(value: number): number {
    return Math.min(Math.max(value, 0), 100);
  }

  private startOfToday(): number {
    return this.startOfDay(this.today());
  }

  private startOfDay(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }
}
