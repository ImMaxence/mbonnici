import { DestroyRef, Directive, ElementRef, PLATFORM_ID, afterNextRender, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * A short muted loop that plays only while it is on screen (paused off screen: no CPU nor battery
 * spent on what nobody sees) and never by itself when the visitor asked for reduced motion: then it
 * shows its first frame and plays on hover or focus.
 *
 *   <video appAutoplay muted loop playsinline preload="metadata" [src]="…"></video>
 */
@Directive({
  selector: 'video[appAutoplay]',
  host: { '[muted]': 'true', '[attr.playsinline]': '""', '[attr.disablepictureinpicture]': '""' },
})
export class AutoplayDirective {
  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const video = inject<ElementRef<HTMLVideoElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      video.muted = true;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      const play = (): void => void video.play().catch(() => undefined);
      let visible = false;
      const update = (): void => {
        if (visible && !reduced.matches) play();
        else video.pause();
      };
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        update();
      }, { threshold: 0.15 });
      io.observe(video);
      // reduced motion: the visitor starts it
      const enter = (): void => {
        if (reduced.matches) play();
      };
      const leave = (): void => {
        if (reduced.matches) video.pause();
      };
      video.addEventListener('pointerenter', enter);
      video.addEventListener('pointerleave', leave);
      reduced.addEventListener('change', update);
      destroyRef.onDestroy(() => {
        io.disconnect();
        video.removeEventListener('pointerenter', enter);
        video.removeEventListener('pointerleave', leave);
        reduced.removeEventListener('change', update);
      });
    });
  }
}
