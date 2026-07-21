import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAIN_NAV_ITEMS } from '../../shared/lib/nav-items';
import { MemberDirectoryService } from '../state/member-directory.service';
import { ThemeService } from '../theme/theme.service';
import { TaskStoreService } from '../state/task-store.service';
import { WorkspaceContextService } from '../workspace/workspace-context.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatRippleModule, MatTooltipModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceContextService);
  readonly members = inject(MemberDirectoryService);
  readonly theme = inject(ThemeService);
  readonly tasks = inject(TaskStoreService);

  readonly pages = MAIN_NAV_ITEMS;
  readonly currentUser = this.members.currentUser;

  selectWorkspace(workspaceId: string): void {
    this.workspace.selectWorkspace(workspaceId);
    this.tasks.clearUiState();
    void this.router.navigate(['/dashboard']);
  }

  addWorkspace(name: string): void {
    const id = this.workspace.addWorkspace(name);
    if (!id) return;
    this.tasks.clearUiState();
    void this.router.navigate(['/dashboard']);
  }
}
