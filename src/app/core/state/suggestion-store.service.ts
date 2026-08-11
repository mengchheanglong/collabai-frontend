// SuggestionStoreService — AI-style suggestions derived from real workspace data
// (no seed data). Suggestions are computed from the loaded tasks and team roster.

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Suggestion } from '../../shared/models/suggestion.models';
import { ToastService } from '../toast/toast.service';
import { MemberDirectoryService } from './member-directory.service';
import { TaskStoreService } from './task-store.service';

@Injectable({ providedIn: 'root' })
export class SuggestionStoreService {
  private readonly toast = inject(ToastService);
  private readonly tasks = inject(TaskStoreService);
  private readonly members = inject(MemberDirectoryService);
  private readonly router = inject(Router);

  readonly dismissed = signal<string[]>([]);

  readonly suggestions = computed<Suggestion[]>(() => {
    const open = this.tasks.tasks().filter((t) => t.status !== 'done');
    const now = new Date();
    const overdue = open.filter(
      (t) => t.dueDate && new Date(t.dueDate).getTime() < now.getTime(),
    );
    const unscheduled = open.filter((t) => !t.dueDate);
    const thin = open.filter((t) => t.subtasks.length <= 2);

    const list: Suggestion[] = [];
    if (overdue.length > 0) {
      list.push({
        id: 'risk-overdue',
        title: `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`,
        body: `${overdue.length} open task${overdue.length === 1 ? ' is' : 's are'} past its due date. Review and reprioritize.`,
        category: 'Risk',
        impact: 'High',
        action: 'Review overdue work',
      });
    }
    if (unscheduled.length > 0) {
      list.push({
        id: 'timeline-unscheduled',
        title: `${unscheduled.length} unscheduled task${unscheduled.length === 1 ? '' : 's'}`,
        body: `Give ${unscheduled.length} open task${unscheduled.length === 1 ? '' : 's'} a due date so the timeline is clear.`,
        category: 'Timeline',
        impact: 'Medium',
        action: 'Schedule work',
      });
    }
    if (thin.length > 0) {
      list.push({
        id: 'tasks-subtasks',
        title: 'Break large tasks into subtasks',
        body: `${thin.length} open task${thin.length === 1 ? ' has' : 's have'} no subtasks. Smaller steps make progress visible.`,
        category: 'Tasks',
        impact: 'Medium',
        action: 'Break down tasks',
      });
    }
    if (this.members.memberCount() > 0) {
      list.push({
        id: 'workload-team',
        title: 'Check team workload',
        body: `Your team has ${this.members.memberCount()} members. Spot-check who is carrying the most open work.`,
        category: 'Workload',
        impact: 'Low',
        action: 'View team',
      });
    }

    return list.filter((s) => !this.dismissed().includes(s.id)).slice(0, 4);
  });

  applySuggestion(suggestion: Suggestion): void {
    this.dismissed.update((ids) => [...ids, suggestion.id]);

    // Lightweight actions aligned with suggestion categories
    switch (suggestion.category) {
      case 'Tasks': {
        const large = this.tasks
          .tasks()
          .find((t) => t.subtasks.length <= 2 && t.status !== 'done');
        if (large) {
          this.tasks.selectTask(large);
          this.tasks.generateSubtasks(large);
          void this.router.navigate(['/board']);
          this.toast.show('Opening task to generate subtasks', 'ai');
          return;
        }
        break;
      }
      case 'Risk':
      case 'Timeline': {
        this.tasks.searchQuery.set('high priority');
        void this.router.navigate(['/board']);
        this.toast.show(`Applied: ${suggestion.title}`, 'ai');
        return;
      }
      case 'Workload': {
        void this.router.navigate(['/team']);
        this.toast.show(`Applied: ${suggestion.title}`, 'success');
        return;
      }
      default:
        break;
    }

    this.toast.show(`Applied: ${suggestion.title}`, 'success');
  }

  dismissSuggestion(suggestion: Suggestion): void {
    this.dismissed.update((ids) => [...ids, suggestion.id]);
    this.toast.show('Suggestion dismissed', 'info');
  }
}
