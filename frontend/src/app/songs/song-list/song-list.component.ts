import {ScrollingModule} from '@angular/cdk/scrolling';
import {ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {Title} from '@angular/platform-browser';
import {RouterLink} from '@angular/router';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faEdit, faStar} from '@fortawesome/free-regular-svg-icons';
import {faSearch, faStar as faStarSolid} from '@fortawesome/free-solid-svg-icons';

import {AuthService} from '../../core/auth.service';
import {UserDataService} from '../../core/user-data.service';
import {environment} from '../../../environment';
import {Song} from '../models/song';
import {SongFormComponent} from '../song-form/song-form.component';
import {SongService} from '../song.service';

/** Lowercases and strips accents, so "e" matches "é". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function matchesSearch(song: Song, term: string): boolean {
  return normalize(`${song.page} ${song.title} ${song.battleCryName} ${song.associationName}`).includes(term);
}

@Component({
  selector: 'app-song-list',
  imports: [FormsModule, RouterLink, ScrollingModule, FaIconComponent, SongFormComponent],
  templateUrl: './song-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SongListComponent {
  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);

  /** `?category=` query parameter. */
  readonly category = input<string>();
  readonly filter = signal('');

  readonly songs = toSignal(inject(SongService).all$);
  readonly visibleSongs = computed(() => {
    const category = this.category();
    const term = normalize(this.filter().trim());
    return (this.songs() ?? []).filter(song =>
      (!category || song.category === category) && (!term || matchesSearch(song, term)));
  });

  readonly loggedIn = computed(() => !!this.auth.uid());
  readonly isAdmin = this.userData.isAdmin;

  readonly formOpen = signal(false);
  readonly editedSong = signal<Song | null>(null);

  readonly icons = {search: faSearch, star: faStar, starSolid: faStarSolid, edit: faEdit};

  constructor() {
    inject(Title).setTitle(environment.title);
  }

  readonly trackById = (_: number, song: Song) => song.id;

  isFavorite(song: Song): boolean {
    return this.userData.isFavorite(song.id);
  }

  toggleFavorite(song: Song): Promise<void> {
    return this.userData.toggleFavorite(song.id);
  }

  add(): void {
    this.editedSong.set(null);
    this.formOpen.set(true);
  }

  edit(song: Song): void {
    this.editedSong.set(song);
    this.formOpen.set(true);
  }
}
