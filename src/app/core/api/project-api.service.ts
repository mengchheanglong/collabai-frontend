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
      .get<any>('/projects', query)
      .pipe(
        map((res) => {
          if (Array.isArray(res)) {
            return { projects: res };
          }
          if (res && Array.isArray(res.items)) {
            return { projects: res.items, meta: res.meta };
          }
          if (res && Array.isArray(res.projects)) {
            return { projects: res.projects, meta: res.meta };
          }
          return { projects: [] };
        }),
      );
  }

  create(input: CreateProjectInput): Observable<ProjectDto> {
    return this.api
      .post<any>('/projects', input)
      .pipe(map((d) => d?.project || d));
  }

  get(projectId: string): Observable<ProjectDto> {
    return this.api
      .get<any>(`/projects/${projectId}`)
      .pipe(map((d) => d?.project || d));
  }

  update(projectId: string, input: UpdateProjectInput): Observable<ProjectDto> {
    return this.api
      .patch<any>(`/projects/${projectId}`, input)
      .pipe(map((d) => d?.project || d));
  }

  remove(projectId: string): Observable<void> {
    return this.api.delete<null>(`/projects/${projectId}`).pipe(map(() => void 0));
  }

  // ----- members -----

  listMembers(projectId: string): Observable<ProjectMemberDto[]> {
    return this.api
      .get<any>(`/projects/${projectId}/members`)
      .pipe(map((d) => (Array.isArray(d) ? d : d?.members || [])));
  }

  addMember(
    projectId: string,
    email: string,
    role: Exclude<ProjectRole, 'owner'> = 'member',
  ): Observable<ProjectDto> {
    return this.api
      .post<any>(`/projects/${projectId}/members`, {
        email,
        role,
      })
      .pipe(map((d) => d?.project || d));
  }

  updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Observable<ProjectDto> {
    return this.api
      .patch<any>(
        `/projects/${projectId}/members/${userId}`,
        { role },
      )
      .pipe(map((d) => d?.project || d));
  }

  removeMember(projectId: string, userId: string): Observable<ProjectDto> {
    return this.api
      .delete<any>(`/projects/${projectId}/members/${userId}`)
      .pipe(map((d) => d?.project || d));
  }
}
