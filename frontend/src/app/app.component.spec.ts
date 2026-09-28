import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideServiceWorker} from '@angular/service-worker';

import {AppComponent} from './app.component';
import {AuthService} from './core/auth.service';
import {EditionService} from './core/edition.service';
import {Edition} from './songs/models/edition';

const EDITION: Edition = {
  number: 7, year: 2022, songCount: 366, clubCount: 41, sections: [
    {id: 'kringliederen', title: 'Kringliederen', position: 0, startPage: 31},
    {id: 'officiele-liederen', title: 'Officiële liederen', position: 1, startPage: 89}
  ]
};

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideServiceWorker('ngsw-worker.js', {enabled: false}),
        {provide: AuthService, useValue: {user: signal(null), logout: () => Promise.resolve()}},
        {provide: EditionService, useValue: {editions: signal([EDITION]), current: signal(EDITION), select: () => undefined}}
      ]
    }).compileComponents();
  });

  it('renders the navbar', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.nav-title h1')?.textContent).toContain('Codex Bruxellensis');
    expect(element.querySelector('.nav-edition')?.textContent).toContain('Edition 7 (2022)');
    // Home, the sections dropdown with its two sections, settings and login; no edition picker for a single edition.
    expect(element.querySelectorAll('.navbar-end .navbar-item').length).toBe(6);
    expect(element.querySelector('.navbar-end select')).toBeNull();
  });
});
