import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_BASE_URL } from './core/api/api.service';
import { SITE_URL } from './core/seo/seo.service';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // During SSR the Angular app talks to the backend directly (docker service name in production).
    { provide: API_BASE_URL, useValue: (process.env['API_BASE_URL'] ?? 'http://localhost:8080').replace(/\/$/, '') },
    { provide: SITE_URL, useValue: (process.env['APP_URL'] ?? 'http://localhost:4000').replace(/\/$/, '') },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
