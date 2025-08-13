/**
 * Theme management store for dark/light mode
 */

import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

class ThemeStore {
  private _theme = $state<Theme>('light');

  constructor() {
    if (browser) {
      this.initializeTheme();
    }
  }

  get theme(): Theme {
    return this._theme;
  }

  get isDark(): boolean {
    return this._theme === 'dark';
  }

  private initializeTheme() {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('tango-theme') as Theme;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
      this._theme = savedTheme;
    } else if (systemPrefersDark) {
      this._theme = 'dark';
    }

    this.applyTheme();

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem('tango-theme')) {
          this._theme = e.matches ? 'dark' : 'light';
          this.applyTheme();
        }
      });
  }

  toggleTheme() {
    this._theme = this._theme === 'light' ? 'dark' : 'light';
    this.saveTheme();
    this.applyTheme();
  }

  setTheme(theme: Theme) {
    this._theme = theme;
    this.saveTheme();
    this.applyTheme();
  }

  private saveTheme() {
    if (browser) {
      localStorage.setItem('tango-theme', this._theme);
    }
  }

  private applyTheme() {
    if (browser) {
      const html = document.documentElement;
      if (this._theme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
  }
}

export const themeStore = new ThemeStore();
