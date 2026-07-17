import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from '../toast/toast.component';
import { MobileNavComponent } from './mobile-nav.component';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, MobileNavComponent, ToastComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {}
