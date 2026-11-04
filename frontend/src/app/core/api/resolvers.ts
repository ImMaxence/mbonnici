import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RedirectCommand, ResolveFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { I18nService } from '../i18n/i18n.service';
import type { Profile, ProjectCard, ProjectDetail, Settings } from './models';

/**
 * Route resolvers for the public pages. Data is fetched before a page renders, on the server
 * and again on the client where the HTTP transfer cache answers instantly: the first client
 * render is identical to the server HTML, so hydration never flashes a loading state.
 */
export const settingsResolver: ResolveFn<Settings> = () => inject(HttpClient).get<Settings>('/api/settings');

export const projectsResolver: ResolveFn<ProjectCard[]> = () => inject(HttpClient).get<ProjectCard[]>('/api/projects');

export const profileResolver: ResolveFn<Profile> = () => inject(HttpClient).get<Profile>('/api/profile');

/** Unknown slug → the 404 page (URL untouched, real 404 status during SSR). */
export const projectResolver: ResolveFn<ProjectDetail | RedirectCommand> = (route: ActivatedRouteSnapshot) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const lang = inject(I18nService).lang();
  const slug = route.paramMap.get('slug') ?? '';
  return http.get<ProjectDetail>(`/api/projects/${encodeURIComponent(slug)}`).pipe(
    map((p) => p as ProjectDetail | RedirectCommand),
    catchError(() => of(new RedirectCommand(router.parseUrl(`/${lang}/404`), { skipLocationChange: true }))),
  );
};
