import { Injectable, inject, signal } from '@angular/core';
import { suggestions as seedSuggestions } from '../../data/mock/mock-suggestions';
import type { Suggestion } from '../../shared/models/suggestion.models';
import { ToastService } from '../toast/toast.service';

@Injectable({ providedIn: 'root' })
export class SuggestionStoreService {
  private readonly toast = inject(ToastService);

  readonly suggestions = signal<Suggestion[]>(seedSuggestions.slice(0, 3));

  applySuggestion(suggestion: Suggestion): void {
    this.suggestions.update((items) => items.filter((s) => s.id !== suggestion.id));
    this.toast.show(`Applied: ${suggestion.title}`, 'success');
  }
}
