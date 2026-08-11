import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { CommandCenterService } from './command-center.service';
import { MemberDirectoryService } from '../state/member-directory.service';
import { TaskStoreService } from '../state/task-store.service';
import { ThemeService } from '../theme/theme.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { MAIN_NAV_ITEMS } from '../../shared/lib/nav-items';
import type { Member } from '../../shared/models/member.models';
import type { Project, Workspace } from '../../shared/models/project.models';
import type { Task } from '../../shared/models/task.models';

type CommandSection =
  | 'Quick actions'
  | 'Navigation'
  | 'Recent tasks'
  | 'Tasks'
  | 'Projects'
  | 'Workspaces'
  | 'People';
type CommandKind = 'action' | 'navigation' | 'task' | 'project' | 'workspace' | 'member';

interface CommandItem {
  id: string;
  section: CommandSection;
  kind: CommandKind;
  title: string;
  subtitle: string;
  icon: string;
  shortcut?: string;
  task?: Task;
  project?: Project;
  workspace?: Workspace;
  member?: Member;
}

interface CommandGroup {
  section: CommandSection;
  items: CommandItem[];
}

const RECENT_TASKS_STORAGE_KEY = 'collabai.command-center.recent-task-ids';

@Component({
  selector: 'app-command-center',
  standalone: true,
  imports: [MatRippleModule],
  templateUrl: './command-center.component.html',
  styleUrl: './command-center.component.scss',
})
export class CommandCenterComponent {
  private readonly router = inject(Router);
  readonly commandCenter = inject(CommandCenterService);
  private readonly tasks = inject(TaskStoreService);
  private readonly workspace = inject(WorkspaceContextService);
  private readonly members = inject(MemberDirectoryService);
  private readonly theme = inject(ThemeService);

  @ViewChild('dialog') private dialog?: ElementRef<HTMLElement>;
  @ViewChild('queryInput') private queryInput?: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  readonly selectedIndex = signal(0);
  private readonly recentTaskIds = signal<string[]>(this.readRecentTaskIds());
  private lastFocusedElement: HTMLElement | null = null;
  private paletteWasOpen = false;

  readonly groups = computed<CommandGroup[]>(() => {
    const query = this.query().trim().toLowerCase();
    const items = this.allItems();
    const matches = query
      ? items.filter((item) => this.matches(item, query)).slice(0, 18)
      : this.defaultItems(items);
    const sections: CommandSection[] = [
      'Quick actions',
      'Navigation',
      'Recent tasks',
      'Tasks',
      'Projects',
      'Workspaces',
      'People',
    ];

    return sections
      .map((section) => ({ section, items: matches.filter((item) => item.section === section) }))
      .filter((group) => group.items.length > 0);
  });

  readonly activeOptionId = computed(() => {
    const items = this.flatItems();
    return items.length ? this.optionId(Math.min(this.selectedIndex(), items.length - 1)) : null;
  });

