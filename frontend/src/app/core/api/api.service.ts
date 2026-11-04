import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  AdminInfo,
  AdminProject,
  AnalyticsOverview,
  BackupOverview,
  BackupRun,
  BackupSettings,
  SystemInfo,
  ContactInput,
  ContactMessage,
  Education,
  EducationInput,
  Experience,
  ExperienceInput,
  Localized,
  Me,
  MediaDto,
  Page,
  Profile,
  ProjectStatus,
  ProjectUpsert,
  Settings,
  SettingsUpdate,
  Skill,
  SkillInput,
  StagedPreview,
  ApplyRestore,
} from './models';

/** Absolute origin of the API during SSR (e.g. http://backend:8080); empty in the browser (same origin). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', { factory: () => '' });

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (base && req.url.startsWith('/api/')) {
    return next(req.clone({ url: base + req.url }));
  }
  return next(req);
};

/** Thin, typed wrapper over the REST API. Reads are exposed as signal resources, writes as promises. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // Public reads (settings, projects, profile) are route resolvers: see core/api/resolvers.ts.

  // ── public writes ──────────────────────────────────────────────────────────
  sendContact(input: ContactInput): Promise<void> {
    return firstValueFrom(this.http.post<void>('/api/contact', input));
  }

  // ── auth ───────────────────────────────────────────────────────────────────
  me(): Promise<Me> {
    return firstValueFrom(this.http.get<Me>('/api/auth/me'));
  }

  logout(): Promise<void> {
    return firstValueFrom(this.http.post<void>('/api/auth/logout', null));
  }

  // ── admin: info & analytics ────────────────────────────────────────────────
  adminInfo(): Promise<AdminInfo> {
    return firstValueFrom(this.http.get<AdminInfo>('/api/admin/info'));
  }

  analytics(days: number): Promise<AnalyticsOverview> {
    return firstValueFrom(this.http.get<AnalyticsOverview>('/api/admin/analytics/overview', { params: { days } }));
  }

  // ── admin: projects ────────────────────────────────────────────────────────
  adminProjects(): Promise<AdminProject[]> {
    return firstValueFrom(this.http.get<AdminProject[]>('/api/admin/projects'));
  }

  adminProject(id: string): Promise<AdminProject> {
    return firstValueFrom(this.http.get<AdminProject>(`/api/admin/projects/${id}`));
  }

  createProject(body: ProjectUpsert): Promise<AdminProject> {
    return firstValueFrom(this.http.post<AdminProject>('/api/admin/projects', body));
  }

  updateProject(id: string, body: ProjectUpsert): Promise<AdminProject> {
    return firstValueFrom(this.http.put<AdminProject>(`/api/admin/projects/${id}`, body));
  }

  setProjectStatus(id: string, status: ProjectStatus): Promise<AdminProject> {
    return firstValueFrom(this.http.put<AdminProject>(`/api/admin/projects/${id}/status`, null, { params: { status } }));
  }

  deleteProject(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/projects/${id}`));
  }

  reorderProfile(section: 'experiences' | 'education' | 'skills', ids: string[]): Promise<void> {
    return firstValueFrom(this.http.put<void>(`/api/admin/profile/${section}/reorder`, { ids }));
  }

  reorderProjects(ids: string[]): Promise<void> {
    return firstValueFrom(this.http.put<void>('/api/admin/projects/reorder', { ids }));
  }

  // ── admin: media ───────────────────────────────────────────────────────────
  media(page = 0, size = 60): Promise<Page<MediaDto>> {
    return firstValueFrom(this.http.get<Page<MediaDto>>('/api/admin/media', { params: { page, size } }));
  }

  uploadMedia(file: File, alt?: Localized): Promise<MediaDto> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (alt?.fr) form.append('altFr', alt.fr);
    if (alt?.en) form.append('altEn', alt.en);
    return firstValueFrom(this.http.post<MediaDto>('/api/admin/media', form));
  }

  updateMediaAlt(id: string, alt: Localized): Promise<MediaDto> {
    return firstValueFrom(this.http.put<MediaDto>(`/api/admin/media/${id}`, alt));
  }

  deleteMedia(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/media/${id}`));
  }

  // ── admin: profile ─────────────────────────────────────────────────────────
  adminProfile(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>('/api/admin/profile'));
  }

  saveExperience(body: ExperienceInput, id?: string): Promise<Experience> {
    return id
      ? firstValueFrom(this.http.put<Experience>(`/api/admin/profile/experiences/${id}`, body))
      : firstValueFrom(this.http.post<Experience>('/api/admin/profile/experiences', body));
  }

  deleteExperience(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/profile/experiences/${id}`));
  }

  saveEducation(body: EducationInput, id?: string): Promise<Education> {
    return id
      ? firstValueFrom(this.http.put<Education>(`/api/admin/profile/education/${id}`, body))
      : firstValueFrom(this.http.post<Education>('/api/admin/profile/education', body));
  }

  deleteEducation(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/profile/education/${id}`));
  }

  saveSkill(body: SkillInput, id?: string): Promise<Skill> {
    return id
      ? firstValueFrom(this.http.put<Skill>(`/api/admin/profile/skills/${id}`, body))
      : firstValueFrom(this.http.post<Skill>('/api/admin/profile/skills', body));
  }

  deleteSkill(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/profile/skills/${id}`));
  }

  // ── admin: settings & messages ─────────────────────────────────────────────
  adminSettings(): Promise<Settings> {
    return firstValueFrom(this.http.get<Settings>('/api/admin/settings'));
  }

  updateSettings(body: SettingsUpdate): Promise<Settings> {
    return firstValueFrom(this.http.put<Settings>('/api/admin/settings', body));
  }

  messages(page = 0, unread = false): Promise<Page<ContactMessage>> {
    return firstValueFrom(
      this.http.get<Page<ContactMessage>>('/api/admin/messages', { params: { page, size: 20, unread } }),
    );
  }

  unreadCount(): Promise<{ unread: number }> {
    return firstValueFrom(this.http.get<{ unread: number }>('/api/admin/messages/unread-count'));
  }

  markRead(id: string, value: boolean): Promise<ContactMessage> {
    return firstValueFrom(this.http.put<ContactMessage>(`/api/admin/messages/${id}/read`, null, { params: { value } }));
  }

  deleteMessage(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/messages/${id}`));
  }

  // ── admin: backups & server ────────────────────────────────────────────────
  readonly driveConnectUrl = '/api/auth/oauth2/authorization/google-drive';
  readonly backupExportUrl = '/api/admin/backups/export';

  backups(): Promise<BackupOverview> {
    return firstValueFrom(this.http.get<BackupOverview>('/api/admin/backups'));
  }

  updateBackupSettings(body: BackupSettings): Promise<BackupSettings> {
    return firstValueFrom(this.http.put<BackupSettings>('/api/admin/backups/settings', body));
  }

  runBackup(): Promise<{ runId: string }> {
    return firstValueFrom(this.http.post<{ runId: string }>('/api/admin/backups/run', null));
  }

  restoreBackup(fileId: string, force = false): Promise<{ runId: string }> {
    return firstValueFrom(
      this.http.post<{ runId: string }>(`/api/admin/backups/restore/${encodeURIComponent(fileId)}`, null, { params: { force } }),
    );
  }

  deleteBackupFile(fileId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/backups/files/${encodeURIComponent(fileId)}`));
  }

  backupDownloadUrl(fileId: string): string {
    return `/api/admin/backups/files/${encodeURIComponent(fileId)}/download`;
  }

  importBackup(file: File, force = false): Promise<BackupRun> {
    const form = new FormData();
    form.append('file', file, file.name);
    return firstValueFrom(this.http.post<BackupRun>('/api/admin/backups/import', form, { params: { force } }));
  }

  /** Uploads an archive and compares it with the live data; nothing is changed yet. */
  stageBackup(file: File): Promise<StagedPreview> {
    const form = new FormData();
    form.append('file', file, file.name);
    return firstValueFrom(this.http.post<StagedPreview>('/api/admin/backups/stage', form));
  }

  stageDriveBackup(fileId: string, name: string): Promise<StagedPreview> {
    return firstValueFrom(this.http.post<StagedPreview>(`/api/admin/backups/stage/drive/${fileId}`, null, { params: { name } }));
  }

  applyStaged(id: string, body: ApplyRestore): Promise<BackupRun> {
    return firstValueFrom(this.http.post<BackupRun>(`/api/admin/backups/stage/${id}/apply`, body));
  }

  discardStaged(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/admin/backups/stage/${id}`));
  }

  disconnectDrive(): Promise<void> {
    return firstValueFrom(this.http.post<void>('/api/admin/backups/disconnect', null));
  }

  systemInfo(): Promise<SystemInfo> {
    return firstValueFrom(this.http.get<SystemInfo>('/api/admin/system'));
  }
}
