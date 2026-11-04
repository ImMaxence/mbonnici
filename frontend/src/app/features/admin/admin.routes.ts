import { Routes } from '@angular/router';
import { adminGuard } from '../../core/auth/auth.service';
import { unsavedGuard } from './unsaved.guard';
import { articlePreviewResolver, projectPreviewResolver, settingsResolver } from '../../core/api/resolvers';

export const ADMIN_ROUTES: Routes = [
  { path: 'login', loadComponent: () => import('./login.page').then((m) => m.LoginPage) },
  // the public page of a draft, exactly as it will look (outside the back-office shell)
  {
    path: 'preview/projects/:id',
    canActivate: [adminGuard],
    loadComponent: () => import('../projects/project.page').then((m) => m.ProjectPage),
    resolve: { settings: settingsResolver, project: projectPreviewResolver },
    data: { preview: true },
  },
  {
    path: 'preview/notes/:id',
    canActivate: [adminGuard],
    loadComponent: () => import('../notes/note.page').then((m) => m.NotePage),
    resolve: { settings: settingsResolver, article: articlePreviewResolver },
    data: { preview: true },
  },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', pathMatch: 'full', loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
      { path: 'projects', loadComponent: () => import('./projects-list.page').then((m) => m.ProjectsListPage) },
      { path: 'projects/new', loadComponent: () => import('./project-edit.page').then((m) => m.ProjectEditPage), canDeactivate: [unsavedGuard] },
      { path: 'projects/:id', loadComponent: () => import('./project-edit.page').then((m) => m.ProjectEditPage), canDeactivate: [unsavedGuard] },
      { path: 'media', loadComponent: () => import('./media.page').then((m) => m.MediaPage) },
      { path: 'profile', loadComponent: () => import('./profile.page').then((m) => m.AdminProfilePage), canDeactivate: [unsavedGuard] },
      { path: 'settings', loadComponent: () => import('./settings.page').then((m) => m.AdminSettingsPage), canDeactivate: [unsavedGuard] },
      { path: 'messages', loadComponent: () => import('./messages.page').then((m) => m.MessagesPage) },
      { path: 'notes', loadComponent: () => import('./notes-list.page').then((m) => m.NotesListPage) },
      { path: 'notes/new', loadComponent: () => import('./note-edit.page').then((m) => m.NoteEditPage), canDeactivate: [unsavedGuard] },
      { path: 'notes/:id', loadComponent: () => import('./note-edit.page').then((m) => m.NoteEditPage), canDeactivate: [unsavedGuard] },
      { path: 'backups', loadComponent: () => import('./backups.page').then((m) => m.BackupsPage) },
      { path: 'errors', loadComponent: () => import('./errors.page').then((m) => m.ErrorsPage) },
      { path: 'changelog', loadComponent: () => import('./changelog.page').then((m) => m.ChangelogPage) },
    ],
  },
];
