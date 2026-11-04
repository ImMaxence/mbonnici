import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/auth.service';

export const ADMIN_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./login.page').then((m) => m.LoginPage) },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
      { path: 'projects', loadComponent: () => import('./projects-list.page').then((m) => m.ProjectsListPage) },
      { path: 'projects/new', loadComponent: () => import('./project-edit.page').then((m) => m.ProjectEditPage) },
      { path: 'projects/:id', loadComponent: () => import('./project-edit.page').then((m) => m.ProjectEditPage) },
      { path: 'media', loadComponent: () => import('./media.page').then((m) => m.MediaPage) },
      { path: 'profile', loadComponent: () => import('./profile.page').then((m) => m.AdminProfilePage) },
      { path: 'settings', loadComponent: () => import('./settings.page').then((m) => m.AdminSettingsPage) },
      { path: 'messages', loadComponent: () => import('./messages.page').then((m) => m.MessagesPage) },
      { path: 'backups', loadComponent: () => import('./backups.page').then((m) => m.BackupsPage) },
      { path: 'changelog', loadComponent: () => import('./changelog.page').then((m) => m.ChangelogPage) },
    ],
  },
];
