import { Routes } from '@angular/router';
import { ShellComponent } from './core/layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page.component').then((m) => m.DashboardPageComponent),
      },
      {
        path: 'board',
        loadComponent: () =>
          import('./features/board/board-page.component').then((m) => m.BoardPageComponent),
      },
      {
        path: 'team',
        loadComponent: () =>
          import('./features/team/team-page.component').then((m) => m.TeamPageComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile-page.component').then((m) => m.ProfilePageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
