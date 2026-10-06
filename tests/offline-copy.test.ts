// Offline copies of API reads: saved on success, served when the network is unreachable,
// real server errors still surface; and offline failures get a clear message.
import assert from 'node:assert/strict';
import { firstValueFrom, of, throwError } from 'rxjs';
import { withOfflineCopy } from '../src/app/core/pwa/offline-copy';
import { apiErrorMessage, OFFLINE_MESSAGE } from '../src/app/core/api/api-error';

function fakeIdb() {
  const store = new Map<string, unknown>();
  return {
    store,
    cacheSet: async (key: string, value: unknown) => void store.set(key, value),
    cacheGet: async <T>(key: string) => store.get(key) as T | undefined,
  };
}

async function main(): Promise<void> {
  const idb = fakeIdb();

  // Online: response passes through and is saved.
  const online = await firstValueFrom(of(['board-1']).pipe(withOfflineCopy(idb as any, 'boards:p1')));
  assert.deepEqual(online, ['board-1']);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(idb.store.get('boards:p1'), ['board-1']);

  // Offline (status 0): last saved copy is served.
  const offline = await firstValueFrom(
    throwError(() => ({ status: 0 })).pipe(withOfflineCopy(idb as any, 'boards:p1')),
  );
  assert.deepEqual(offline, ['board-1']);

  // Offline with nothing saved: the error surfaces.
  await assert.rejects(
    firstValueFrom(throwError(() => ({ status: 0 })).pipe(withOfflineCopy(idb as any, 'nothing'))),
  );

  // Real server error (403): not masked by the copy.
  await assert.rejects(
    firstValueFrom(throwError(() => ({ status: 403 })).pipe(withOfflineCopy(idb as any, 'boards:p1'))),
  );

  // Offline failures read as "you're offline", not a vague error.
  assert.equal(apiErrorMessage({ status: 0 }, 'fallback'), OFFLINE_MESSAGE);
  assert.equal(
    apiErrorMessage({ status: 403, error: { error: { message: 'Nope' } } }, 'fallback'),
    'Nope',
  );

  console.log('All offline copy tests passed successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
