import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService } from '../../core/api/ai.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { chipsFromFilters, SMART_SEARCH_PROMPTS } from '../../shared/lib/ai-search-chips';
import type { AiSearchChip, AiSearchFilters } from '../../shared/models/ai.models';
import type { Task } from '../../shared/models/task.models';

export interface SmartSearchResult {
  query: string;
  filters: AiSearchFilters;
  tasks: Task[];
}

@Component({
  selector: 'app-smart-search',
  standalone: true,
  imports: [MatRippleModule, MatTooltipModule],
  templateUrl: './smart-search.component.html',
})
export class SmartSearchComponent {
  private readonly ai = inject(AiService);
  private readonly tasks = inject(TaskStoreService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly toast = inject(ToastService);

  /** 'hero' for dashboard, 'compact' for board toolbar */
  @Input() variant: 'hero' | 'compact' = 'hero';
  @Input() placeholder = 'Ask AI to find tasks…';
  @Input() showPrompts = true;
  @Input() showResults = true;
  @Input() autofocus = false;

  @Output() readonly searched = new EventEmitter<SmartSearchResult>();
  @Output() readonly taskSelected = new EventEmitter<Task>();
  @Output() readonly cleared = new EventEmitter<void>();

  readonly query = signal('');
  readonly isSearching = signal(false);
  readonly hasSearched = signal(false);
  readonly error = signal<string | null>(null);
  readonly chips = signal<AiSearchChip[]>([]);
  readonly results = signal<Task[]>([]);
  readonly lastFilters = signal<AiSearchFilters | null>(null);

  readonly prompts = SMART_SEARCH_PROMPTS;

  runSearch(raw = this.query()): void {
    const q = raw.trim();
    if (!q || this.isSearching()) return;

    this.query.set(q);
    this.isSearching.set(true);
    this.error.set(null);

    // projectId is mocked until real project APIs exist
    const projectId = this.workspace.selectedWorkspaceId() || 'mock-project';

    this.ai.searchTasks({ projectId, query: q }, this.tasks.workspaceTasks()).subscribe({
      next: (data) => {
        const chips = chipsFromFilters(data.interpretedQuery);
        this.chips.set(chips);
        this.results.set(data.tasks);
        this.lastFilters.set(data.interpretedQuery);
        this.hasSearched.set(true);
        this.isSearching.set(false);
        this.searched.emit({
          query: q,
          filters: data.interpretedQuery,
          tasks: data.tasks,
        });
        // Compact board mode: filter Kanban/list to AI matches
        if (this.variant === 'compact') {
          this.tasks.applySmartSearchResults(
            data.tasks.map((t) => t.id),
            q,
          );
        }
        this.toast.show(
          data.tasks.length
            ? `Found ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'}`
            : 'No matching tasks',
          'ai',
        );
      },
      error: () => {
        this.isSearching.set(false);
        this.error.set('Search failed. Try again in a moment.');
        this.toast.show('AI search failed', 'info');
      },
    });
  }

  usePrompt(prompt: string): void {
    this.query.set(prompt);
    this.runSearch(prompt);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.runSearch();
    }
    if (event.key === 'Escape') {
      this.clear();
    }
  }

  selectTask(task: Task): void {
    this.taskSelected.emit(task);
  }

  clear(): void {
    this.query.set('');
    this.chips.set([]);
    this.results.set([]);
    this.lastFilters.set(null);
    this.hasSearched.set(false);
    this.error.set(null);
    if (this.variant === 'compact') {
      this.tasks.clearSmartSearch();
      this.tasks.searchQuery.set('');
    }
    this.cleared.emit();
  }
}
