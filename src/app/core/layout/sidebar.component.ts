import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MAIN_NAV_ITEMS } from '../../shared/lib/nav-items';
import { LogoComponent } from '../../shared/ui/logo/logo.component';
import { CommandCenterService } from '../command-center/command-center.service';
import { MemberDirectoryService } from '../state/member-directory.service';
import { TaskStoreService } from '../state/task-store.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { NotificationStoreService } from '../state/notification-store.service';

import { AuthStoreService } from '../state/auth-store.service';
import { SidebarNavStateService } from './sidebar-nav.service';
import type { Workspace } from '../../shared/models/project.models';
import { PwaInstallService } from '../pwa/pwa-install.service';
import { PushNotificationService } from '../pwa/push-notification.service';
import { OfflineSyncService } from '../pwa/offline-sync.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatRippleModule, MatTooltipModule, MatBadgeModule, LogoComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStoreService);
  readonly workspace = inject(WorkspaceContextService);
  readonly members = inject(MemberDirectoryService);
  readonly tasks = inject(TaskStoreService);
  readonly commandCenter = inject(CommandCenterService);
  readonly notifications = inject(NotificationStoreService);
  readonly navState = inject(SidebarNavStateService);
  readonly pwa = inject(PwaInstallService);
  readonly push = inject(PushNotificationService);
  readonly sync = inject(OfflineSyncService);

  readonly pages = MAIN_NAV_ITEMS;
  readonly currentUser = this.members.currentUser;

  // ----- Projects: "My projects" (owned) vs "Shared with me" (invited), with my role -----

  private readonly myId = computed(() => {
    const user = this.authStore.currentUser();
    return user?._id ?? (user as { id?: string } | null)?.id ?? '';
  });

  readonly projectQuery = signal('');
  /** The filter box only appears once the list gets long. */
  readonly showProjectSearch = computed(() => this.workspace.workspaces().length > 8);

  private readonly visibleProjects = computed(() => {
    const q = this.projectQuery().trim().toLowerCase();
    const all = this.workspace.workspaces();
    return q ? all.filter((ws) => ws.name.toLowerCase().includes(q)) : all;
  });

  readonly myProjects = computed(() =>
    this.visibleProjects().filter((ws) => !ws.ownerId || ws.ownerId === this.myId()),
  );

  readonly sharedProjects = computed(() =>
    this.visibleProjects().filter((ws) => ws.ownerId && ws.ownerId !== this.myId()),
  );

  /** My role in a shared project, for the small badge ("Admin", "Member", "Viewer"). */
  roleLabel(ws: Workspace): string {
    const role = ws.roles?.[this.myId()] ?? 'member';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }

  projectTooltip(ws: Workspace): string {
    if (this.navState.isCollapsed()) return ws.name;
    if (!ws.ownerId || ws.ownerId === this.myId()) return `${ws.name} · You own this project`;
    return `${ws.name} · Owned by ${ws.ownerName ?? 'another user'} · You're ${this.roleLabel(ws).toLowerCase() === 'admin' ? 'an Admin' : `a ${this.roleLabel(ws)}`}`;
  }

  logout(): void {
    this.authStore.logout();
  }

  toggleCollapse(): void {
    this.navState.toggle();
  }

  ngOnInit(): void {
    this.notifications.loadNotifications();
  }

  selectWorkspace(workspaceId: string): void {
    this.workspace.selectWorkspace(workspaceId);
    this.tasks.clearUiState();
    void this.router.navigate(['/dashboard']);
  }

  createProject(input: HTMLInputElement): void {
    const created = this.workspace.addWorkspace(input.value);
    if (created) {
      input.value = '';
      this.workspace.newWorkspaceName.set('');
      this.workspace.isWorkspaceCreatorOpen.set(false);
      void this.router.navigate(['/dashboard']);
    }
  }

}
