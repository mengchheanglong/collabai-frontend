// src/app/core/workspace/workspace-context.service.ts
//
// Workspace + project context. Projects are NOW LOADED FROM THE BACKEND (the current user's
// projects, mapped ProjectDto -> Project). Workspaces remain a local grouping concept (the
// backend has none) and keep driving the sidebar/board seed context. `filteredProjects`
// returns the real projects so the dashboard shows live data; the board's task filter still
// uses the seed workspace project names (tasks are wired in a later phase).

import { Injectable, computed, inject, signal } from '@angular/core';
import { workspaces as seedWorkspaces } from '../../data/mock/mock-workspaces';
import type { Project, Workspace } from '../../shared/models/project.models';
import { ProjectApiService } from '../api/project-api.service';
import { BoardApiService } from '../api/board-api.service';
import type { ProjectDto, BoardDto } from '../api/api.types';
import { ToastService } from '../toast/toast.service';

const ACCENTS = ['#3b82f6', '#22c55e', '#06b6d4', '#f59e0b', '#0ea5e9', '#ef4444'];

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

  readonly workspaces = signal<Workspace[]>(structuredClone(seedWorkspaces));
  readonly selectedWorkspaceId = signal('collabai');
  readonly isWorkspaceCreatorOpen = signal(false);
  readonly newWorkspaceName = signal('');

  readonly activeWorkspace = computed(
    () => this.workspaces().find((w) => w.id === this.selectedWorkspaceId()) ?? this.workspaces()[0],
  );

  /** Live projects for the current user (backend-scoped). */
  readonly filteredProjects = computed(() => this.projectsState());

  readonly activeProjectName = computed(
    () => this.filteredProjects().find(p => p.id === this.activeProjectId())?.name ?? this.activeWorkspace().name,
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
        }
      },
      error: () => {
        /* not signed in / backend down -> empty list */
      },
    });
  }

  selectProject(projectId: string): void {
    this.activeProjectId.set(projectId);
    this.reloadBoards(projectId);
  }

  reloadBoards(projectId: string): void {
    this.boardApi.listBoards(projectId).subscribe({
      next: (boards) => {
        this.boardsState.set(boards);
        if (boards.length > 0) {
          this.activeBoardId.set(boards[0]._id);
        } else {
          this.activeBoardId.set(null);
        }
      },
      error: () => this.boardsState.set([])
    });
  }

  createProject(name: string, description?: string, color?: string): void {
    this.projectApi.create({ name, description, color }).subscribe({
      next: () => {
        this.reloadProjects();
        this.toast.show(`Created ${name}`, 'success');
      },
      error: () => this.toast.show('Could not create project', 'info'),
    });
  }

  selectWorkspace(workspaceId: string): void {
    this.selectedWorkspaceId.set(workspaceId);
    this.isWorkspaceCreatorOpen.set(false);
    this.newWorkspaceName.set('');
  }

  toggleWorkspaceCreator(): void {
    this.isWorkspaceCreatorOpen.update((open) => !open);
  }

  addWorkspace(rawName = this.newWorkspaceName()): string | null {
    const name = rawName.trim();
    if (!name) return null;

    const baseId =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `workspace-${this.workspaces().length + 1}`;
    const id = this.workspaces().some((w) => w.id === baseId)
      ? `${baseId}-${this.workspaces().length + 1}`
      : baseId;

    this.workspaces.update((items) => [
      ...items,
      {
        id,
        name,
        icon: name[0].toUpperCase(),
        accent: ACCENTS[items.length % ACCENTS.length],
        projectNames: [],
        description: 'New workspace',
      },
    ]);
    this.newWorkspaceName.set('');
    this.selectWorkspace(id);
    this.toast.show(`Created ${name}`, 'success');
    return id;
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
