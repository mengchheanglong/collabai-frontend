import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, map } from 'rxjs';
import { ApiClient } from './api-client.service';

interface PresignedUpload {
  uploadUrl: string;
  objectUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class UploadApiService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);

  uploadAvatar(file: Blob): Observable<string> {
    const contentType = file.type || 'image/png';
    return this.api.post<PresignedUpload>('/uploads/presign', {
      kind: 'avatar', fileName: `avatar.${contentType.split('/')[1] ?? 'png'}`,
      contentType, contentLength: file.size,
    }).pipe(
      switchMap((presigned) => this.http.put(presigned.uploadUrl, file, { headers: presigned.requiredHeaders, responseType: 'text' }).pipe(map(() => presigned.objectUrl))),
    );
  }
}
