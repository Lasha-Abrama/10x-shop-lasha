import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import type { Location } from 'react-router';
import { focusScrollTarget, scrollIntent } from '../navigation/scroll';

export function RouteScroll() {
  const location = useLocation();
  const navigation = useNavigationType();
  const previous = useRef<Location | null>(null);
  const positions = useRef(new Map<string, { left: number; top: number }>());

  useLayoutEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = original; };
  }, []);

  useLayoutEffect(() => {
    const saved = positions.current.get(location.key);
    const intent = scrollIntent(previous.current?.key === location.key ? null : previous.current, location, navigation, Boolean(saved));
    previous.current = location;
    const main = document.getElementById('main-content');
    const remember = () => positions.current.set(location.key, { left: window.scrollX, top: window.scrollY });
    let active = true;
    let frame = 0;
    let deadline: number | undefined;
    let releaseFocus = () => {};
    const mutations = new MutationObserver(schedule);
    const sizes = new ResizeObserver(schedule);

    function stop() {
      active = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(deadline);
      mutations.disconnect();
      sizes.disconnect();
    }
    function apply(expired = false) {
      if (!active || !main) return;
      const ready = expired || (document.fonts.status === 'loaded' && !main.querySelector('[data-scroll-pending]'));
      if (intent === 'restore' && saved) window.scrollTo({ ...saved, behavior: 'instant' });
      else if (intent === 'top') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      else if (intent === 'anchor' || intent === 'results') {
        let id = 'catalog-results';
        if (intent === 'anchor') {
          try { id = decodeURIComponent(location.hash.slice(1)); } catch { stop(); return; }
        }
        const target = document.getElementById(id);
        if (!target) { if (ready) stop(); return; }
        // Re-align only while content is settling; user input cancels this observation.
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        if (ready) {
          releaseFocus = focusScrollTarget(target);
        }
      }
      if (ready) {
        if (intent === 'top') main.focus({ preventScroll: true });
        stop();
      }
    }
    function schedule() {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apply());
    }

    if (intent !== 'preserve' && main) {
      mutations.observe(main, { childList: true, subtree: true });
      sizes.observe(main);
      // A stalled request must not keep scroll observers alive indefinitely.
      deadline = window.setTimeout(() => apply(true), 20_000);
      apply();
      void document.fonts.ready.then(schedule);
    }
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('pagehide', remember);
    const interrupts = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    interrupts.forEach((event) => window.addEventListener(event, stop, { passive: true }));
    return () => {
      stop();
      releaseFocus();
      window.removeEventListener('scroll', remember);
      window.removeEventListener('pagehide', remember);
      interrupts.forEach((event) => window.removeEventListener(event, stop));
    };
  }, [location, navigation]);

  return null;
}
