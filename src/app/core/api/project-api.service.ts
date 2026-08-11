// src/app/core/api/project-api.service.ts
//
// Typed client for the projects + membership endpoints. Returns backend contract DTOs
// (ProjectDto/ProjectMemberDto). Consumers map these to component models. Endpoints per
// docs/API-CONTRACT.md §4–5.

import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from './api-client.service';
import type {
  PaginationMeta,
  ProjectDto,
  ProjectMemberDto,
  ProjectRole,
} from './api.types';

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface ProjectListPage {
  projects: ProjectDto[];
  meta?: PaginationMeta;
}

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly api = inject(ApiClient);

  list(query?: { q?: string; page?: number; limit?: number }): Observable<ProjectListPage> {
    return this.api
      .getList<ProjectDto[]>('/projects', query)
      .pipe(map((res) => ({ projects: res.data, meta: res.meta })));
  }

  create(input: CreateProjectInput): Observable<ProjectDto> {
    return this.api
      .post<{ project: ProjectDto }>('/projects', input)
      .pipe(map((d) => d.project));
  }

  get(projectId: string): Observable<ProjectDto> {
    return this.api
      .get<{ project: ProjectDto }>(`/projects/${projectId}`)
      .pipe(map((d) => d.project));
  }

  update(projectId: string, input: UpdateProjectInput): Observable<ProjectDto> {
    return this.api
      .patch<{ project: ProjectDto }>(`/projects/${projectId}`, input)
      .pipe(map((d) => d.project));
  }

  remove(projectId: string): Observable<void> {
    return this.api.delete<null>(`/projects/${projectId}`).pipe(map(() => void 0));
  }

  // ----- members -----

  listMembers(projectId: string): Observable<ProjectMemberDto[]> {
    return this.api
      .get<{ members: ProjectMemberDto[] }>(`/projects/${projectId}/members`)
      .pipe(map((d) => d.members));
  }

  addMember(
    projectId: string,
    email: string,
    role: Exclude<ProjectRole, 'owner'> = 'member',
  ): Observable<ProjectDto> {
    return this.api
      .post<{ project: ProjectDto }>(`/projects/${projectId}/members`, {
        email,
        role,
      })
      .pipe(map((d) => d.project));
  }

  updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Observable<ProjectDto> {
    return this.api
      .patch<{ project: ProjectDto }>(
        `/projects/${projectId}/members/${userId}`,
        { role },
      )
      .pipe(map((d) => d.project));
  }

  removeMember(projectId: string, userId: string): Observable<ProjectDto> {
    return this.api
      .delete<{ project: ProjectDto }>(`/projects/${projectId}/members/${userId}`)
      .pipe(map((d) => d.project));
  }
}
