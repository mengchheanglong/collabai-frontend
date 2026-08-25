import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService } from '../../core/api/ai.service';
import { CommentApiService } from '../../core/api/comment-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import { BoardApiService } from '../../core/api/board-api.service';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { TaskStoreService } from '../../core/state/task-store.service';
import { ToastService } from '../../core/toast/toast.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { chipsFromFilters, SMART_SEARCH_PROMPTS } from '../../shared/lib/ai-search-chips';
import type { AiSearchChip } from '../../shared/models/ai.models';
import type { Priority, Task, TaskStatus } from '../../shared/models/task.models';

type ChatRole = 'assistant' | 'user';

export interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  category?: 'Project' | 'Tasks' | 'System';
  syntax?: string;
  insertText?: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Original user query for board filter labeling. */
  queryLabel?: string;
  chips?: AiSearchChip[];
  tasks?: Task[];
  suggestions?: string[];
  pending?: boolean;
}

@Component({
  selector: 'app-ai-copilot',
  standalone: true,
  imports: [MatRippleModule, MatTooltipModule],
  templateUrl: './ai-copilot.component.html',
  styleUrl: './ai-copilot.component.scss',
})
export class AiCopilotComponent {
  private readonly ai = inject(AiService);
  private readonly comments = inject(CommentApiService);
  private readonly projects = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly boardApi = inject(BoardApiService);
  private readonly tasks = inject(TaskStoreService);
  private readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  @ViewChild('composer') private composer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('thread') private thread?: ElementRef<HTMLDivElement>;

