// Offline copy for API reads: saves each successful response, and when the network is
// unreachable (status 0 / browser offline) answers with the last saved copy instead.
// Real server errors (403, 404, …) still surface. Copies are user-scoped (see IndexedDbService).

import { MonoTypeOperatorFunction, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import type { IndexedDbService } from './indexed-db.service';

export function isNetworkError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  return status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

export function withOfflineCopy<T>(idb: IndexedDbService, key: string): MonoTypeOperatorFunction<T> {
  return (source) =>
    source.pipe(
      tap((value) => void idb.cacheSet(key, value)),
      catchError((err: unknown) =>
        isNetworkError(err)
          ? from(idb.cacheGet<T>(key)).pipe(
              switchMap((cached) => (cached !== undefined ? of(cached) : throwError(() => err))),
            )
          : throwError(() => err),
      ),
    );
}
