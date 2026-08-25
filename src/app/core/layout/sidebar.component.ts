import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MAIN_NAV_ITEMS } from '../../shared/lib/nav-items';
import { CommandCenterService } from '../command-center/command-center.service';
import { MemberDirectoryService } from '../state/member-directory.service';
import { TaskStoreService } from '../state/task-store.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';
import { NotificationStoreService } from '../state/notification-store.service';

import { AuthStoreService } from '../state/auth-store.service';
import { SidebarNavStateService } from './sidebar-nav.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatRippleModule, MatTooltipModule, MatBadgeModule],
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

  readonly pages = MAIN_NAV_ITEMS;
  readonly currentUser = this.members.currentUser;

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
