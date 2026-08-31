/**
 * Theme management store for dark/light mode
 */

import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

class ThemeStore {
  private _theme = $state<Theme>('dark');

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
    // Default to the observatory theme until a player chooses otherwise.
    const savedTheme = localStorage.getItem('tango-theme') as Theme;
    
    if (savedTheme) {
      this._theme = savedTheme;
    }

    this.applyTheme();
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