  readonly open = signal(false);
  readonly draft = signal('');
  readonly sending = signal(false);
  readonly showSlashMenu = signal(false);
  readonly selectedCommandIndex = signal(0);
  readonly isInputFocused = signal(false);
  readonly lastReferencedTask = signal<Task | null>(null);
  
  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'CollabAI ready. Type / for commands or ask anything about your project.',
    },
  ]);

  readonly baseCommands: SlashCommand[] = [
    { name: '/project', description: 'Switch active project context', icon: 'folder', category: 'Project', syntax: '/project <name>', insertText: '/project ' },
    { name: '/create', description: 'Generate N tasks with AI', icon: 'auto_awesome', category: 'Tasks', syntax: '/create 5 <topic>', insertText: '/create 5 ' },
    { name: '/task', description: 'Create a single task', icon: 'add_circle', category: 'Tasks', syntax: '/task <title>', insertText: '/task ' },
    { name: '/done', description: 'Mark task as done', icon: 'check_circle', category: 'Tasks', syntax: '/done <task>', insertText: '/done ' },
    { name: '/start', description: 'Move task to in progress', icon: 'play_arrow', category: 'Tasks', syntax: '/start <task>', insertText: '/start ' },
    { name: '/todo', description: 'Move task to to do', icon: 'pending', category: 'Tasks', syntax: '/todo <task>', insertText: '/todo ' },
    { name: '/priority', description: 'Set task priority', icon: 'flag', category: 'Tasks', syntax: '/priority <task> urgent', insertText: '/priority ' },
    { name: '/assign', description: 'Assign task to member', icon: 'person_add', category: 'Tasks', syntax: '/assign <task> to <name>', insertText: '/assign ' },
    { name: '/due', description: 'Set task due date', icon: 'event', category: 'Tasks', syntax: '/due <task> tomorrow', insertText: '/due ' },
    { name: '/tag', description: 'Add label or tag', icon: 'label', category: 'Tasks', syntax: '/tag <task> with <tag>', insertText: '/tag ' },
    { name: '/subtask', description: 'Add subtask to task', icon: 'account_tree', category: 'Tasks', syntax: '/subtask <title> for <task>', insertText: '/subtask ' },
    { name: '/comment', description: 'Post comment on task', icon: 'chat_bubble', category: 'Tasks', syntax: '/comment on <task> saying <text>', insertText: '/comment on ' },
    { name: '/filter', description: 'Filter board by query', icon: 'filter_list', category: 'System', syntax: '/filter <query>', insertText: '/filter ' },
    { name: '/clear', description: 'Clear conversation history', icon: 'cleaning_services', category: 'System', syntax: '/clear', insertText: '/clear' },
    { name: '/help', description: 'List all commands', icon: 'help_outline', category: 'System', syntax: '/help', insertText: '/help' },
  ];

  readonly filteredCommands = computed<SlashCommand[]>(() => {
    const text = this.draft().trim();
    if (!text.startsWith('/')) return [];

    const lower = text.toLowerCase();

    // Dynamic project autocomplete
    if (lower.startsWith('/project ') || lower.startsWith('/p ')) {
      const query = lower.replace(/^\/(?:project|p)\s*/i, '').trim();
      const allProjects = this.workspace.filteredProjects();
      const filtered = query
        ? allProjects.filter((p) => p.name.toLowerCase().includes(query))
        : allProjects;
      return filtered.map((p) => ({
        name: `/project ${p.name}`,
        description: `Set active project context to "${p.name}"`,
        icon: 'folder',
        insertText: `/project ${p.name}`,
      }));
    }

    // Dynamic priority autocomplete
    if (lower.startsWith('/priority ')) {
      const priorities = ['urgent', 'high', 'medium', 'low'];
      return priorities.map((prio) => ({
        name: `/priority <task> ${prio}`,
        description: `Set priority to ${prio}`,
        icon: 'flag',
        insertText: `/priority `,
      }));
    }

    // Dynamic status autocomplete
    if (lower.startsWith('/status ')) {
      const statuses = ['todo', 'in_progress', 'done'];
      return statuses.map((st) => ({
        name: `/status <task> ${st}`,
        description: `Set status to ${st.replace('_', ' ')}`,
        icon: 'sync',
        insertText: `/status `,
      }));
    }

    const query = lower.slice(1);
    const matches = query
      ? this.baseCommands.filter((cmd) => cmd.name.slice(1).toLowerCase().startsWith(query))
      : this.baseCommands;

    return matches.slice(0, 10);
  });

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

  openSlashPalette(): void {
    if (!this.draft().startsWith('/')) {
      this.draft.set('/');
    }
    this.showSlashMenu.set(true);
    this.selectedCommandIndex.set(0);
    queueMicrotask(() => this.composer?.nativeElement.focus());
  }

  applySuggestion(sug: string): void {
    this.draft.set(sug);
    this.send(sug);
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    if (value.startsWith('/')) {
      this.showSlashMenu.set(true);
      this.selectedCommandIndex.set(0);
    } else {
      this.showSlashMenu.set(false);
    }
  }

  selectCommand(cmd: SlashCommand): void {
    if (!cmd) return;
    this.draft.set(cmd.insertText || (cmd.name + ' '));
    this.showSlashMenu.set(false);
    queueMicrotask(() => this.composer?.nativeElement.focus());
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.showSlashMenu() && this.filteredCommands().length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedCommandIndex.update((i) => (i + 1) % this.filteredCommands().length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedCommandIndex.update((i) => (i - 1 + this.filteredCommands().length) % this.filteredCommands().length);
        return;
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault();
        const cmd = this.filteredCommands()[this.selectedCommandIndex()];
        if (cmd) {
          this.selectCommand(cmd);
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.showSlashMenu.set(false);
        return;
      }
    }

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
      text: 'Processing command…',
      pending: true,
    };

    this.messages.update((m) => [...m, userMsg, pending]);
    this.draft.set('');
    this.showSlashMenu.set(false);
    this.sending.set(true);

    // Slash command dispatcher
    if (text.startsWith('/')) {
      const lower = text.toLowerCase();
      if (lower === '/clear') {
        this.clearChat();
        return;
      }
      if (lower === '/help') {
        this.finishMessage(
          pendingId,
          `### 🛠️ CollabAI Slash Commands\n\n` +
          `* \`/project <name>\` — Switch active project context (e.g. \`/project Soccer\`)\n` +
          `* \`/create <count> <topic>\` — Generate N structured tasks (e.g. \`/create 11 football roles\`)\n` +
          `* \`/task <title>\` — Create a single task\n` +
          `* \`/done <task>\` — Mark task as Done\n` +
          `* \`/start <task>\` — Move task to In Progress\n` +
          `* \`/todo <task>\` — Move task to To Do\n` +
          `* \`/priority <task> <level>\` — Set priority (\`low\`, \`medium\`, \`high\`, \`urgent\`)\n` +
          `* \`/assign <task> to <name>\` — Assign member\n` +
          `* \`/due <task> <date>\` — Set due date (\`tomorrow\`, \`Friday\`, etc.)\n` +
          `* \`/tag <task> with <tags>\` — Add labels/tags\n` +
          `* \`/subtask <title> for <task>\` — Add subtask\n` +
          `* \`/comment on <task> saying <text>\` — Post a comment\n` +
          `* \`/filter <query>\` — Filter board\n` +
          `* \`/clear\` — Clear conversation history`
        );
        return;
      }

      if (lower.startsWith('/project ') || lower.startsWith('/p ')) {
        const projName = text.replace(/^\/(?:project|p)\s+/i, '').trim().toLowerCase();
        const found = this.workspace.filteredProjects().find((p) =>
          p.name.toLowerCase() === projName || p.name.toLowerCase().includes(projName)
        );
        if (found) {
          this.workspace.selectProject(found.id);
          this.finishMessage(pendingId, `Switched active project context to **${found.name}**.`);
          this.toast.show(`Project: ${found.name}`, 'success');
        } else {
          this.finishMessage(pendingId, `Could not find project matching "${projName}". Available projects: ${this.workspace.filteredProjects().map((p) => p.name).join(', ')}.`);
        }
        return;
      }
    }

    const projectId = this.workspace.activeProjectId() ?? '';
    if (!projectId) {
      if (this.isProjectCreationRequest(text)) {
        this.createProject(pendingId, text);
        return;
      }
      this.messages.update((list) =>
        list.map((msg) =>
          msg.id === pendingId
            ? {
                ...msg,
                text: 'Select or create a project first, then I can run commands on it.',
                pending: false,
              }
            : msg,
        ),
      );
      this.sending.set(false);
      return;
    }

    const targetProject = this.resolveProject(text);
    if (targetProject === null) {
      this.finishMessage(pendingId, 'I could not find that project. Use its exact name, or select it from the sidebar first.');
      return;
    }
    const targetProjectId = targetProject?.id ?? projectId;
    if (targetProject && targetProject.id !== projectId) {
      this.workspace.selectProject(targetProject.id);
    }

    // Extended slash command handlers with active project target
    if (text.startsWith('/')) {
      const lower = text.toLowerCase();
      if (lower.startsWith('/create ') || lower.startsWith('/task ')) {
        const prompt = text.replace(/^\/(?:create|task)\s+/i, '').trim();
        this.createTask(pendingId, targetProjectId, prompt);
        return;
      }

      if (lower.startsWith('/done ')) {
        const target = text.replace(/^\/done\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'mark ' + target + ' done');
        return;
      }

      if (lower.startsWith('/start ')) {
        const target = text.replace(/^\/start\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'start ' + target);
        return;
      }

      if (lower.startsWith('/todo ')) {
        const target = text.replace(/^\/todo\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'reopen ' + target);
        return;
      }

      if (lower.startsWith('/priority ')) {
        const rest = text.replace(/^\/priority\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'set priority of ' + rest);
        return;
      }

      if (lower.startsWith('/assign ')) {
        const rest = text.replace(/^\/assign\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'assign ' + rest);
        return;
      }

      if (lower.startsWith('/due ')) {
        const rest = text.replace(/^\/due\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'set due date of ' + rest);
        return;
      }

      if (lower.startsWith('/tag ')) {
        const rest = text.replace(/^\/tag\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'tag ' + rest);
        return;
      }

      if (lower.startsWith('/subtask ')) {
        const rest = text.replace(/^\/subtask\s+/i, '').trim();
        this.runTaskAction(pendingId, targetProjectId, 'add subtask ' + rest);
        return;
      }

      if (lower.startsWith('/comment ')) {
        const rest = text.replace(/^\/comment\s+/i, '').trim();
        this.runCommentAction(pendingId, targetProjectId, 'add comment on ' + rest);
        return;
      }

      if (lower.startsWith('/filter ')) {
        const query = text.replace(/^\/filter\s+/i, '').trim();
        this.ai.searchTasks({ projectId: targetProjectId, query }).subscribe({
          next: (data) => {
            const chips = chipsFromFilters(data.interpretedQuery);
            const count = data.tasks.length;
            this.messages.update((list) =>
              list.map((msg) =>
                msg.id === pendingId
                  ? {
                      ...msg,
                      text: count ? `Found ${count} tasks matching "${query}".` : `No tasks found for "${query}".`,
                      queryLabel: query,
                      chips,
                      tasks: data.tasks.slice(0, 8),
                      pending: false,
                    }
                  : msg,
              ),
            );
            this.sending.set(false);
          },
          error: () => this.finishMessage(pendingId, 'Failed to filter tasks.'),
        });
        return;
      }
    }

    if (this.navigateFromRequest(pendingId, text)) return;
    if (this.isProjectCreationRequest(text)) {
      this.createProject(pendingId, text);
      return;
    }
    if (this.tryHandleCompoundAction(pendingId, targetProjectId, text)) return;
    if (this.runTaskAction(pendingId, targetProjectId, text)) return;
    if (this.runCommentAction(pendingId, targetProjectId, text)) return;
    if (this.isCapabilityRequest(text)) {
      this.finishMessage(
        pendingId,
        'I can search and filter tasks across this project; create projects and tasks; move a task to To do, In progress, or Done; set priority; add comments; and open Dashboard, Board, My work, Team, or Profile. Type / for slash command shortcuts!',
      );
      return;
    }

    if (this.isTaskCreationRequest(text)) {
      this.createTask(pendingId, targetProjectId, text);
      return;
    }

    if (this.isTaskIdeaRequest(text)) {
      this.suggestTasks(pendingId, projectId, text);
      return;
    }

    if (this.isTaskSearchRequest(text)) {
      this.performTaskSearch(pendingId, targetProjectId, text);
      return;
    }

    // Conversational Chat with CollabAI!
    const history = this.messages()
      .filter((m) => !m.pending && (m.role === 'user' || m.role === 'assistant'))
      .slice(-6)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }));

    this.ai
      .chat({
        message: text,
        projectId: targetProjectId,
        history,
      })
      .subscribe({
        next: ({ reply }) => {
          this.finishMessage(pendingId, reply);
        },
        error: () => {
          // If chat API fails, fall back to smart search
          this.performTaskSearch(pendingId, targetProjectId, text);
        },
      });
  }

  private isTaskSearchRequest(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      /\b(find|search|filter|show\s+me|list\s+all|lookup)\s+(?:all\s+)?(?:tasks?|issues?|items?|to-?dos?)\b/i.test(lower) ||
      lower.startsWith('find ') ||
      lower.startsWith('search ') ||
      lower.startsWith('filter ') ||
      lower.startsWith('show overdue') ||
      lower.startsWith('show tasks')
    );
  }

  private performTaskSearch(pendingId: string, targetProjectId: string, text: string): void {
    this.ai.searchTasks({ projectId: targetProjectId, query: text }).subscribe({
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
        this.toast.show('AI search failed', 'info');
      },
    });
  }

  openTask(task: Task): void {
    this.lastReferencedTask.set(task);
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

  private suggestTasks(pendingId: string, projectId: string, request: string): void {
    const projectName = this.workspace.activeProjectName();
    this.ai
      .generateSubtasks({
        projectId,
        title: `Plan work for ${projectName}`,
        description: request,
        count: 5,
      })
      .subscribe({
        next: ({ subtasks }) => {
          const suggestions = subtasks.filter(Boolean).slice(0, 5);
          this.messages.update((list) =>
            list.map((msg) =>
              msg.id === pendingId
                ? {
                    ...msg,
                    text: suggestions.length
                      ? `Here are ${suggestions.length} task ideas for ${projectName}. You can use or adapt these on your board.`
                      : 'I could not generate task ideas right now. Please try again.',
                    suggestions,
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
                ? { ...msg, text: 'I could not generate task ideas right now. Please try again.', pending: false }
                : msg,
            ),
          );
          this.sending.set(false);
          this.toast.show('AI task suggestions failed', 'info');
        },
      });
  }

  private extractTaskCount(text: string): number {
    const match =
      text.match(/\b(?:create|add|make|generate)\s+(\d{1,2})\s+(?:distinct\s+|new\s+|experimental\s+)?(?:tasks?|items?|to-?dos?)\b/i) ||
      text.match(/\b(\d{1,2})\s+(?:distinct\s+|new\s+|experimental\s+)?tasks?\b/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 1) {
        return Math.min(num, 15);
      }
    }
    return 1;
  }

  private createTask(pendingId: string, projectId: string, request: string): void {
    const count = this.extractTaskCount(request);
    this.boardApi.listBoards(projectId).subscribe({
      next: (boards) => {
        const boardId = boards[0]?._id || (boards[0] as any)?.id;
        if (!boardId) {
          this.finishCreateError(pendingId);
          return;
        }

        this.ai
          .generateTasks({
            projectId,
            prompt: request,
            count,
          })
          .subscribe({
            next: ({ tasks: structuredTasks }) => {
              const list = (structuredTasks || []).filter((t) => Boolean(t.title));
              if (list.length === 0) {
                // Fallback to title extraction
                const fallbackTitle = this.taskTitleFromRequest(request);
                this.tasks.createTaskFromAi(fallbackTitle, request, projectId, boardId).subscribe({
                  next: (singleTask) => {
                    this.lastReferencedTask.set(singleTask);
                    this.messages.update((msgs) =>
                      msgs.map((msg) =>
                        msg.id === pendingId
                          ? {
                              ...msg,
                              text: `Created “${singleTask.title}” on the active board.`,
                              tasks: [singleTask],
                              pending: false,
                            }
                          : msg,
                      ),
                    );
                    this.sending.set(false);
                    this.toast.show(`Created task: ${singleTask.title}`, 'success');
                  },
                  error: () => this.finishCreateError(pendingId),
                });
                return;
              }

              const observables = list.map((item, idx) =>
                this.tasks.createTaskFromAi(item.title, item.description, projectId, boardId, {
                  status: item.status,
                  subtasks: item.subtasks,
                  priority: item.priority,
                  labels: item.labels,
                  dueDate: item.dueDate,
                  select: list.length === 1 || idx === 0,
                }),
              );

              forkJoin(observables).subscribe({
                next: (createdTasks) => {
                  if (createdTasks.length > 0) {
                    this.lastReferencedTask.set(createdTasks[0]);
                  }
                  const label = createdTasks.length === 1
                    ? `Created “${createdTasks[0].title}” on the active board with description and ${createdTasks[0].subtasks.length} subtasks.`
                    : `Created ${createdTasks.length} complete tasks on the active board with descriptions, subtasks, and priorities.`;

                  this.messages.update((msgs) =>
                    msgs.map((msg) =>
                      msg.id === pendingId
                        ? {
                            ...msg,
                            text: label,
                            tasks: createdTasks,
                            pending: false,
                          }
                        : msg,
                    ),
                  );
                  this.sending.set(false);
                  this.toast.show(
                    `Created ${createdTasks.length} task${createdTasks.length === 1 ? '' : 's'} with full details`,
                    'success',
                  );
                },
                error: () => this.finishCreateError(pendingId),
              });
            },
            error: () => {
              // Fallback to single task creation
              const title = this.taskTitleFromRequest(request);
              this.tasks.createTaskFromAi(title, request, projectId, boardId).subscribe({
                next: (task) => {
                  this.messages.update((msgs) =>
                    msgs.map((msg) =>
                      msg.id === pendingId
                        ? {
                            ...msg,
                            text: `Created “${task.title}” on the active board.`,
                            tasks: [task],
                            pending: false,
                          }
                        : msg,
                    ),
                  );
                  this.sending.set(false);
                  this.toast.show(`Created task: ${task.title}`, 'success');
                },
                error: () => this.finishCreateError(pendingId),
              });
            },
          });
      },
      error: () => this.finishCreateError(pendingId),
    });
  }

  private finishCreateError(pendingId: string): void {
    this.messages.update((list) =>
      list.map((msg) =>
        msg.id === pendingId
          ? {
              ...msg,
              text: 'I could not create that task. Make sure a project and board are selected, then try again.',
              pending: false,
            }
          : msg,
      ),
    );
    this.sending.set(false);
    this.toast.show('AI task creation failed', 'info');
  }

  private isTaskCreationRequest(text: string): boolean {
    return /\b(create|add|make|generate)\b/i.test(text) && /\b(tasks?|to[ -]?dos?|work items?)\b/i.test(text);
  }

  private taskTitleFromRequest(request: string): string {
    let clean = request
      .replace(/^\s*(?:can|could|would)\s+you\s+(?:please\s+)?/i, '')
      .replace(/^\s*(?:please\s+)?(?:help\s+me\s+)?(?:create|add|make|generate)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:\d+\s+)?(?:distinct\s+)?(?:experimental\s+)?(?:tasks?|to[ -]?dos?|work items?)\s*(?:called|named|for|to|about|in|:|-)?\s*/i, '')
      .replace(/[.?!]+$/g, '')
      .trim();

    clean = clean
      .replace(/\s+\b(?:in|for)\s+(?:the\s+)?(?:project|workspace)\s+[“"]?[^”".?!]+[”"]?\s*$/i, '')
      .trim() || 'New task';

    const normalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    return normalized.slice(0, 150);
  }

  private isTaskIdeaRequest(text: string): boolean {
    return /\b(suggest|suggestion|idea|ideas|brainstorm|recommend|plan)\b/i.test(text) &&
      /\b(task|tasks|project|work|feature|features)\b/i.test(text);
  }

  private isProjectCreationRequest(text: string): boolean {
    return /\b(create|add|make)\b/i.test(text) && /\b(project|workspace)\b/i.test(text);
  }

  private createProject(pendingId: string, request: string): void {
    const name = request
      .replace(/^\s*(?:can|could|would)\s+you\s+/i, '')
      .replace(/^\s*(?:please\s+)?(?:create|add|make)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:project|workspace)\s*(?:called|named|for|:|-)?\s*/i, '')
      .replace(/[.?!]+$/g, '')
      .trim()
      .slice(0, 100);

    if (!name) {
      this.finishMessage(pendingId, 'Tell me the project name, for example: “create project Mobile launch”.');
      return;
    }

    this.projects.create({ name }).subscribe({
      next: (project) => {
        const projId = project._id || (project as any).id;
        this.workspace.reloadProjects(projId);
        this.workspace.selectProject(projId);
        this.finishMessage(pendingId, `Created project “${project.name}”.`);
        this.toast.show(`Created project: ${project.name}`, 'success');
      },
      error: () => this.finishMessage(pendingId, 'I could not create that project. Check that you have permission and try again.'),
    });
  }

  private tryHandleCompoundAction(pendingId: string, projectId: string, text: string): boolean {
    const lower = text.toLowerCase();

    // Check if the user is asking to update priority / urgency
    const priorityMatch =
      lower.match(/\b(?:set|make|change)?\s*(?:the\s+)?(?:priority|urgency|ugency)?\s*(?:to|as|is)?\s*\b(low|medium|high|urgent)\b/i) ||
      lower.match(/\b(low|medium|high|urgent)\s*(?:priority|urgency|ugency)?\b/i);

    // Check if the user is asking to assign
    const assignMatch = text.match(
      /(?:assign(?:ed)?(?:\s+it)?\s+to|give(?:\s+it)?\s+to)\s+([A-Za-z0-9_.\s]+?)(?:,|$|\band\b|\bwith\b|\bdue\b|\bset\b)/i,
    );

    // Check if due date is requested
    const dueMatch = text.match(
      /(?:due\s*date\s+(?:to|is|on)?|due\s+(?:on|by)?)\s+([A-Za-z0-9\s-]+?)(?:,|$|\band\b|\bset\b|\bassign\b)/i,
    );

    // If multiple intents exist or pronoun-targeted update is detected:
    const hasMultiple =
      (priorityMatch && assignMatch) ||
      (priorityMatch && dueMatch) ||
      (assignMatch && dueMatch) ||
      (priorityMatch && (lower.includes(' it') || lower.includes(' this') || lower.startsWith('set ')));

    if (hasMultiple) {
      let targetTask = this.lastReferencedTask() || this.tasks.selectedTask();
      if (!targetTask && this.tasks.tasks().length > 0) {
        targetTask = this.tasks.tasks()[0];
      }

      if (targetTask) {
        const updates: Partial<{
          priority: Priority;
          assigneeId: string | null;
          dueDate: string | null;
        }> = {};
        const successMessages: string[] = [];

        if (
          priorityMatch &&
          ['low', 'medium', 'high', 'urgent'].includes(priorityMatch[1].toLowerCase())
        ) {
          const pVal = priorityMatch[1].toLowerCase() as Priority;
          updates.priority = pVal;
          successMessages.push(`priority to **${pVal}**`);
        }

        if (assignMatch) {
          const rawMemberName = assignMatch[1].trim().toLowerCase();
          const foundMember = this.members.members().find(
            (m) =>
              m.name.toLowerCase().includes(rawMemberName) ||
              rawMemberName.includes(m.name.toLowerCase()) ||
              m.email.toLowerCase().includes(rawMemberName),
          );
          if (foundMember) {
            updates.assigneeId = foundMember.id;
            successMessages.push(`assigned to **${foundMember.name}**`);
          }
        }

        if (dueMatch) {
          const parsed = parseDueDate(dueMatch[1].trim());
          if (parsed) {
            updates.dueDate = parsed.toISOString();
            const dateStr = parsed.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            successMessages.push(`due date to **${dateStr}**`);
          }
        }

        if (Object.keys(updates).length > 0) {
          this.taskApi.updateTask(targetTask.id, updates).subscribe({
            next: () => {
              this.reloadActiveBoard();
              this.lastReferencedTask.set({ ...targetTask!, ...(updates as any) });
              this.finishMessage(
                pendingId,
                `Updated “**${targetTask!.title}**”: set ${successMessages.join(' and ')}.`,
              );
              this.toast.show(`Updated ${targetTask!.title}`, 'success');
            },
            error: () =>
              this.finishMessage(
                pendingId,
                `I could not update “${targetTask!.title}”. Please try again.`,
              ),
          });
          return true;
        }
      }
    }
    return false;
  }

  private runTaskAction(pendingId: string, projectId: string, text: string): boolean {
    // 1. Bulk mark all tasks: "mark all done", "move all tasks to in progress"
    const bulkMove = text.match(/(?:mark|set|move)\s+all\s+(?:tasks?\s+)?(?:to|as\s+)?(to\s*do|todo|in\s*progress|done|complete(?:d)?)/i);
    if (bulkMove) {
      const status = this.statusFromText(bulkMove[1]);
      if (status) {
        const activeTasks = this.tasks.tasks();
        if (activeTasks.length === 0) {
          this.finishMessage(pendingId, 'There are no tasks on the active board to update.');
          return true;
        }
        const observables = activeTasks.map((t) => this.taskApi.moveTask(t.id, status, t.position));
        forkJoin(observables).subscribe({
          next: () => {
            this.reloadActiveBoard();
            this.finishMessage(pendingId, `Moved all ${activeTasks.length} tasks to ${this.tasks.statusLabel(status)}.`);
            this.toast.show(`Moved all tasks to ${this.tasks.statusLabel(status)}`, 'success');
          },
          error: () => this.finishMessage(pendingId, 'Failed to update all tasks. Please try again.'),
        });
        return true;
      }
    }

    // 2. Shorthand action verbs: "start <task>", "finish <task>", "complete <task>", "reopen <task>"
    const verbAction = text.match(/^(?:please\s+)?(start|finish|complete|reopen)\s+(?:the\s+)?(?:task\s+)?(.+?)$/i);
    if (verbAction) {
      const verb = verbAction[1].toLowerCase();
      const status: TaskStatus = verb === 'start' ? 'in_progress' : verb === 'reopen' ? 'todo' : 'done';
      this.resolveTask(projectId, verbAction[2], pendingId, (task) => {
        this.taskApi.moveTask(task.id, status, task.position).subscribe({
          next: () => {
            this.reloadActiveBoard();
            this.finishMessage(pendingId, `Moved “${task.title}” to ${this.tasks.statusLabel(status)}.`);
            this.toast.show(`Moved to ${this.tasks.statusLabel(status)}`, 'success');
          },
          error: () => this.finishMessage(pendingId, `I could not update “${task.title}”. Please try again.`),
        });
      });
      return true;
    }

    // 3. Move / set / mark / change status: "mark task X done", "move X to in progress", "set status of X to done"
    const move = text.match(/(?:mark|set|move|change)\s+(?:the\s+)?(?:status\s+(?:of\s+)?)?(?:task\s+)?(.+?)\s+(?:(?:status\s+)?(?:to|as)\s+)?(to\s*do|todo|in\s*progress|done|complete(?:d)?)/i);
    if (move) {
      const status = this.statusFromText(move[2]);
      if (!status) return false;
      this.resolveTask(projectId, move[1], pendingId, (task) => {
        this.taskApi.moveTask(task.id, status, task.position).subscribe({
          next: () => {
            this.reloadActiveBoard();
            this.finishMessage(pendingId, `Moved “${task.title}” to ${this.tasks.statusLabel(status)}.`);
            this.toast.show(`Moved to ${this.tasks.statusLabel(status)}`, 'success');
          },
          error: () => this.finishMessage(pendingId, `I could not move “${task.title}”. Please try again.`),
        });
      });
      return true;
    }

    // 4. Change priority: "set priority of X to high", "change X to urgent priority", "set urgency to high"
    const priority = text.match(/(?:set|change|make)\s+(?:the\s+)?(?:priority\s+(?:of\s+)?|urgency\s+(?:of\s+)?|ugency\s+(?:of\s+)?)?(?:task\s+)?(.+?)\s+(?:(?:to|as|is)\s+)?(low|medium|high|urgent)(?:\s+priority)?/i);
    if (priority) {
      const value = priority[2].toLowerCase() as Priority;
      this.resolveTask(projectId, priority[1], pendingId, (task) => {
        this.taskApi.updateTask(task.id, { priority: value }).subscribe({
          next: () => {
            this.reloadActiveBoard();
            this.finishMessage(pendingId, `Set “${task.title}” to ${value} priority.`);
            this.toast.show(`Priority set to ${value}`, 'success');
          },
          error: () => this.finishMessage(pendingId, `I could not update “${task.title}”. Please try again.`),
        });
      });
      return true;
    }

    // 5. Due date: "set due date of X to tomorrow", "make X due on Friday", "clear due date of X"
    const clearDue = text.match(/(?:clear|remove)\s+(?:the\s+)?due\s*date\s+(?:of|for|from)\s+(.+?)$/i);
    if (clearDue) {
      this.resolveTask(projectId, clearDue[1], pendingId, (task) => {
        this.taskApi.updateTask(task.id, { dueDate: null }).subscribe({
          next: () => {
            this.reloadActiveBoard();
            this.finishMessage(pendingId, `Cleared due date for “${task.title}”.`);
            this.toast.show('Due date cleared', 'success');
          },
          error: () => this.finishMessage(pendingId, `I could not update “${task.title}”. Please try again.`),
        });
      });
      return true;
    }

    const setDue = text.match(/(?:set|change|make)\s+(?:the\s+)?(?:due\s*date\s+(?:of|for)\s+)?(.+?)\s+(?:(?:to|as)\s+due\s+on\s+|(?:to|as)\s+due\s+|(?:due\s*date\s+(?:to|as)\s+)|(?:due\s+(?:on\s+)?))(.+?)$/i);
    if (setDue) {
      const taskQuery = setDue[1].trim();
      const dateText = setDue[2].trim();
      const parsedDate = parseDueDate(dateText);
      if (parsedDate) {
        this.resolveTask(projectId, taskQuery, pendingId, (task) => {
          this.taskApi.updateTask(task.id, { dueDate: parsedDate.toISOString() }).subscribe({
            next: () => {
              this.reloadActiveBoard();
              const formattedDate = parsedDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              this.finishMessage(pendingId, `Set due date of “${task.title}” to ${formattedDate}.`);
              this.toast.show(`Due date set to ${formattedDate}`, 'success');
            },
            error: () => this.finishMessage(pendingId, `I could not update “${task.title}”. Please try again.`),
          });
        });
        return true;
      }
    }
    // 6. Assign / Unassign: "assign Goalkeeper to Lina", "unassign Goalkeeper"
    const unassign = text.match(/(?:unassign|remove\s+assignee\s+(?:from|for))\s+(?:the\s+)?(?:task\s+)?(.+?)$/i);
    if (unassign) {
      this.resolveTask(projectId, unassign[1], pendingId, (task) => {
        this.taskApi.updateTask(task.id, { assigneeId: null }).subscribe({
          next: () => {
            this.reloadActiveBoard();
            this.finishMessage(pendingId, `Unassigned “${task.title}”.`);
            this.toast.show('Task unassigned', 'success');
          },
          error: () => this.finishMessage(pendingId, `I could not update “${task.title}”. Please try again.`),
        });
      });
      return true;
    }

    const assign = text.match(/(?:assign)\s+(?:the\s+)?(?:task\s+)?(.+?)\s+(?:to)\s+(.+?)$/i);
    if (assign) {
      const taskQuery = assign[1].trim();
      const memberQuery = assign[2].trim().toLowerCase();
      const foundMember = this.members.members().find((m) =>
        m.name.toLowerCase().includes(memberQuery) || m.email.toLowerCase().includes(memberQuery)
      );
      if (foundMember) {
        this.resolveTask(projectId, taskQuery, pendingId, (task) => {
          this.taskApi.updateTask(task.id, { assigneeId: foundMember.id }).subscribe({
            next: () => {
              this.reloadActiveBoard();
              this.finishMessage(pendingId, `Assigned “${task.title}” to ${foundMember.name}.`);
              this.toast.show(`Assigned to ${foundMember.name}`, 'success');
            },
            error: () => this.finishMessage(pendingId, `I could not assign “${task.title}”. Please try again.`),
          });
        });
        return true;
      }
    }

    // 7. Add Labels / Tags: "tag Goalkeeper with soccer, defense", "add label urgent to Striker"
    const addTag = text.match(/(?:add\s+labels?|tag)\s+(?:the\s+)?(?:task\s+)?(.+?)\s+(?:with|as)\s+(.+?)$/i);
    if (addTag) {
      const taskQuery = addTag[1].trim();
      const tags = addTag[2].split(/[,#\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (tags.length > 0) {
        this.resolveTask(projectId, taskQuery, pendingId, (task) => {
          const merged = Array.from(new Set([...task.labels, ...tags]));
          this.taskApi.updateTask(task.id, { labels: merged }).subscribe({
            next: () => {
              this.reloadActiveBoard();
              this.finishMessage(pendingId, `Added labels [${tags.join(', ')}] to “${task.title}”.`);
              this.toast.show('Labels updated', 'success');
            },
            error: () => this.finishMessage(pendingId, `I could not update labels for “${task.title}”. Please try again.`),
          });
        });
        return true;
      }
    }

    // 8. Rename task: "rename task X to Y"
    const rename = text.match(/(?:rename)\s+(?:the\s+)?(?:task\s+)?(.+?)\s+(?:to)\s+[“"]?(.+?)[”"]?$/i);
    if (rename) {
      const taskQuery = rename[1].trim();
      const newTitle = rename[2].trim();
      if (newTitle) {
        this.resolveTask(projectId, taskQuery, pendingId, (task) => {
          this.taskApi.updateTask(task.id, { title: newTitle }).subscribe({
            next: () => {
              this.reloadActiveBoard();
              this.finishMessage(pendingId, `Renamed task to “${newTitle}”.`);
              this.toast.show('Task renamed', 'success');
            },
            error: () => this.finishMessage(pendingId, 'I could not rename that task. Please try again.'),
          });
        });
        return true;
      }
    }

    // 9. Add Subtask: "add subtask Clean boots to Goalkeeper"
    const addSubtask = text.match(/(?:add\s+subtask)\s+[“"]?(.+?)[”"]?\s+(?:to|for)\s+(.+?)$/i);
    if (addSubtask) {
      const subtaskTitle = addSubtask[1].trim();
      const taskQuery = addSubtask[2].trim();
      if (subtaskTitle) {
        this.resolveTask(projectId, taskQuery, pendingId, (task) => {
          this.tasks.addManualSubtask(task.id, subtaskTitle);
          this.finishMessage(pendingId, `Added subtask “${subtaskTitle}” to “${task.title}”.`);
        });
        return true;
      }
    }

    return false;
  }

  private runCommentAction(pendingId: string, projectId: string, text: string): boolean {
    const comment = text.match(/(?:add|post|leave|write)\s+(?:a\s+)?comment\s+(?:on|to|for)\s+(.+?)\s+(?:saying|that says|with)\s+[“"]?(.+?)[”"]?\s*$/i);
    if (!comment) return false;
    const body = comment[2].trim();
    if (!body) {
      this.finishMessage(pendingId, 'Include the comment text after “saying”.');
      return true;
    }
    this.resolveTask(projectId, comment[1], pendingId, (task) => {
      this.comments.createComment(task.id, body).subscribe({
        next: () => {
          this.tasks.incrementCommentCount(task.id);
          this.finishMessage(pendingId, `Added your comment to “${task.title}”.`);
        },
        error: () => this.finishMessage(pendingId, 'I could not add that comment. Please try again.'),
      });
    });
    return true;
  }

  private resolveTask(projectId: string, query: string, pendingId: string, onFound: (task: Task) => void): void {
    const cleanQuery = query.replace(/^(?:the\s+)?(?:task\s+)?/i, '').replace(/[.?!]+$/g, '').trim().toLowerCase();

    // Check contextual/pronoun target ("it", "this", "that", "the task", "this task", "ugency", "urgency", "priority")
    const isContextual =
      !cleanQuery ||
      cleanQuery === 'it' ||
      cleanQuery === 'this' ||
      cleanQuery === 'that' ||
      cleanQuery === 'the task' ||
      cleanQuery === 'this task' ||
      cleanQuery === 'current task' ||
      cleanQuery === 'ugency' ||
      cleanQuery === 'urgency' ||
      cleanQuery === 'priority';

    if (isContextual) {
      const candidate = this.lastReferencedTask() || this.tasks.selectedTask() || this.tasks.tasks()[0];
      if (candidate) {
        this.lastReferencedTask.set(candidate);
        onFound(candidate);
        return;
      }
    }

    const exactMatches = this.tasks.tasks().filter((task) => task.title.toLowerCase() === cleanQuery);
    if (exactMatches.length === 1) {
      this.lastReferencedTask.set(exactMatches[0]);
      onFound(exactMatches[0]);
      return;
    }

    const partialMatches = this.tasks.tasks().filter((task) => {
      const t = task.title.toLowerCase();
      return t.includes(cleanQuery) || cleanQuery.includes(t) || cleanQuery.split(' ').some((word) => word.length >= 4 && t.includes(word));
    });
    if (partialMatches.length === 1) {
      this.lastReferencedTask.set(partialMatches[0]);
      onFound(partialMatches[0]);
      return;
    }

    this.ai.searchTasks({ projectId, query: cleanQuery }).subscribe({
      next: ({ tasks }) => {
        if (tasks.length >= 1) {
          this.lastReferencedTask.set(tasks[0]);
          onFound(tasks[0]);
        } else {
          // If no search matches and lastReferencedTask exists, fall back to lastReferencedTask
          const candidate = this.lastReferencedTask() || this.tasks.selectedTask();
          if (candidate) {
            this.lastReferencedTask.set(candidate);
            onFound(candidate);
          } else {
            this.finishMessage(pendingId, `I couldn’t find a task matching “${query.trim()}”.`);
          }
        }
      },
      error: () => this.finishMessage(pendingId, 'I could not look up that task. Please try again.'),
    });
  }

  /**
   * Resolve an explicit “in/from/for project <name>” qualifier. An omitted qualifier
   * intentionally means the project currently selected in the sidebar.
   */
  private resolveProject(text: string): { id: string; name: string } | undefined | null {
    const reference = text.match(/\b(?:in|from|for)\s+(?:the\s+)?(?:project|workspace)\s+[“"]?([^”".?!]+)[”"]?/i)?.[1]?.trim();
    if (!reference) {
      const namedProjects = this.workspace
        .filteredProjects()
        .filter((project) => project.name.trim().length >= 3 && text.toLocaleLowerCase().includes(project.name.toLocaleLowerCase()));
      return namedProjects.length === 1
        ? { id: namedProjects[0].id, name: namedProjects[0].name }
        : undefined;
    }

    const normalized = reference.toLocaleLowerCase();
    const matches = this.workspace
      .filteredProjects()
      .filter((project) => project.name.toLocaleLowerCase() === normalized);
    if (matches.length === 1) return { id: matches[0].id, name: matches[0].name };

    const partialMatches = this.workspace
      .filteredProjects()
      .filter((project) => project.name.toLocaleLowerCase().includes(normalized));
    return partialMatches.length === 1
      ? { id: partialMatches[0].id, name: partialMatches[0].name }
      : null;
  }

  private reloadActiveBoard(): void {
    const boardId = this.workspace.activeBoardId();
    if (boardId) this.tasks.loadBoard(boardId);
  }

  private navigateFromRequest(pendingId: string, text: string): boolean {
    if (!/\b(open|go to|show|take me to|navigate)\b/i.test(text)) return false;
    const target = [
      { words: /\b(dashboard|home)\b/i, route: '/dashboard', label: 'Dashboard' },
      { words: /\b(board|kanban)\b/i, route: '/board', label: 'Board' },
      { words: /\b(my work|work)\b/i, route: '/work', label: 'My work' },
      { words: /\b(team|members)\b/i, route: '/team', label: 'Team' },
      { words: /\b(profile|account|settings)\b/i, route: '/profile', label: 'Profile' },
    ].find((candidate) => candidate.words.test(text));
    if (!target) return false;
    void this.router.navigate([target.route]);
    this.finishMessage(pendingId, `Opening ${target.label}.`);
    return true;
  }

  private statusFromText(value: string): TaskStatus | null {
    const normalized = value.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized === 'todo' || normalized === 'open' || normalized === 'reopen') return 'todo';
    if (normalized === 'inprogress' || normalized === 'progress' || normalized === 'doing' || normalized === 'start' || normalized === 'started') return 'in_progress';
    if (normalized === 'done' || normalized === 'complete' || normalized === 'completed' || normalized === 'finished') return 'done';
    return null;
  }

  private isCapabilityRequest(text: string): boolean {
    return /\b(what can you do|help|commands|capabilities)\b/i.test(text);
  }

  private finishMessage(pendingId: string, text: string): void {
    this.messages.update((list) =>
      list.map((msg) => (msg.id === pendingId ? { ...msg, text, pending: false } : msg)),
    );
    this.sending.set(false);
  }

  private scrollToBottom(): void {
    const el = this.thread?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}

function parseDueDate(text: string): Date | null {
  const clean = text.trim().toLowerCase();
  const now = new Date();
  if (clean === 'today') {
    now.setHours(23, 59, 59, 999);
    return now;
  }
  if (clean === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  if (clean === 'next week') {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const inDaysMatch = clean.match(/^in\s+(\d+)\s+days?$/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = clean.match(/^(?:this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i);
  if (dayMatch) {
    const targetDay = daysOfWeek.indexOf(dayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let diff = targetDay - currentDay;
    if (diff <= 0) diff += 7;
    const d = new Date();
    d.setDate(d.getDate() + diff);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}
