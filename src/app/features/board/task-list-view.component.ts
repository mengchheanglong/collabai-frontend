import { Component, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import type { Member } from '../../shared/models/member.models';
import type { Task } from '../../shared/models/task.models';

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-task-list-view',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './task-list-view.component.html',
  styleUrl: './task-list-view.component.scss',
})
export class TaskListViewComponent {
  readonly tasks = inject(TaskStoreService);
  readonly members = inject(MemberDirectoryService);

  /** `assigneeId` is an id, so resolve it to a real person for the row. */
  assignee(task: Task): Member | null {
    if (!task.assigneeId) return null;
    return this.members.members().find((member) => member.id === task.assigneeId) ?? null;
  }

  isOverdue(task: Task): boolean {
    if (task.status === 'done' || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    return !Number.isNaN(due.getTime()) && startOfDay(due) < startOfDay(new Date());
  }

  dueLabel(task: Task): string {
    if (!task.dueDate) return 'No due date';
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return 'No due date';

    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / DAY_MS);
    if (days < 0) return 'Overdue ' + Math.abs(days) + 'd';
    if (days === 0) return 'Due today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return 'In ' + days + 'd';
    return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
