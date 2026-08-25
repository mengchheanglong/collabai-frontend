import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AiCopilotComponent } from '../../features/ai/ai-copilot.component';
import { CommandCenterComponent } from '../command-center/command-center.component';
import { ToastComponent } from '../toast/toast.component';
import { MobileNavComponent } from './mobile-nav.component';
import { SidebarComponent } from './sidebar.component';
import { SidebarNavStateService } from './sidebar-nav.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarComponent,
    MobileNavComponent,
    ToastComponent,
    AiCopilotComponent,
    CommandCenterComponent,
  ],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  readonly navState = inject(SidebarNavStateService);
}

