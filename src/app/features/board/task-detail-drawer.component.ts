import { Component, HostListener, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatRippleModule } from '@angular/material/core';
import { TitleCasePipe, DatePipe } from '@angular/common';
import { CommentStoreService } from '../../core/state/comment-store.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';

@Component({
  selector: 'app-task-detail-drawer',
  standalone: true,
  imports: [MatProgressBarModule, MatMenuModule, MatRippleModule, DatePipe, TitleCasePipe],
  templateUrl: './task-detail-drawer.component.html',
})
export class TaskDetailDrawerComponent {
  readonly tasks = inject(TaskStoreService);
  readonly comments = inject(CommentStoreService);
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);
  private readonly toast = inject(ToastService);

  readonly priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
  readonly statuses: TaskStatus[] = ['todo', 'in_progress', 'done'];

  projectName(task: Task): string {
    return (
      this.workspace.filteredProjects().find((p) => p.id === task.projectId)?.name ||
      this.workspace.activeProjectName() ||
      task.projectId
    );
  }

  assigneeLabel(task: Task): string {
    if (!task.assigneeId) return 'Unassigned';
    const member = this.members.members().find((m) => m.id === task.assigneeId);
    return member?.name || this.members.memberName(task.assigneeId) || 'Unassigned';
  }

  hasMember(id?: string | null): boolean {
    if (!id) return false;
    return this.members.members().some((m) => m.id === id);
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
      this.toast.success(`Renamed task to "${trimmed}"`, 'Title Updated');
    }
  }

  saveDescription(task: Task, newDesc: string): void {
    const trimmed = newDesc.trim();
    if (trimmed !== (task.description ?? '')) {
      this.tasks.updateTask(task.id, { description: trimmed });
      this.toast.success('Task description saved', 'Description Updated');
    }
  }

  updateStatus(task: Task, status: TaskStatus): void {
    if (task.status !== status) {
      this.tasks.updateTask(task.id, { status });
      this.toast.success(`Moved to ${this.tasks.statusLabel(status)}`, 'Status Updated');
    }
  }

  updatePriority(task: Task, priority: Priority): void {
    if (task.priority !== priority) {
      this.tasks.updateTask(task.id, { priority });
      this.toast.success(`Priority changed to ${priority}`, 'Priority Updated');
    }
  }

  updateAssignee(task: Task, assigneeId: string): void {
    const val = assigneeId ? assigneeId : null;
    if (task.assigneeId !== val) {
      this.tasks.updateTask(task.id, { assigneeId: val });
      const name = val ? this.members.memberName(val) : 'Unassigned';
      this.toast.success(`Assigned to ${name}`, 'Assignee Updated');
    }
  }

  formatDueDateLabel(dueDate?: string | null): string {
    if (!dueDate) return 'No due date';
    const date = new Date(dueDate);
    if (isNaN(date.getTime())) return 'No due date';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }

  isDateToday(dueDate?: string | null): boolean {
    if (!dueDate) return false;
    const date = new Date(dueDate);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  isDateTomorrow(dueDate?: string | null): boolean {
    if (!dueDate) return false;
    const date = new Date(dueDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate()
    );
  }

  setDatePreset(task: Task, preset: 'today' | 'tomorrow' | 'next_week'): void {
    const d = new Date();
    if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (preset === 'next_week') {
      d.setDate(d.getDate() + 7);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    this.updateDueDate(task, dateStr);
  }

  updateDueDate(task: Task, dateStr: string): void {
    const val = dateStr ? new Date(dateStr).toISOString() : null;
    this.tasks.updateTask(task.id, { dueDate: val });
    this.toast.success(val ? `Due date set to ${this.formatDueDateLabel(val)}` : 'Due date cleared', 'Due Date Updated');
  }

  handleAddSubtask(task: Task, inputEl: HTMLInputElement): void {
    const title = inputEl.value.trim();
    if (!title) return;
    this.tasks.addManualSubtask(task.id, title);
    inputEl.value = '';
  }

  readonly isEditingDesc = signal(false);

  formatMarkdown(raw?: string | null): string {
    if (!raw) return '';
    let text = raw;

    // Escape HTML to prevent XSS
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Horizontal rules: --- or ***
    text = text.replace(/^(?:---|___|\*\*\*)\s*$/gm, '<hr class="md-hr" />');

    // Headers: ### Title -> <h4 class="md-h4">Title</h4>
    text = text.replace(/^###\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
    text = text.replace(/^##\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
    text = text.replace(/^#\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');

    // Bold + Italic: ***text*** -> <strong><em>text</em></strong>
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Bold: **text** -> <strong>$1</strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* or _text_ -> <em>$1</em>
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Inline code: `code` -> <code class="md-code">$1</code>
    text = text.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

    // Bullet lists: Convert consecutive lines starting with - or *
    text = text.replace(/(?:^[ \t]*[-*]\s+(.+)(?:\r?\n|$))+/gm, (match) => {
      const items = match
        .trim()
        .split(/\r?\n/)
        .map((line) => line.replace(/^[ \t]*[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${item}</li>`)
        .join('');
      return `<ul class="md-list">${items}</ul>`;
    });

    // Numbered lists: Convert consecutive lines starting with 1. 2.
    text = text.replace(/(?:^[ \t]*\d+\.\s+(.+)(?:\r?\n|$))+/gm, (match) => {
      const items = match
        .trim()
        .split(/\r?\n/)
        .map((line) => line.replace(/^[ \t]*\d+\.\s+/, '').trim())
        .filter(Boolean)
        .map((item) => `<li>${item}</li>`)
        .join('');
      return `<ol class="md-num-list">${items}</ol>`;
    });

    // Paragraph breaks: Double newlines -> separate paragraph wrappers
    const paragraphs = text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        if (
          p.startsWith('<h2') ||
          p.startsWith('<h3') ||
          p.startsWith('<h4') ||
          p.startsWith('<hr') ||
          p.startsWith('<ul') ||
          p.startsWith('<ol')
        ) {
          return p;
        }
        return `<p class="md-p">${p.replace(/\n/g, '<br/>')}</p>`;
      });

    return paragraphs.join('');
  }
}
