import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { AuthStoreService } from './core/state/auth-store.service';
import { ToastComponent } from './core/toast/toast.component';
import { PwaInstallService } from './core/pwa/pwa-install.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly theme = inject(ThemeService);
  private readonly authStore = inject(AuthStoreService);
  private readonly pwa = inject(PwaInstallService);

  ngOnInit(): void {
    this.pwa.init();
    this.authStore.restoreSession().subscribe();
  }
}
