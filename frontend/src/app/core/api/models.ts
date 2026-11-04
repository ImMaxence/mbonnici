/** TypeScript mirror of the backend DTOs (fr.mbonnici.portfolio.*Dtos). */

export interface Localized {
  fr: string;
  en: string;
}

export type ProjectStatus = 'DRAFT' | 'PUBLISHED';
export type ProjectCategory = 'WEB' | 'MOBILE' | 'GAME' | 'TOOL' | 'DESIGN' | 'DATA' | 'OTHER';
export type SceneType = 'ORBIT' | 'TERRAIN' | 'HELIX' | 'STACK' | 'DEVICE';
export type MediaKind = 'GALLERY' | 'MOBILE';
export type Availability = 'OPEN' | 'LISTENING' | 'BUSY';
export type ContractType = 'CDI' | 'CDD' | 'ALTERNANCE' | 'STAGE' | 'FREELANCE';
export type SkillCategory = 'LANGUAGE' | 'FRAMEWORK' | 'DATABASE' | 'DEVOPS' | 'NETWORK' | 'TOOL' | 'PRACTICE';

export const PROJECT_CATEGORIES: ProjectCategory[] = ['WEB', 'MOBILE', 'GAME', 'TOOL', 'DESIGN', 'DATA', 'OTHER'];
export const SCENE_TYPES: SceneType[] = ['ORBIT', 'TERRAIN', 'HELIX', 'STACK', 'DEVICE'];
export const CONTRACT_TYPES: ContractType[] = ['CDI', 'CDD', 'ALTERNANCE', 'STAGE', 'FREELANCE'];
export const SKILL_CATEGORIES: SkillCategory[] = ['LANGUAGE', 'FRAMEWORK', 'DATABASE', 'DEVOPS', 'NETWORK', 'TOOL', 'PRACTICE'];

export interface MediaDto {
  id: string;
  url: string;
  contentType: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  alt: Localized;
  sizeBytes: number;
  originalFilename: string | null;
  createdAt: string;
  /** smaller copies for responsive images ("url 640w, …"), absent when there is none */
  srcset?: string | null;
  /** point to keep in view when a frame crops the picture, 0..1 from the left / top */
  focalX?: number;
  focalY?: number;
}

/** How a project is staged: browser + phone, phone only, browser only */
export type DisplayMode = 'BOTH' | 'MOBILE' | 'DESKTOP';
export const DISPLAY_MODES: DisplayMode[] = ['BOTH', 'MOBILE', 'DESKTOP'];

export interface ProjectCard {
  id: string;
  slug: string;
  title: Localized;
  tagline: Localized;
  category: ProjectCategory;
  sceneType: SceneType;
  displayMode?: DisplayMode;
  accentColor: string;
  year: number | null;
  stack: string[];
  tags: string[];
  featured: boolean;
  cover: MediaDto | null;
  /** first portrait capture (cards only) */
  mobileCover?: MediaDto | null;
  liveUrl: string | null;
  repoUrl: string | null;
}

/** Case study sections (Markdown); an empty section is not shown */
export interface CaseStudy {
  context: Localized;
  role: Localized;
  challenges: Localized;
  results: Localized;
}
export const CASE_STUDY_KEYS = ['context', 'role', 'challenges', 'results'] as const;
export type CaseStudyKey = (typeof CASE_STUDY_KEYS)[number];

export interface ProjectDetail extends ProjectCard {
  description: Localized;
  caseStudy?: CaseStudy;
  allowIframe: boolean;
  gallery: MediaDto[];
  mobile: MediaDto[];
  publishedAt: string | null;
  updatedAt: string;
  previous: ProjectCard | null;
  next: ProjectCard | null;
}

export interface ProjectMediaItem {
  media: MediaDto;
  kind: MediaKind;
  sortOrder: number;
}

