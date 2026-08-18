import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme/theme.service';
import { AuthStoreService } from './core/state/auth-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly theme = inject(ThemeService);
  private readonly authStore = inject(AuthStoreService);

  ngOnInit(): void {
    this.authStore.restoreSession().subscribe();
  }
}
