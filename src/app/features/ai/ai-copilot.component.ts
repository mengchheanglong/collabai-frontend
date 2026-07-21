import {
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService } from '../../core/api/ai.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { chipsFromFilters, SMART_SEARCH_PROMPTS } from '../../shared/lib/ai-search-chips';
import type { AiSearchChip } from '../../shared/models/ai.models';
import type { Task } from '../../shared/models/task.models';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Original user query for board filter labeling. */
  queryLabel?: string;
  chips?: AiSearchChip[];
  tasks?: Task[];
  pending?: boolean;
}

@Component({
  selector: 'app-ai-copilot',
  standalone: true,
  imports: [MatRippleModule, MatTooltipModule],
  templateUrl: './ai-copilot.component.html',
})
export class AiCopilotComponent {
  private readonly ai = inject(AiService);
  private readonly tasks = inject(TaskStoreService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  @ViewChild('composer') private composer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('thread') private thread?: ElementRef<HTMLDivElement>;

  readonly open = signal(false);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi — I can find tasks, filter the board, and help you dig through work in plain English.',
    },
  ]);

  readonly prompts = SMART_SEARCH_PROMPTS;

  constructor() {
    effect(() => {
      // Keep thread scrolled when messages change or panel opens
      void this.messages();
      void this.open();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (!this.open()) return;
    queueMicrotask(() => this.composer?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
  }

  usePrompt(prompt: string): void {
    this.draft.set(prompt);
    this.send();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
    if (event.key === 'Escape') {
      this.close();
    }
  }

  send(raw = this.draft()): void {
    const text = raw.trim();
    if (!text || this.sending()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    const pendingId = `a-${Date.now()}`;
    const pending: ChatMessage = {
      id: pendingId,
      role: 'assistant',
      text: 'Looking through your tasks…',
      pending: true,
    };

    this.messages.update((m) => [...m, userMsg, pending]);
    this.draft.set('');
    this.sending.set(true);

    const projectId = this.workspace.selectedWorkspaceId() || 'mock-project';

    this.ai.searchTasks({ projectId, query: text }, this.tasks.workspaceTasks()).subscribe({
      next: (data) => {
        const chips = chipsFromFilters(data.interpretedQuery);
        const count = data.tasks.length;
        const reply =
          count === 0
            ? 'I couldn’t find matching tasks. Try different words, a person name, priority, or due range.'
            : count === 1
              ? 'Found 1 task that matches. Open it, or filter the board to focus on this result.'
              : `Found ${count} tasks that match. Open one, or filter the board to only show these.`;

        this.messages.update((list) =>
          list.map((msg) =>
            msg.id === pendingId
              ? {
                  ...msg,
                  text: reply,
                  queryLabel: text,
                  chips,
                  tasks: data.tasks.slice(0, 8),
                  pending: false,
                }
              : msg,
          ),
        );
        this.sending.set(false);
      },
      error: () => {
        this.messages.update((list) =>
          list.map((msg) =>
            msg.id === pendingId
              ? {
                  ...msg,
                  text: 'Something went wrong talking to AI. Try again in a moment.',
                  pending: false,
                }
              : msg,
          ),
        );
        this.sending.set(false);
        this.toast.show('AI chat failed', 'info');
      },
    });
  }

  openTask(task: Task): void {
    this.tasks.selectTask(task);
    this.tasks.setBoardView('kanban');
    void this.router.navigate(['/board']);
    this.close();
  }

  filterBoard(taskIds: string[], queryLabel: string): void {
    this.tasks.applySmartSearchResults(taskIds, queryLabel);
    this.tasks.setBoardView('kanban');
    void this.router.navigate(['/board']);
    this.toast.show(
      taskIds.length
        ? `Board filtered to ${taskIds.length} match${taskIds.length === 1 ? '' : 'es'}`
        : 'No matches to filter',
      'ai',
    );
    this.close();
  }

  clearChat(): void {
    this.messages.set([
      {
        id: 'welcome',
        role: 'assistant',
        text: 'Chat cleared. Ask me to find tasks — for example “overdue backend work” or “assigned to Lina”.',
      },
    ]);
    this.tasks.clearSmartSearch();
  }

  private scrollToBottom(): void {
    const el = this.thread?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}
