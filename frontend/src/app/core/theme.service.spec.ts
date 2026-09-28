import {TestBed} from '@angular/core/testing';

import {ThemeService} from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.removeItem('codex-theme');
    delete root.dataset['theme'];
  });

  afterEach(() => {
    localStorage.removeItem('codex-theme');
    delete root.dataset['theme'];
  });

  function create(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  it('follows the system by default', () => {
    const service = create();
    expect(service.preference()).toBe('auto');
    expect(root.dataset['theme']).toBeUndefined();
  });

  it('applies and stores an explicit choice', () => {
    const service = create();
    service.set('dark');
    TestBed.tick();
    expect(root.dataset['theme']).toBe('dark');
    expect(service.resolved()).toBe('dark');
    expect(localStorage.getItem('codex-theme')).toBe('dark');

    service.set('auto');
    TestBed.tick();
    expect(root.dataset['theme']).toBeUndefined();
    expect(localStorage.getItem('codex-theme')).toBeNull();
  });

  it('restores the stored choice', () => {
    localStorage.setItem('codex-theme', 'light');
    const service = create();
    expect(service.preference()).toBe('light');
    expect(root.dataset['theme']).toBe('light');
  });
});
