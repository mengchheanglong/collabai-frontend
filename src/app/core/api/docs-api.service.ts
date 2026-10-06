import { Injectable, inject } from "@angular/core";
import { ApiClient } from "./api-client.service";
import { IndexedDbService } from '../pwa/indexed-db.service';
import { withOfflineCopy } from '../pwa/offline-copy';
export interface DocumentAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt: string;
}
export interface DocumentSummary {
  _id: string;
  projectId: string;
  createdById: string;
  title: string;
  fileType?: string | null;
  attachments?: DocumentAttachment[];
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
  private readonly idb = inject(IndexedDbService);
  list(projectId: string, page = 1, q = "") {
    return this.api
      .getList<DocumentSummary[]>(`/projects/${projectId}/docs`, {
        page,
        limit: 20,
        q,
      })
      .pipe(withOfflineCopy(this.idb, `docs:${projectId}:${page}:${q}`));
  }
  get(id: string) {
    return this.api
      .get<{ document: WorkspaceDocument; canEdit: boolean }>(`/docs/${id}`)
      .pipe(withOfflineCopy(this.idb, `doc:${id}`));
  }
  create(
    projectId: string,
    input: {
      title: string;
      content?: string;
      attachments?: DocumentAttachment[];
      fileType?: string | null;
    },
  ) {
    return this.api.post<{ document: WorkspaceDocument }>(
      `/projects/${projectId}/docs`,
      input,
    );
  }
  update(
    id: string,
    input: {
      title?: string;
      content?: string;
      attachments?: DocumentAttachment[];
      fileType?: string | null;
      version?: number;
    },
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
