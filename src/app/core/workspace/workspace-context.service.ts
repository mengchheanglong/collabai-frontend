// Workspace + project context, fully backed by the API.
// Projects load from the backend; workspaces are derived groupings (one per project)
// so the sidebar can switch projects without any static seed data.

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Project, Workspace } from '../../shared/models/project.models';
import { ProjectApiService } from '../api/project-api.service';
import { BoardApiService } from '../api/board-api.service';
import type { ProjectDto, BoardDto } from '../api/api.types';
import { ToastService } from '../toast/toast.service';

const ACCENTS = ['#3b82f6', '#22c55e', '#06b6d4', '#f59e0b', '#0ea5e9', '#ef4444'];

const EMPTY_WORKSPACE: Workspace = {
  id: '',
  name: 'No project selected',
  icon: 'P',
  accent: ACCENTS[0],
  projectNames: [],
  description: 'Create a project to start planning work.',
};

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  private readonly toast = inject(ToastService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly boardApi = inject(BoardApiService);

  /** Real projects loaded from the backend. */
  private readonly projectsState = signal<Project[]>([]);
  private readonly boardsState = signal<BoardDto[]>([]);

  readonly activeProjectId = signal<string | null>(null);
  readonly activeBoardId = signal<string | null>(null);

  readonly selectedWorkspaceId = signal<string | null>(null);
  readonly isWorkspaceCreatorOpen = signal(false);
  readonly newWorkspaceName = signal('');

  /** Workspaces derived from the real projects (one per project). */
  readonly workspaces = computed<Workspace[]>(() =>
    this.projectsState().map((project, index) => ({
      id: project.id,
      name: project.name,
      icon: (project.name[0] ?? 'P').toUpperCase(),
      accent: project.accent ?? ACCENTS[index % ACCENTS.length],
      projectNames: [project.name],
      description: project.description ?? '',
    })),
  );

  /** Always expose a workspace-shaped value so empty backend responses remain safe to render. */
  readonly activeWorkspace = computed<Workspace>(
    () =>
      this.workspaces().find((w) => w.id === this.selectedWorkspaceId()) ??
      this.workspaces()[0] ??
      EMPTY_WORKSPACE,
  );

  /** Live projects for the current user (backend-scoped). */
  readonly filteredProjects = computed(() => this.projectsState());

  readonly activeProjectName = computed(
    () =>
      this.filteredProjects().find((p) => p.id === this.activeProjectId())?.name ??
      this.activeWorkspace().name,
  );

  readonly boards = computed(() => this.boardsState());

  constructor() {
    this.reloadProjects();
  }

  reloadProjects(): void {
    this.projectApi.list({ limit: 50 }).subscribe({
      next: ({ projects }) => {
        this.projectsState.set(projects.map(toProject));
        if (projects.length > 0 && !this.activeProjectId()) {
          this.selectProject(projects[0]._id);
          this.selectedWorkspaceId.set(projects[0]._id);
        }
      },
      error: () => {
        /* not signed in / backend down -> empty list */
      },
    });
  }

  selectProject(projectId: string): void {
    this.activeProjectId.set(projectId);
    this.selectedWorkspaceId.set(projectId);
    this.reloadBoards(projectId);
  }

  reloadBoards(projectId: string): void {
    this.boardApi.listBoards(projectId).subscribe({
      next: (boards) => {
        this.boardsState.set(boards);
        this.activeBoardId.set(boards.length > 0 ? boards[0]._id : null);
      },
      error: () => this.boardsState.set([]),
    });
  }

  createProject(name: string, description?: string, color?: string): void {
    this.projectApi.create({ name, description, color }).subscribe({
      next: () => {
        this.isWorkspaceCreatorOpen.set(false);
        this.newWorkspaceName.set('');
        this.reloadProjects();
        this.toast.show(`Created ${name}`, 'success');
      },
      error: () => this.toast.show('Could not create project', 'info'),
    });
  }

  toggleWorkspaceCreator(): void {
    this.isWorkspaceCreatorOpen.update((open) => !open);
  }

  /** Creates a real project from the inline sidebar input. Returns the name or null if empty. */
  addWorkspace(rawName = this.newWorkspaceName()): string | null {
    const name = rawName.trim();
    if (!name) return null;
    this.createProject(name);
    return name;
  }

  selectWorkspace(workspaceId: string): void {
    this.selectedWorkspaceId.set(workspaceId);
    this.isWorkspaceCreatorOpen.set(false);
    this.newWorkspaceName.set('');
    const project = this.projectsState().find((p) => p.id === workspaceId);
    if (project) this.selectProject(project.id);
  }
}

// ----- mapping: contract DTO -> component model -----

function toProject(dto: ProjectDto, index: number): Project {
  const memberCount = dto.members.length;
  return {
    id: dto._id,
    name: dto.name,
    team: `${memberCount} member${memberCount === 1 ? '' : 's'}`,
    progress: 0, // computed once tasks are wired
    icon: dto.icon ?? '📁',
    accent: dto.color ?? ACCENTS[index % ACCENTS.length],
    members: dto.members.map((m) => m.name),
    description: dto.description ?? undefined,
  };
}
