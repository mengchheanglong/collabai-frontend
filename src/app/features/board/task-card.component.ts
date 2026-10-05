import { Component, computed, inject, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { LiveCollaborationService } from '../../core/realtime/live-collaboration.service';
import { AuthStoreService } from '../../core/state/auth-store.service';
import type { Task } from '../../shared/models/task.models';

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
  host: {
    '[class.selected]': 'selected()',
    '(click)': 'taskSelected.emit(task())',
    '(keydown.enter)': 'taskSelected.emit(task())',
    '(keydown.space)': 'taskSelected.emit(task()); $event.preventDefault()',
  },
})
export class TaskCardComponent {
  private readonly members = inject(MemberDirectoryService);
  private readonly live = inject(LiveCollaborationService, { optional: true });
  private readonly auth = inject(AuthStoreService, { optional: true });

  readonly activeViewers = computed(() => {
    if (!this.live) return [];
    const myId = this.auth?.currentUser()?._id;
    return this.live.taskViewersFor(this.task().id).filter((u) => u.userId !== myId);
  });

  readonly activeViewersTooltip = computed(() => {
    const viewers = this.activeViewers();
    if (!viewers.length) return '';
    return viewers.map((v) => v.name).join(', ') + ' currently viewing';
  });

  readonly task = input.required<Task>();
  readonly selected = input(false);
  readonly taskSelected = output<Task>();

  /** `assigneeId` is an id, so resolve it to a real person for the avatar. */
  readonly assignee = computed(() => {
    const id = this.task().assigneeId;
    if (!id) return null;
    return this.members.members().find((member) => member.id === id) ?? null;
  });

  readonly subtaskProgress = computed(() => {
    const subtasks = this.task().subtasks;
    if (!subtasks.length) return null;
    return subtasks.filter((subtask) => subtask.done).length + '/' + subtasks.length;
  });

  readonly isOverdue = computed(() => {
    const task = this.task();
    if (task.status === 'done' || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    return !Number.isNaN(due.getTime()) && startOfDay(due) < startOfDay(new Date());
  });

  /** Human due label rather than the raw ISO string. */
  readonly dueLabel = computed(() => {
    const dueDate = this.task().dueDate;
    if (!dueDate) return null;
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;

    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / DAY_MS);
    if (days < 0) return Math.abs(days) + 'd over';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return 'In ' + days + 'd';
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
