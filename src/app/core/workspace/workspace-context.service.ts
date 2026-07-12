import { Injectable, computed, inject, signal } from '@angular/core';
import { projects } from '../../data/mock/mock-projects';
import { workspaces as seedWorkspaces } from '../../data/mock/mock-workspaces';
import type { Project, Workspace } from '../../shared/models/project.models';
import { ToastService } from '../toast/toast.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceContextService {
  private readonly toast = inject(ToastService);

  readonly projects: Project[] = projects;
  readonly workspaces = signal<Workspace[]>(structuredClone(seedWorkspaces));
  readonly selectedWorkspaceId = signal('collabai');
  readonly isWorkspaceCreatorOpen = signal(false);
  readonly newWorkspaceName = signal('');

  readonly activeWorkspace = computed(
    () => this.workspaces().find((w) => w.id === this.selectedWorkspaceId()) ?? this.workspaces()[0],
  );

  readonly filteredProjects = computed(() =>
    this.projects.filter((p) => this.activeWorkspace().projectNames.includes(p.name)),
  );

  readonly activeProjectName = computed(
    () => this.filteredProjects()[0]?.name ?? this.activeWorkspace().name,
  );

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
    const accents = ['#3b82f6', '#22c55e', '#06b6d4', '#f59e0b', '#a78bfa'];

    this.workspaces.update((items) => [
      ...items,
      {
        id,
        name,
        icon: name[0].toUpperCase(),
        accent: accents[items.length % accents.length],
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
