// Workspace + project context, fully backed by the API.
// Projects load from the backend; workspaces are derived groupings (one per project)
// so the sidebar can switch projects without any static seed data.

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Project, Workspace } from '../../shared/models/project.models';
import { ProjectApiService } from '../api/project-api.service';
import { BoardApiService } from '../api/board-api.service';
import type { ProjectDto, BoardDto } from '../api/api.types';
import { ToastService } from '../toast/toast.service';
import { IndexedDbService } from '../pwa/indexed-db.service';
import { OfflineSyncService } from '../pwa/offline-sync.service';

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
  private readonly idb = inject(IndexedDbService);
  private readonly offlineSync = inject(OfflineSyncService);

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
    // 1. Immediately hydrate from IndexedDB cache
    void this.idb.getAll<Project>('projects').then((cached) => {
      if (cached.length > 0 && this.projectsState().length === 0) {
        this.projectsState.set(cached);
        if (!this.activeProjectId()) {
          this.selectProject(cached[0].id);
        }
      }
    });

    this.reloadProjects();
  }

  reloadProjects(preferredProjectId?: string): void {
    this.projectApi.list({ limit: 50 }).subscribe({
      next: ({ projects }) => {
        const mapped = projects.map(toProject);
        this.projectsState.set(mapped);
        void this.idb.putMany('projects', mapped);

        if (projects.length > 0) {
          const currentId = preferredProjectId || this.activeProjectId();
          const exists = currentId && projects.some((p) => (p._id || (p as any).id) === currentId);
          const targetId = exists ? currentId : (projects[0]._id || (projects[0] as any).id);
          this.selectProject(targetId);
        } else {
          this.activeProjectId.set(null);
          this.selectedWorkspaceId.set(null);
          this.boardsState.set([]);
          this.activeBoardId.set(null);
        }
      },
      error: () => {
        if (this.projectsState().length === 0) {
          this.projectsState.set([]);
          this.activeProjectId.set(null);
          this.selectedWorkspaceId.set(null);
          this.boardsState.set([]);
          this.activeBoardId.set(null);
        }
      },
    });
  }

  selectProject(projectId: string): void {
    if (!projectId) {
      this.activeProjectId.set(null);
      this.selectedWorkspaceId.set(null);
      this.boardsState.set([]);
      this.activeBoardId.set(null);
      return;
    }
    if (this.activeProjectId() !== projectId) {
      // Switching projects: immediately clear previous boards so stale board tasks are not shown
      this.boardsState.set([]);
      this.activeBoardId.set(null);
    }
    this.activeProjectId.set(projectId);
    this.selectedWorkspaceId.set(projectId);
    this.reloadBoards(projectId);
  }

  reloadBoards(projectId: string): void {
    if (!projectId) {
      this.boardsState.set([]);
      this.activeBoardId.set(null);
      return;
    }
    this.boardApi.listBoards(projectId).subscribe({
      next: (boards) => {
        this.boardsState.set(boards);
        const firstBoardId = boards.length > 0 ? (boards[0]._id || (boards[0] as any).id) : null;
        this.activeBoardId.set(firstBoardId);
      },
      error: () => {
        this.boardsState.set([]);
        this.activeBoardId.set(null);
      },
    });
  }

  createProject(name: string, description?: string, color?: string): void {
    if (!navigator.onLine) {
      const offlineId = `offline-proj-${Date.now()}`;
      const optProject: Project = {
        id: offlineId,
        name,
        team: '1 member',
        progress: 0,
        icon: '📁',
        accent: color || ACCENTS[0],
        members: ['You'],
        description: description || undefined,
      };
      this.isWorkspaceCreatorOpen.set(false);
      this.newWorkspaceName.set('');
      this.projectsState.update((items) => [optProject, ...items]);
      void this.idb.put('projects', optProject);
      void this.offlineSync.enqueue('CREATE_PROJECT', '/projects', 'POST', { name, description, color });
      this.selectProject(offlineId);
      this.toast.show(`Created ${name} (saved offline)`, 'info');
      return;
    }

    this.projectApi.create({ name, description, color }).subscribe({
      next: (res) => {
        this.isWorkspaceCreatorOpen.set(false);
        this.newWorkspaceName.set('');
        const newId = res._id || (res as any).id;
        this.reloadProjects(newId);
        this.toast.show(`Created ${name}`, 'success');
      },
      error: (err) => {
        if (err.status === 0 || !navigator.onLine) {
          const offlineId = `offline-proj-${Date.now()}`;
          const optProject: Project = {
            id: offlineId,
            name,
            team: '1 member',
            progress: 0,
            icon: '📁',
            accent: color || ACCENTS[0],
            members: ['You'],
            description: description || undefined,
          };
          this.isWorkspaceCreatorOpen.set(false);
          this.newWorkspaceName.set('');
          this.projectsState.update((items) => [optProject, ...items]);
          void this.idb.put('projects', optProject);
          void this.offlineSync.enqueue('CREATE_PROJECT', '/projects', 'POST', { name, description, color });
          this.selectProject(offlineId);
          this.toast.show(`Created ${name} (saved offline)`, 'info');
        } else {
          const msg = err?.error?.error?.message || err?.error?.message || 'Could not create project';
          this.toast.show(msg, 'error');
        }
      },
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
  const projId = dto._id || (dto as any).id;
  const members = dto.members || [];
  const memberCount = members.length;
  return {
    id: projId,
    name: dto.name,
    team: `${memberCount} member${memberCount === 1 ? '' : 's'}`,
    progress: 0, // computed once tasks are wired
    icon: dto.icon ?? '📁',
    accent: dto.color ?? ACCENTS[index % ACCENTS.length],
    members: members.map((m) => m.name),
    description: dto.description ?? undefined,
  };
}
