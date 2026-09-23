import { Injectable, inject } from "@angular/core";
import { ApiClient } from "./api-client.service";
export interface DocumentSummary {
  _id: string;
  projectId: string;
  createdById: string;
  title: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceDocument extends DocumentSummary {
  content: string;
}
@Injectable({ providedIn: "root" })
export class DocsApiService {
  private readonly api = inject(ApiClient);
  list(projectId: string, page = 1, q = "") {
    return this.api.getList<DocumentSummary[]>(`/projects/${projectId}/docs`, {
      page,
      limit: 20,
      q,
    });
  }
  get(id: string) {
    return this.api.get<{ document: WorkspaceDocument; canEdit: boolean }>(
      `/docs/${id}`,
    );
  }
  create(projectId: string, input: { title: string; content: string }) {
    return this.api.post<{ document: WorkspaceDocument }>(
      `/projects/${projectId}/docs`,
      input,
    );
  }
  update(
    id: string,
    input: { title: string; content: string; version: number },
  ) {
    return this.api.patch<{ document: WorkspaceDocument }>(
      `/docs/${id}`,
      input,
    );
  }
  remove(id: string) {
    return this.api.delete<null>(`/docs/${id}`);
  }
}
