import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface IconDef {
  d: string;
  fill?: boolean;
}

/** Hand-drawn 24px stroke icons (plus two filled brand marks). No icon font, no external sprite. */
const ICONS: Record<string, IconDef> = {
  home: { d: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5v-5h4v5h4.5V10' },
  grid: { d: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  user: { d: 'M20 21a8 8 0 0 0-16 0M12 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z' },
  mail: { d: 'M4 6h16v12H4zM4 7l8 6 8-6' },
  globe: { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18' },
  sun: { d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
  moon: { d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z' },
  palette: { d: 'M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2 0-.8-.5-1.2-.5-2 0-1 .8-1.5 2-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 10.5h.01M10.5 7h.01M15 7h.01M17.5 10h.01' },
  'arrow-right': { d: 'M4 12h16M13 5l7 7-7 7' },
  'arrow-up-right': { d: 'M7 17 17 7M8 7h9v9' },
  'arrow-up': { d: 'M12 20V4M5 11l7-7 7 7' },
  'arrow-down': { d: 'M12 4v16M5 13l7 7 7-7' },
  external: { d: 'M14 4h6v6M20 4l-9 9M18 13v6H5V6h6' },
  close: { d: 'M6 6l12 12M18 6 6 18' },
  check: { d: 'M5 12.5l4.5 4.5L19 7.5' },
  menu: { d: 'M4 7h16M4 12h16M4 17h16' },
  'chevron-left': { d: 'M15 5l-7 7 7 7' },
  'chevron-right': { d: 'M9 5l7 7-7 7' },
  image: { d: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01' },
  settings: { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  chart: { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  inbox: { d: 'M4 13l2.5-8h11L20 13v6H4zM4 13h5l1.5 2h3L15 13h5' },
  logout: { d: 'M10 4H5v16h5M14 16l4-4-4-4M18 12H9' },
  drag: { d: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01' },
  plus: { d: 'M12 5v14M5 12h14' },
  trash: { d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6' },
  edit: { d: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z M13 7l3 3' },
  upload: { d: 'M12 16V4M6 10l6-6 6 6M4 20h16' },
  copy: { d: 'M9 9h11v11H9zM5 15H4V4h11v1' },
  eye: { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  star: { d: 'm12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.7l6.2-.9z' },
  sparkles: { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8zM5 2l.6 1.6 1.6.6-1.6.6L5 6.4l-.6-1.6L2.8 4.2l1.6-.6z' },
  monitor: { d: 'M3 5h18v11H3zM8 20h8M12 16v4' },
  phone: { d: 'M7 3h10v18H7zM11 18h2' },
  layers: { d: 'M12 3 2 8l10 5 10-5zM2 13l10 5 10-5M2 18l10 5 10-5' },
  send: { d: 'M22 2 11 13M22 2l-7 20-4-9-9-4z' },
  refresh: { d: 'M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4M4 4v5h5M20 20v-5h-5' },
  pin: { d: 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  'map-pin': { d: 'M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  briefcase: { d: 'M3 8h18v12H3zM9 8V5h6v3M3 13h18' },
  'graduation-cap': { d: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6' },
  code: { d: 'M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16' },
  github: {
    fill: true,
    d: 'M12 .5C5.7.5.6 5.6.6 11.9c0 5 3.3 9.3 7.8 10.8.6.1.8-.2.8-.5v-2c-3.2.7-3.8-1.4-3.8-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.5-.3-5.2-1.3-5.2-5.7 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.5.2 2.7.1 3 .7.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.2 5.7.4.4.8 1.1.8 2.1v3.2c0 .3.2.7.8.5 4.5-1.5 7.8-5.8 7.8-10.8C23.4 5.6 18.3.5 12 .5z',
  },
  linkedin: {
    fill: true,
    d: 'M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2zM8 19H5V9.5h3V19zM6.5 8.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.7 13 12.7 14.3V19h-3V9.5h2.9v1.3c.4-.8 1.4-1.5 2.8-1.5 3 0 3.6 2 3.6 4.6V19z',
  },
  google: {
    fill: true,
    d: 'M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z',
  },
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.fill]="def().fill ? 'currentColor' : 'none'"
      [attr.stroke]="def().fill ? 'none' : 'currentColor'"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path [attr.d]="def().d" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
      flex: none;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly def = computed(() => ICONS[this.name()] ?? ICONS['sparkles']);
}