  constructor() {
    effect(() => {
      const isOpen = this.commandCenter.isOpen();
      if (isOpen && !this.paletteWasOpen) {
        this.lastFocusedElement =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        queueMicrotask(() => this.queryInput?.nativeElement.focus());
      }
      this.paletteWasOpen = isOpen;
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (isShortcut) {
      event.preventDefault();
      this.commandCenter.isOpen() ? this.close() : this.open();
      return;
    }

    if (this.commandCenter.isOpen()) this.onDialogKeydown(event);
  }

  open(): void {
    this.query.set('');
    this.selectedIndex.set(0);
    this.commandCenter.open();
  }

  close(): void {
    this.commandCenter.close();
    this.query.set('');
    this.selectedIndex.set(0);
    queueMicrotask(() => this.lastFocusedElement?.focus());
  }

  onQueryInput(value: string): void {
    this.query.set(value);
    this.selectedIndex.set(0);
  }

  onDialogKeydown(event: KeyboardEvent): void {
    const items = this.flatItems();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.set((this.selectedIndex() + 1) % Math.max(items.length, 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.set((this.selectedIndex() - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.selectedIndex.set(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.selectedIndex.set(Math.max(items.length - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      const selected = items[this.selectedIndex()];
      if (selected) {
        event.preventDefault();
        this.execute(selected);
      }
      return;
    }
    if (event.key === 'Tab') this.trapFocus(event);
  }

  execute(item: CommandItem): void {
    if (item.kind === 'action') {
      this.runAction(item.id);
      return;
    }

    if (item.kind === 'navigation') {
      void this.router.navigate([`/${item.id}`]);
    } else if (item.kind === 'task' && item.task) {
      this.openTask(item.task);
    } else if (item.kind === 'project' && item.project) {
      this.openProject(item.project);
    } else if (item.kind === 'workspace' && item.workspace) {
      this.workspace.selectWorkspace(item.workspace.id);
      this.tasks.clearUiState();
      void this.router.navigate(['/dashboard']);
    } else if (item.kind === 'member') {
      void this.router.navigate(['/team']);
    }

    this.close();
  }

  optionId(index: number): string {
    return `command-center-option-${index}`;
  }

  itemIndex(item: CommandItem): number {
    return this.flatItems().findIndex((candidate) => candidate.id === item.id);
  }

  private allItems(): CommandItem[] {
    const quickActions: CommandItem[] = [
      {
        id: 'create-task',
        section: 'Quick actions',
        kind: 'action',
        title: 'Create a task',
        subtitle: 'Add a new task to the active project',
        icon: 'add_task',
        shortcut: 'C',
      },
      {
        id: 'toggle-theme',
        section: 'Quick actions',
        kind: 'action',
        title: 'Change color theme',
        subtitle: `Switch from ${this.theme.mode()} mode`,
        icon: 'palette',
      },
    ];
    const navigation: CommandItem[] = MAIN_NAV_ITEMS.map((page) => ({
      id: page.key,
      section: 'Navigation',
      kind: 'navigation',
      title: `Go to ${page.label}`,
      subtitle: 'Navigate to this page',
      icon: page.icon,
      shortcut: page.key === 'dashboard' ? 'G H' : page.key === 'board' ? 'G B' : undefined,
    }));
    navigation.push({
      id: 'profile',
      section: 'Navigation',
      kind: 'navigation',
      title: 'Go to your profile',
      subtitle: 'Account and appearance preferences',
      icon: 'person',
    });

    const recent = this.recentTaskIds()
      .map((id) => this.tasks.tasks().find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task))
      .map((task) => this.taskItem(task, 'Recent tasks'));
    const tasks = this.tasks.tasks().map((task) => this.taskItem(task, 'Tasks'));
    const projects = this.workspace.projects.map((project) => ({
      id: `project-${project.id}`,
      section: 'Projects' as const,
      kind: 'project' as const,
      title: project.name,
      subtitle: `${project.team} · ${project.progress}% complete`,
      icon: 'folder',
      project,
    }));
    const workspaces = this.workspace.workspaces().map((item) => ({
      id: `workspace-${item.id}`,
      section: 'Workspaces' as const,
      kind: 'workspace' as const,
      title: item.name,
      subtitle: item.description,
      icon: 'workspaces',
      workspace: item,
    }));
    const people = this.members.members().map((member) => ({
      id: `member-${member.id}`,
      section: 'People' as const,
      kind: 'member' as const,
      title: member.name,
      subtitle: `${member.role} · ${member.email}`,
      icon: 'person',
      member,
    }));

    return [...quickActions, ...navigation, ...recent, ...tasks, ...projects, ...workspaces, ...people];
  }

  private defaultItems(items: CommandItem[]): CommandItem[] {
    const quickActions = items.filter((item) => item.section === 'Quick actions');
    const navigation = items.filter((item) => item.section === 'Navigation').slice(0, 3);
    const recent = items.filter((item) => item.section === 'Recent tasks').slice(0, 4);
    return [...quickActions, ...navigation, ...recent];
  }

  private taskItem(task: Task, section: 'Recent tasks' | 'Tasks'): CommandItem {
    return {
      id: `${section === 'Recent tasks' ? 'recent' : 'task'}-${task.id}`,
      section,
      kind: 'task',
      title: task.title,
      subtitle: `${task.id} · ${task.project} · ${task.status.replace('_', ' ')}`,
      icon: 'task_alt',
      task,
    };
  }

  private matches(item: CommandItem, query: string): boolean {
    const terms = query.split(/\s+/).filter(Boolean);
    const searchable = `${item.title} ${item.subtitle} ${item.id}`.toLowerCase();
    return terms.every((term) => searchable.includes(term));
  }

  private flatItems(): CommandItem[] {
    return this.groups().flatMap((group) => group.items);
  }

  private runAction(actionId: string): void {
    if (actionId === 'create-task') {
      this.tasks.addQuickTask();
      void this.router.navigate(['/board']);
    } else if (actionId === 'toggle-theme') {
      this.theme.toggle();
    }
    this.close();
  }

  private openTask(task: Task): void {
    const taskWorkspace = this.workspace.workspaces().find((item) => item.projectNames.includes(task.project));
    if (taskWorkspace) this.workspace.selectWorkspace(taskWorkspace.id);
    this.tasks.clearUiState();
    this.tasks.selectTask(task);
    this.tasks.setBoardView('kanban');
    this.rememberTask(task.id);
    void this.router.navigate(['/board']);
  }

  private openProject(project: Project): void {
    const projectWorkspace = this.workspace.workspaces().find((item) => item.projectNames.includes(project.name));
    if (projectWorkspace) this.workspace.selectWorkspace(projectWorkspace.id);
    this.tasks.clearUiState();
    void this.router.navigate(['/dashboard']);
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.dialog?.nativeElement.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private rememberTask(taskId: string): void {
    const next = [taskId, ...this.recentTaskIds().filter((id) => id !== taskId)].slice(0, 4);
    this.recentTaskIds.set(next);
    try {
      localStorage.setItem(RECENT_TASKS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The palette remains usable when browser storage is unavailable.
    }
  }

  private readRecentTaskIds(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(RECENT_TASKS_STORAGE_KEY) ?? '[]');
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string').slice(0, 4)
        : [];
    } catch {
      return [];
    }
  }
}
