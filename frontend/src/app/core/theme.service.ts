import {computed, DestroyRef, DOCUMENT, effect, inject, Injectable, signal} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'auto';

/** Also read by the inline script in index.html, which applies the theme before the app starts. */
const STORAGE_KEY = 'codex-theme';

/** Header colors, used for the browser's theme-color. */
const THEME_COLORS = {light: '#ffffff', dark: '#1e1e1e'} as const;

function readStoredPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** The color scheme the reader chose: light, dark, or auto (follows the system). */
@Injectable({providedIn: 'root'})
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly preference = signal(readStoredPreference());

  private readonly systemDark = signal(false);

  /** The scheme actually shown. */
  readonly resolved = computed(() => {
    const preference = this.preference();
    return preference === 'auto' ? (this.systemDark() ? 'dark' : 'light') : preference;
  });

  constructor() {
    const query = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (query) {
      this.systemDark.set(query.matches);
      const listener = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
      query.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
    }

    effect(() => {
      const root = this.document.documentElement;
      const preference = this.preference();
      if (preference === 'auto') {
        delete root.dataset['theme'];
      } else {
        root.dataset['theme'] = preference;
      }
      const color = THEME_COLORS[this.resolved()];
      this.document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', color));
    });
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      if (preference === 'auto') {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      // Storage can be blocked; the choice then lasts for this session only.
    }
  }
}
