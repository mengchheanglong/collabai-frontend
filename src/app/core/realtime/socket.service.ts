import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { TokenStore } from '../api/token.store';
import { AuthService } from '../api/auth.service';
import { environment } from '../../../environments/environment';
export interface LiveEvent { projectId: string; actorId: string; data: Record<string, unknown>; createdAt: string; }
export interface RoomAck { success: boolean; projectId?: string; error?: { code: string; message: string }; }
@Injectable({ providedIn: 'root' })
export class SocketService {
 private readonly tokens = inject(TokenStore);
 private readonly auth = inject(AuthService);
 private socket?: Socket;
 private project: string | null = null;
 private joinVersion = 0;
 private refreshPending = false;
 private retry?: ReturnType<typeof setTimeout>;
 readonly connected = signal(false);
 readonly events$ = new Subject<{ name: string; event: LiveEvent }>();
 readonly joined$ = new Subject<string>();
 readonly denied$ = new Subject<string>();
 constructor() {
  effect(onCleanup => {
   const token = this.tokens.token();
   if (!token) { this.connected.set(false); return; }
   const socket = io(environment.socketUrl, { autoConnect: false, auth: { token }, reconnection: true, reconnectionDelayMax: 5000, withCredentials: true });
   this.socket = socket;
   socket.on('connect', () => { this.connected.set(true); this.joinCurrent(); });
   socket.on('disconnect', () => { this.connected.set(false); this.joinVersion++; });
   socket.on('connect_error', error => { if ((error as Error & { data?: { code?: string } }).data?.code === 'UNAUTHORIZED') this.refreshSession(socket, token); });
   socket.on('auth:expired', () => this.refreshSession(socket, token));
   socket.onAny((name: string, event: LiveEvent) => {
    if (event && typeof event.projectId === 'string' && typeof event.actorId === 'string' && event.data && typeof event.createdAt === 'string') this.events$.next({ name, event });
   });
   untracked(() => socket.connect());
   onCleanup(() => { this.joinVersion++; clearTimeout(this.retry); socket.removeAllListeners(); socket.disconnect(); if (this.socket === socket) this.socket = undefined; this.connected.set(false); });
  });
 }
 setProject(projectId: string | null) {
  if (this.project === projectId) return;
  if (this.project && this.socket?.connected) this.socket.emit('project:leave', { projectId: this.project });
  this.project = projectId; this.joinCurrent();
 }
 private joinCurrent() {
  clearTimeout(this.retry);
  const socket = this.socket; const projectId = this.project; const version = ++this.joinVersion;
  if (!socket?.connected || !projectId || projectId.startsWith('offline-')) return;
  socket.timeout(8000).emit('project:join', { projectId }, (error: Error | null, ack: RoomAck) => {
   if (version !== this.joinVersion || this.socket !== socket) { if (this.project !== projectId && socket.connected) socket.emit('project:leave', { projectId }); return; }
   if (error) { this.retry = setTimeout(() => this.joinCurrent(), 2000); return; }
   if (ack?.success) this.joined$.next(projectId);
   else this.denied$.next(projectId);
  });
 }
 private refreshSession(socket: Socket, token: string) {
  if (this.refreshPending || this.socket !== socket || this.tokens.get() !== token) return;
  this.refreshPending = true;
  // GET /auth/me uses the shared HTTP interceptor's single-flight refresh path.
  this.auth.me().subscribe({
   next: () => { this.refreshPending = false; if (this.socket === socket && this.tokens.get() === token) { this.retry = setTimeout(() => socket.connect(), 2000); } },
   error: () => { this.refreshPending = false; },
  });
 }
 typing(taskId: string, active: boolean) {
  if (this.socket?.connected && this.project) this.socket.emit(active ? 'typing:start' : 'typing:stop', { projectId: this.project, taskId });
 }
}
