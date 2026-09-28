import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {provideServiceWorker} from '@angular/service-worker';

import {AppComponent} from './app.component';
import {AuthService} from './core/auth.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideServiceWorker('ngsw-worker.js', {enabled: false}),
        {provide: AuthService, useValue: {user: signal(null), logout: () => Promise.resolve()}}
      ]
    }).compileComponents();
  });

  it('renders the navbar', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.nav-title h1')?.textContent).toContain('Codex Bruxellensis');
    expect(element.querySelectorAll('.navbar-end .navbar-item').length).toBe(8);
  });
});
