import {Location} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, effect, inject, input} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {Title} from '@angular/platform-browser';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faStar} from '@fortawesome/free-regular-svg-icons';
import {faChevronLeft, faStar as faStarSolid} from '@fortawesome/free-solid-svg-icons';
import {switchMap} from 'rxjs';

import {AuthService} from '../../core/auth.service';
import {UserDataService} from '../../core/user-data.service';
import {SongService} from '../song.service';

@Component({
  selector: 'app-song-detail',
  imports: [FaIconComponent],
  templateUrl: './song-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SongDetailComponent {
  private readonly songService = inject(SongService);
  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);
  private readonly location = inject(Location);

  /** `:id` route parameter. */
  readonly id = input.required<string>();
  readonly song = toSignal(toObservable(this.id).pipe(switchMap(id => this.songService.song$(id))));

  readonly loggedIn = computed(() => !!this.auth.uid());
  readonly isFavorite = computed(() => this.userData.favorites().has(this.id()));

  readonly icons = {back: faChevronLeft, star: faStar, starSolid: faStarSolid};

  constructor() {
    const title = inject(Title);
    effect(() => {
      const song = this.song();
      if (song) {
        title.setTitle(song.title || song.associationName);
      }
    });
  }

  toggleFavorite(): Promise<void> {
    return this.userData.toggleFavorite(this.id());
  }

  back(): void {
    this.location.back();
  }
}
