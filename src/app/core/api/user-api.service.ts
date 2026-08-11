// src/app/core/api/user-api.service.ts
// Typed client for user search (GET /users/search) — used by the invite-member flow.

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { UserDto } from './api.types';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly api = inject(ApiClient);

  search(term: string, limit = 10): Observable<UserDto[]> {
    return this.api.get<UserDto[]>('/users/search', { q: term, limit });
  }
}
