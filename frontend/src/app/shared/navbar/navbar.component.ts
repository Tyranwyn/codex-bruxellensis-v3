import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faUser} from '@fortawesome/free-solid-svg-icons';

import {AuthService} from '../../core/auth.service';
import {EditionService} from '../../core/edition.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, FaIconComponent],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  private readonly edition = inject(EditionService);

  readonly editions = this.edition.editions;
  readonly current = this.edition.current;
  readonly sections = computed(() => this.current()?.sections ?? []);
  readonly user = this.auth.user;
  readonly userName = computed(() => this.user()?.displayName || this.user()?.email);
  readonly menuOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly exactMatch = {paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored'} as const;
  readonly faUser = faUser;

  selectEdition(value: string): void {
    this.edition.select(Number(value));
    this.closeMenu();
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.accountOpen.set(false);
    await this.auth.logout();
  }
}
