import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { suggestions as seedSuggestions } from '../../data/mock/mock-suggestions';
import type { Suggestion } from '../../shared/models/suggestion.models';
import { ToastService } from '../toast/toast.service';
import { TaskStoreService } from './task-store.service';

@Injectable({ providedIn: 'root' })
export class SuggestionStoreService {
  private readonly toast = inject(ToastService);
  private readonly tasks = inject(TaskStoreService);
  private readonly router = inject(Router);

  readonly suggestions = signal<Suggestion[]>(seedSuggestions.slice(0, 4));
  readonly dismissed = signal<string[]>([]);

  applySuggestion(suggestion: Suggestion): void {
    this.suggestions.update((items) => items.filter((s) => s.id !== suggestion.id));

    // Lightweight demo actions aligned with suggestion categories
    switch (suggestion.category) {
      case 'Tasks': {
        const large = this.tasks
          .workspaceTasks()
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
    this.suggestions.update((items) => items.filter((s) => s.id !== suggestion.id));
    this.dismissed.update((ids) => [...ids, suggestion.id]);
    this.toast.show('Suggestion dismissed', 'info');
  }
}
