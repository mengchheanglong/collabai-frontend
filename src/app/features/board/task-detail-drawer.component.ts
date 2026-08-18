import { Component, HostListener, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TitleCasePipe, DatePipe } from '@angular/common';
import { CommentStoreService } from '../../core/state/comment-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';

@Component({
  selector: 'app-task-detail-drawer',
  standalone: true,
  imports: [MatProgressBarModule, DatePipe, TitleCasePipe],
  templateUrl: './task-detail-drawer.component.html',
})
export class TaskDetailDrawerComponent {
  readonly tasks = inject(TaskStoreService);
  readonly comments = inject(CommentStoreService);
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);

  readonly priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
  readonly statuses: TaskStatus[] = ['todo', 'in_progress', 'done'];

  projectName(task: Task): string {
    return (
      this.workspace.filteredProjects().find((p) => p.id === task.projectId)?.name ||
      this.workspace.activeProjectName() ||
      task.projectId
    );
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.tasks.selectedTask()) {
      this.tasks.closeTask();
    }
  }

  saveTitle(task: Task, inputEl: HTMLInputElement): void {
    const trimmed = inputEl.value.trim();
    if (!trimmed) {
      inputEl.value = task.title;
      return;
    }
    if (trimmed !== task.title) {
      inputEl.value = trimmed;
      this.tasks.updateTask(task.id, { title: trimmed });
    }
  }

  saveDescription(task: Task, newDesc: string): void {
    const trimmed = newDesc.trim();
    if (trimmed !== (task.description ?? '')) {
      this.tasks.updateTask(task.id, { description: trimmed });
    }
  }

  updateStatus(task: Task, status: TaskStatus): void {
    if (task.status !== status) {
      this.tasks.updateTask(task.id, { status });
    }
  }

  updatePriority(task: Task, priority: Priority): void {
    if (task.priority !== priority) {
      this.tasks.updateTask(task.id, { priority });
    }
  }

  updateAssignee(task: Task, assigneeId: string): void {
    const val = assigneeId ? assigneeId : null;
    if (task.assigneeId !== val) {
      this.tasks.updateTask(task.id, { assigneeId: val });
    }
  }

  updateDueDate(task: Task, dateStr: string): void {
    const val = dateStr ? new Date(dateStr).toISOString() : null;
    this.tasks.updateTask(task.id, { dueDate: val });
  }

  handleAddSubtask(task: Task, inputEl: HTMLInputElement): void {
    const title = inputEl.value.trim();
    if (!title) return;
    this.tasks.addManualSubtask(task.id, title);
    inputEl.value = '';
  }
}
