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
<<<<<<< HEAD
  private readonly authStore = inject(AuthStoreService);

  ngOnInit(): void {
    // Rehydrate the signed-in user from a stored token (GET /auth/me).
    this.authStore.restoreSession().subscribe();
=======
  private readonly auth = inject(AuthStoreService);

  constructor() {
    this.auth.restoreSession();
>>>>>>> b25afe06ba579c2f35025631c88d3bc0797183c6
  }
}
