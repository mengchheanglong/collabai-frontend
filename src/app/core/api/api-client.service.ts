// src/app/core/api/api-client.service.ts
//
// Thin wrapper over HttpClient that speaks the backend's response envelope. Every helper
// unwraps `{ success, data }` to `data` (and exposes `meta` via listWithMeta). Errors keep
// the HttpErrorResponse (its body is the contract `{ success:false, error }`), so callers
// can read `error.error?.error?.code`.

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiSuccess, PaginationMeta } from './api.types';

export interface ListResult<T> {
  data: T;
  meta?: PaginationMeta;
}

type QueryParams = Record<string, string | number | boolean | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  get<T>(path: string, query?: QueryParams): Observable<T> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), { params: toParams(query) })
      .pipe(map((res) => res.data));
  }

  /** GET that also surfaces pagination `meta`. */
  getList<T>(path: string, query?: QueryParams): Observable<ListResult<T>> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), { params: toParams(query) })
      .pipe(map((res) => ({ data: res.data, meta: res.meta })));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<ApiSuccess<T>>(this.url(path), body ?? {})
      .pipe(map((res) => res.data));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .patch<ApiSuccess<T>>(this.url(path), body ?? {})
      .pipe(map((res) => res.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiSuccess<T>>(this.url(path))
      .pipe(map((res) => res.data));
  }

  private url(path: string): string {
    return `${this.base}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

function toParams(query?: QueryParams): HttpParams {
  let params = new HttpParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params = params.set(key, String(value));
    }
  }
  return params;
}