export interface AdminProject {
  id: string;
  slug: string;
  title: Localized;
  tagline: Localized;
  description: Localized;
  caseStudy?: CaseStudy;
  status: ProjectStatus;
  featured: boolean;
  sortOrder: number;
  year: number | null;
  category: ProjectCategory;
  sceneType: SceneType;
  displayMode?: DisplayMode;
  accentColor: string;
  coverMediaId: string | null;
  cover: MediaDto | null;
  repoUrl: string | null;
  liveUrl: string | null;
  allowIframe: boolean;
  stack: string[];
  tags: string[];
  media: ProjectMediaItem[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ProjectUpsert {
  slug?: string | null;
  title: Localized;
  tagline: Localized;
  description: Localized;
  caseStudy: CaseStudy;
  status: ProjectStatus;
  featured: boolean;
  sortOrder: number;
  year: number | null;
  category: ProjectCategory;
  sceneType: SceneType;
  displayMode: DisplayMode;
  accentColor: string;
  repoUrl: string | null;
  liveUrl: string | null;
  allowIframe: boolean;
  stack: string[];
  tags: string[];
  coverMediaId: string | null;
  media: { mediaId: string; kind: MediaKind; sortOrder: number }[];
}

export interface Legal {
  name: string | null;
  address: string | null;
  host: string | null;
  contactEmail: string | null;
}

export interface Settings {
  ownerName: string;
  headline: Localized;
  bio: Localized;
  location: string | null;
  publicEmail: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  availability: Availability;
  seoTitle: Localized;
  seoDescription: Localized;
  legal: Legal;
  /** picture next to the name in the header */
  avatar: MediaDto | null;
  updatedAt: string;
  /** the uploaded resumes; a language without one is left out (no download button when both are) */
  cv?: CvStatus;
}

/** a resume PDF uploaded in the back office */
export interface CvFile {
  size: number;
  uploadedAt: string;
}

export interface CvStatus {
  fr?: CvFile;
  en?: CvFile;
}

export interface SettingsUpdate {
  ownerName: string;
  headline: Localized;
  bio: Localized;
  location: string | null;
  publicEmail: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  availability: Availability;
  seoTitle: Localized;
  seoDescription: Localized;
  legalName: string | null;
  legalAddress: string | null;
  legalHost: string | null;
  legalContactEmail: string | null;
  avatarMediaId: string | null;
}

export interface Experience {
  id: string;
  company: string;
  companyUrl: string | null;
  role: Localized;
  description: Localized;
  location: string | null;
  contractType: ContractType;
  startDate: string;
  endDate: string | null;
  skills: string[];
  sortOrder: number;
}

export interface Education {
  id: string;
  school: string;
  schoolUrl: string | null;
  degree: Localized;
  location: string | null;
  startDate: string;
  endDate: string | null;
  sortOrder: number;
}

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  level: number;
  sortOrder: number;
}

export interface Profile {
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
}

export type ExperienceInput = Omit<Experience, 'id'>;
export type EducationInput = Omit<Education, 'id'>;
export type SkillInput = Omit<Skill, 'id'>;

export interface Me {
  authenticated: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  locale: string;
  website: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  locale: string | null;
  read: boolean;
  archived?: boolean;
  createdAt: string;
}

// ── live status of the sites and GitHub figures ─────────────────────────────
export interface SiteStatus {
  up: boolean;
  status: number | null;
  latencyMs: number | null;
  checkedAt: string;
}

export interface RepoStats {
  fullName: string;
  stars: number;
  forks: number;
  pushedAt: string | null;
  languages: { name: string; share: number }[];
  fetchedAt: string;
}

export interface Insight {
  site: SiteStatus | null;
  repo: RepoStats | null;
}

// ── monitoring (back office) ─────────────────────────────────────────────────
export interface ErrorEntry {
  id: number;
  source: 'CLIENT' | 'SERVER' | 'CSP';
  message: string;
  detail: string | null;
  path: string | null;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  resolved: boolean;
}

export interface SiteHistory {
  slug: string;
  title: string;
  url: string;
  current: SiteStatus | null;
  uptime24h: number | null;
  uptime7d: number | null;
  latency24h: number | null;
  lastDown: string | null;
  hours: { hour: string; up: number; latencyMs: number | null; checks: number }[];
}

// ── Core Web Vitals (real users) ─────────────────────────────────────────────
export type VitalMetric = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

export interface VitalStat {
  metric: VitalMetric;
  samples: number;
  p75: number | null;
  good: number;
  needsImprovement: number;
  poor: number;
  goodThreshold: number;
  poorThreshold: number;
}

export interface VitalsOverview {
  days: number;
  metrics: VitalStat[];
  byDevice: Record<string, VitalStat[]>;
  pages: { path: string; samples: number; lcp: number | null; inp: number | null; cls: number | null }[];
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface DailyPoint {
  date: string;
  views: number;
  visitors: number;
}

export interface ProjectStat {
  slug: string;
  title: Localized;
  views: number;
  clicks: number;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface AnalyticsOverview {
  days: number;
  pageViews: number;
  pageViewsPrevious: number;
  visitors: number;
  visitorsPrevious: number;
  projectViews: number;
  outboundClicks: number;
  contactSubmits: number;
  cvDownloads?: number;
  daily: DailyPoint[];
  topProjects: ProjectStat[];
  topPaths: KeyCount[];
  locales: KeyCount[];
  devices: KeyCount[];
  themes: KeyCount[];
  styles: KeyCount[];
  referrers: KeyCount[];
}

export interface AdminInfo {
  backend: {
    version: string;
    buildTime: string | null;
    javaVersion: string;
    springBootVersion: string;
    uptimeSeconds: number;
    startedAt: string;
    profiles: string;
  };
  database: { status: string; version: string | null };
  storage: { status: string; description: string };
  system: { os: string; memoryUsedMb: number; memoryMaxMb: number; processors: number };
}

export interface ApiError {
  status: number;
  error: string;
  message: string | null;
  fields?: Record<string, string>;
  path: string;
  timestamp: string;
}

// ── backups & server ──────────────────────────────────────────────────────────

export type BackupKind = 'BACKUP' | 'RESTORE';
export type BackupTrigger = 'MANUAL' | 'SCHEDULED' | 'DOWNLOAD' | 'UPLOAD';
export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface BackupRun {
  id: string;
  kind: BackupKind;
  trigger: BackupTrigger;
  status: BackupStatus;
  startedAt: string;
  finishedAt: string | null;
  fileName: string | null;
  driveFileId: string | null;
  sizeBytes: number | null;
  message: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  size: number | null;
  createdTime: string | null;
}

export interface BackupSettings {
  autoEnabled: boolean;
  hourUtc: number;
  keepCount: number;
}

export type RowStatus = 'NEW' | 'CONFLICT' | 'CHANGED' | 'CURRENT_ONLY' | 'SAME';

export interface RowDiff {
  id: string;
  label: string | null;
  detail: string | null;
  status: RowStatus;
  changes: string[];
}

export interface TableDiff {
  table: string;
  archive: number;
  current: number;
  added: number;
  changed: number;
  same: number;
  currentOnly: number;
  conflicts: number;
  /** null for analytics (counts only) */
  rows: RowDiff[] | null;
}

export interface StagedPreview {
  id: string;
  source: string;
  manifest: { format: number; appVersion: string; schemaVersion: string; createdAt: string; tables: number; mediaCount: number; mediaBytes: number };
  currentSchema: string | null;
  schemaMatches: boolean;
  expiresAt: string;
  tables: TableDiff[];
  mediaObjects: number;
  mediaBytes: number;
}

export interface ApplyRestore {
  mode: 'REPLACE' | 'MERGE';
  rows?: Record<string, string[]>;
  analytics?: boolean;
  force?: boolean;
}

export interface BackupOverview {
  drive: {
    connected: boolean;
    email: string | null;
    displayName: string | null;
    quotaLimit: number | null;
    quotaUsage: number | null;
    folderId: string | null;
    error: string | null;
  };
  settings: BackupSettings;
  running: boolean;
  schemaVersion: string | null;
  runs: BackupRun[];
  files: DriveFile[];
}

export interface SystemInfo {
  cpu: { processLoad: number; systemLoad: number; cores: number };
  memory: { totalMb: number; usedMb: number; freeMb: number; jvmHeapUsedMb: number; jvmHeapMaxMb: number };
  disk: { path: string; totalMb: number; usedMb: number; freeMb: number };
  data: { databaseBytes: number; mediaBytes: number; mediaCount: number; analyticsEvents: number };
  uptimeSeconds: number;
  sampledAt: string;
}

export type AnalyticsEventType = 'PAGE_VIEW' | 'PROJECT_VIEW' | 'OUTBOUND_CLICK' | 'CONTACT_SUBMIT' | 'CV_DOWNLOAD';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  path: string;
  projectSlug?: string;
  locale?: string;
  theme?: string;
  style?: string;
  referrer?: string;
  viewportWidth?: number;
}
