// src/app/core/pwa/offline-sync.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IndexedDbService, OutboxMutation } from './indexed-db.service';
import { ToastService } from '../toast/toast.service';

export interface DeltaSyncResult {
  serverTime: string;
  tasks: {
    upserted: any[];
    deletedIds: string[];
  };
  comments: {
    upserted: any[];
    deletedIds: string[];
  };
  boards: {
    upserted: any[];
  };
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly http = inject(HttpClient);
  private readonly idb = inject(IndexedDbService);
  private readonly toast = inject(ToastService);

  readonly pendingCount = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly syncCompleted$ = new Subject<{ projectId: string; delta: DeltaSyncResult }>();

  constructor() {
    this.refreshPendingCount();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.flushOutboxAndSync();
      });
    }
  }

  async refreshPendingCount(): Promise<number> {
    try {
      const count = await this.idb.countPendingMutations();
      this.pendingCount.set(count);
      return count;
    } catch {
      return 0;
    }
  }

  async enqueue(
    type: OutboxMutation['type'],
    url: string,
    method: OutboxMutation['method'],
    body?: unknown,
    projectId?: string,
  ): Promise<string> {
    const id = `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const mutation: OutboxMutation = {
      id,
      type,
      url,
      method,
      body,
      projectId,
      timestamp: Date.now(),
      retryCount: 0,
    };

    await this.idb.enqueueMutation(mutation);
    await this.refreshPendingCount();
    return id;
  }

  async flushOutboxAndSync(activeProjectId?: string): Promise<void> {
    if (this.isSyncing() || !navigator.onLine) {
      return;
    }

    this.isSyncing.set(true);

    try {
      const mutations = await this.idb.getPendingMutations();
      let succeededCount = 0;

      for (const m of mutations) {
        const fullUrl = `${environment.apiBaseUrl}${m.url.startsWith('/') ? m.url : `/${m.url}`}`;
        try {
          if (m.method === 'POST') {
            await firstValueFrom(this.http.post(fullUrl, m.body));
          } else if (m.method === 'PATCH') {
            await firstValueFrom(this.http.patch(fullUrl, m.body));
          } else if (m.method === 'PUT') {
            await firstValueFrom(this.http.put(fullUrl, m.body));
          } else if (m.method === 'DELETE') {
            await firstValueFrom(this.http.delete(fullUrl));
          }

          await this.idb.removeMutation(m.id);
          succeededCount++;
        } catch (err: any) {
          console.warn('[OfflineSync] Mutation replay failed:', m.type, err);
          // If unrecoverable 4xx client error (except 408/429), remove from queue
          if (err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
            await this.idb.removeMutation(m.id);
          } else {
            m.retryCount = (m.retryCount || 0) + 1;
            if (m.retryCount > 5) {
              await this.idb.removeMutation(m.id);
            } else {
              await this.idb.enqueueMutation(m);
            }
          }
        }
      }

      await this.refreshPendingCount();

      // If active project provided, call delta sync
      if (activeProjectId) {
        await this.syncProjectDelta(activeProjectId);
      }

      if (succeededCount > 0) {
        this.toast.success(
          `Synced ${succeededCount} offline change${succeededCount > 1 ? 's' : ''} with the server.`,
          'Workspace Synchronized',
        );
      }
    } catch (err) {
      console.error('[OfflineSync] Error during flush:', err);
    } finally {
      this.isSyncing.set(false);
    }
  }

  async syncProjectDelta(projectId: string): Promise<DeltaSyncResult | null> {
    if (!projectId || !navigator.onLine) return null;

    try {
      const metaKey = `last_sync_${projectId}`;
      const lastSync = await this.idb.getMeta<string>(metaKey);

      let url = `${environment.apiBaseUrl}/sync?projectId=${encodeURIComponent(projectId)}`;
      if (lastSync) {
        url += `&since=${encodeURIComponent(lastSync)}`;
      }

      const res = await firstValueFrom(this.http.get<any>(url));
      const delta: DeltaSyncResult = res?.data || res;

      if (delta && delta.serverTime) {
        await this.idb.setMeta(metaKey, delta.serverTime);

        // Update local IndexedDB task records
        if (delta.tasks?.upserted?.length) {
          await this.idb.putMany('tasks', delta.tasks.upserted);
        }
        if (delta.tasks?.deletedIds?.length) {
          for (const delId of delta.tasks.deletedIds) {
            await this.idb.delete('tasks', delId);
          }
        }

        // Update local IndexedDB comments records
        if (delta.comments?.upserted?.length) {
          await this.idb.putMany('comments', delta.comments.upserted);
        }
        if (delta.comments?.deletedIds?.length) {
          for (const delId of delta.comments.deletedIds) {
            await this.idb.delete('comments', delId);
          }
        }

        // Notify subscribers
        this.syncCompleted$.next({ projectId, delta });
      }

      return delta;
    } catch (err) {
      console.warn('[OfflineSync] Delta sync error for project:', projectId, err);
      return null;
    }
  }
}
