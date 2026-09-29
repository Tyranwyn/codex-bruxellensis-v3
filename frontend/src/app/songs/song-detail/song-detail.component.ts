import {Location} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, effect, inject, input} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {Title} from '@angular/platform-browser';
import {Router} from '@angular/router';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faStar} from '@fortawesome/free-regular-svg-icons';
import {faChevronLeft, faStar as faStarSolid} from '@fortawesome/free-solid-svg-icons';
import {map, Observable, of, switchMap, tap} from 'rxjs';

import {AuthService} from '../../core/auth.service';
import {UserDataService} from '../../core/user-data.service';
import {ClubCardComponent} from '../club-card/club-card.component';
import {Song} from '../models/song';
import {SongService} from '../song.service';
import {pagesLabel} from '../stanza/lyrics';
import {StanzaComponent} from '../stanza/stanza.component';
import {SongTitlePipe, titleCase} from '../title-case';

@Component({
  selector: 'app-song-detail',
  imports: [FaIconComponent, ClubCardComponent, StanzaComponent, SongTitlePipe],
  templateUrl: './song-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SongDetailComponent {
  private readonly songService = inject(SongService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);
  private readonly location = inject(Location);

  /** `:id` route parameter. */
  readonly id = input.required<string>();
  /** `null` while loading, `undefined` when the song is not in this edition. */
  readonly song = toSignal(toObservable(this.id).pipe(switchMap(id => this.lookup(id))), {initialValue: null});
  private readonly clubs = toSignal(this.songService.clubs$);
  readonly club = computed(() => {
    const clubId = this.song()?.clubId;
    return clubId ? this.clubs()?.get(clubId) : undefined;
  });
  readonly pages = computed(() => {
    const song = this.song();
    return song ? pagesLabel(song.pages) : '';
  });

  readonly loggedIn = computed(() => !!this.auth.uid());
  readonly isFavorite = computed(() => this.userData.favorites().has(this.id()));

  readonly icons = {back: faChevronLeft, star: faStar, starSolid: faStarSolid};

  constructor() {
    const title = inject(Title);
    effect(() => {
      const song = this.song();
      if (song) {
        title.setTitle(titleCase(song.title));
      }
    });
  }

  toggleFavorite(): Promise<void> {
    return this.userData.toggleFavorite(this.id());
  }

  back(): void {
    this.location.back();
  }

  /** The song; for a club id (old links pointed clubs to /song too), redirects to the club page. */
  private lookup(id: string): Observable<Song | null | undefined> {
    return this.songService.song$(id).pipe(
      switchMap(song => song ? of(song) : this.songService.club$(id).pipe(
        tap(club => {
          if (club) {
            void this.router.navigate(['/club', id], {replaceUrl: true});
          }
        }),
        map(club => club ? null : undefined)
      ))
    );
  }
}
