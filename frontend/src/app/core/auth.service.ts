import {computed, inject, Injectable, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import {
  AuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {authState} from 'rxfire/auth';
import {map} from 'rxjs';

import {User} from '../user/user';
import {FIREBASE_AUTH} from './firebase';

@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);
  private readonly router = inject(Router);

  /** The signed-in user, `null` when signed out, `undefined` until Firebase has restored the session. */
  readonly user = toSignal(authState(this.auth).pipe(
    map((user): User | null => user && {uid: user.uid, displayName: user.displayName, email: user.email})
  ));
  readonly uid = computed(() => this.user()?.uid ?? null);

  private readonly pending = signal(false);
  readonly loading = computed(() => this.pending() || this.user() === undefined);
  readonly error = signal<string | null>(null);

  loginWithProvider(provider: AuthProvider): Promise<void> {
    return this.signIn(() => signInWithPopup(this.auth, provider));
  }

  loginWithEmail(email: string, password: string): Promise<void> {
    return this.signIn(() => signInWithEmailAndPassword(this.auth, email, password));
  }

  signupWithEmail(email: string, password: string): Promise<void> {
    return this.signIn(() => createUserWithEmailAndPassword(this.auth, email, password));
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  private async signIn(attempt: () => Promise<unknown>): Promise<void> {
    this.pending.set(true);
    this.error.set(null);
    try {
      await attempt();
      await this.router.navigate(['/']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.pending.set(false);
    }
  }
}
