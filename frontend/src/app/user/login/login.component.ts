import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {NonNullableFormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faEnvelope} from '@fortawesome/free-regular-svg-icons';
import {faLock} from '@fortawesome/free-solid-svg-icons';

import {AuthService} from '../../core/auth.service';
import {SOCIAL_PROVIDERS, SocialProvider} from '../auth-providers';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, FaIconComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  readonly auth = inject(AuthService);

  readonly providers = SOCIAL_PROVIDERS;
  readonly icons = {envelope: faEnvelope, lock: faLock};
  readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  loginWith(provider: SocialProvider): Promise<void> {
    return this.auth.loginWithProvider(provider.create());
  }

  async login(): Promise<void> {
    if (this.checkForm()) {
      const {email, password} = this.form.getRawValue();
      await this.auth.loginWithEmail(email, password);
    }
  }

  async signup(): Promise<void> {
    if (this.checkForm()) {
      const {email, password} = this.form.getRawValue();
      await this.auth.signupWithEmail(email, password);
    }
  }

  private checkForm(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }
}
