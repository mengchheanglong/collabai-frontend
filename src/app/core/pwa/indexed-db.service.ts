// src/app/core/pwa/indexed-db.service.ts
import { Injectable } from '@angular/core';

export interface OutboxMutation {
  id: string;
  type:
    | 'CREATE_TASK'
    | 'UPDATE_TASK'
    | 'MOVE_TASK'
    | 'DELETE_TASK'
    | 'ADD_SUBTASK'
    | 'UPDATE_SUBTASK'
    | 'CREATE_PROJECT'
    | 'UPDATE_PROJECT'
    | 'DELETE_PROJECT'
    | 'ADD_COMMENT'
    | 'DELETE_COMMENT';
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  projectId?: string;
  timestamp: number;
  retryCount: number;
}

const DB_NAME = 'collabai_offline_db';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
          taskStore.createIndex('projectId', 'projectId', { unique: false });
          taskStore.createIndex('status', 'status', { unique: false });
          taskStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // Comments store
        if (!db.objectStoreNames.contains('comments')) {
          const commentStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentStore.createIndex('taskId', 'taskId', { unique: false });
          commentStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Boards store
        if (!db.objectStoreNames.contains('boards')) {
          const boardStore = db.createObjectStore('boards', { keyPath: 'id' });
          boardStore.createIndex('projectId', 'projectId', { unique: false });
        }

        // Outbox mutation queue store
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('timestamp', 'timestamp', { unique: false });
          outboxStore.createIndex('type', 'type', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // ── Generic CRUD helpers ───────────────────────────────────────────────────

  async put<T>(storeName: string, item: T): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async putMany<T>(storeName: string, items: T[]): Promise<void> {
    if (!items.length) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllByIndex<T>(storeName: string, indexName: string, query: IDBValidKey): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(query);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── Outbox Queue Methods ───────────────────────────────────────────────────

  async enqueueMutation(mutation: OutboxMutation): Promise<void> {
    await this.put('outbox', mutation);
  }

  async getPendingMutations(): Promise<OutboxMutation[]> {
    const all = await this.getAll<OutboxMutation>('outbox');
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  async removeMutation(mutationId: string): Promise<void> {
    await this.delete('outbox', mutationId);
  }

  async countPendingMutations(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readonly');
      const store = tx.objectStore('outbox');
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ── Meta Key/Value Methods ─────────────────────────────────────────────────

  async setMeta(key: string, value: any): Promise<void> {
    await this.put('meta', { key, value });
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const record = await this.get<{ key: string; value: T }>('meta', key);
    return record?.value;
  }
}
