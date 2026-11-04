import { Routes } from '@angular/router';
import { articleResolver, articlesResolver, profileResolver, projectResolver, projectsResolver, settingsResolver } from './core/api/resolvers';
import { langGuard } from './core/i18n/lang.guard';
import { Lang, SEGMENTS } from './core/i18n/routes';

/** Pages exist once per language, under localised URL segments (/fr/projets, /en/projects…). */
function localized(lang: Lang): Routes {
  const s = SEGMENTS[lang];
  return [
    {
      path: '',
      pathMatch: 'full',
      loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
      resolve: { settings: settingsResolver, projects: projectsResolver, profile: profileResolver },
      data: { page: 'home' },
    },
    {
      path: s.projects,
      loadComponent: () => import('./features/projects/projects.page').then((m) => m.ProjectsPage),
      resolve: { settings: settingsResolver, projects: projectsResolver },
      data: { page: 'projects' },
    },
    {
      path: `${s.projects}/:slug`,
      loadComponent: () => import('./features/projects/project.page').then((m) => m.ProjectPage),
      resolve: { settings: settingsResolver, project: projectResolver },
      data: { page: 'project' },
    },
    {
      path: s.about,
      loadComponent: () => import('./features/about/about.page').then((m) => m.AboutPage),
      resolve: { settings: settingsResolver, profile: profileResolver, projects: projectsResolver },
      data: { page: 'about' },
    },
    {
      path: s.contact,
      loadComponent: () => import('./features/contact/contact.page').then((m) => m.ContactPage),
      resolve: { settings: settingsResolver, projects: projectsResolver },
      data: { page: 'contact' },
    },
    {
      path: s.notes,
      loadComponent: () => import('./features/notes/notes.page').then((m) => m.NotesPage),
      resolve: { settings: settingsResolver, articles: articlesResolver },
      data: { page: 'notes' },
    },
    {
      path: `${s.notes}/:slug`,
      loadComponent: () => import('./features/notes/note.page').then((m) => m.NotePage),
      resolve: { settings: settingsResolver, article: articleResolver },
      data: { page: 'note' },
    },
    {
      path: s.legal,
      loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
      resolve: { settings: settingsResolver },
      data: { page: 'legal' },
    },
    {
      path: s.privacy,
      loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
      resolve: { settings: settingsResolver },
      data: { page: 'privacy' },
    },
    {
      path: s.terms,
      loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
      resolve: { settings: settingsResolver },
      data: { page: 'terms' },
    },
    {
      path: s.accessibility,
      loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
      resolve: { settings: settingsResolver },
      data: { page: 'accessibility' },
    },
    {
      path: '**',
      loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
      data: { page: 'notFound' },
    },
  ];
}

export const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
    data: { page: 'admin' },
  },
  { path: 'fr', canActivate: [langGuard('fr')], children: localized('fr'), data: { lang: 'fr' } },
  { path: 'en', canActivate: [langGuard('en')], children: localized('en'), data: { lang: 'en' } },
  // The Node server negotiates the language for "/"; this is the client-side fallback.
  { path: '', pathMatch: 'full', redirectTo: 'fr' },
  {
    path: '**',
    canActivate: [langGuard('fr')],
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
    data: { page: 'notFound' },
  },
];
