import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MemberDirectoryService } from '../../core/state/member-directory.service';
import { WorkspaceContextService } from '../../core/workspace/workspace-context.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './profile-page.component.html',
})
export class ProfilePageComponent {
  readonly members = inject(MemberDirectoryService);
  readonly workspace = inject(WorkspaceContextService);
  readonly currentUser = this.members.currentUser;
}
