import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MAIN_NAV_ITEMS } from '../../shared/lib/nav-items';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './mobile-nav.component.html',
})
export class MobileNavComponent {
  readonly pages = MAIN_NAV_ITEMS;
}
