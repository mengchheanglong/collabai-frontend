import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { ThemeService } from '../../core/theme/theme.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterLink, ThemeToggleComponent],
  templateUrl: './profile-page.component.html',
})
export class ProfilePageComponent {
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);
  readonly theme = inject(ThemeService);
  readonly currentUser = this.members.currentUser;
}
