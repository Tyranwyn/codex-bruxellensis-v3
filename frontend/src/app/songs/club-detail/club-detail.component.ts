import {Location} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, effect, inject, input} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {Title} from '@angular/platform-browser';
import {RouterLink} from '@angular/router';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faChevronLeft} from '@fortawesome/free-solid-svg-icons';
import {switchMap} from 'rxjs';

import {ClubCardComponent} from '../club-card/club-card.component';
import {SongService} from '../song.service';
import {pagesLabel} from '../stanza/lyrics';
import {SongTitlePipe, titleCase} from '../title-case';

@Component({
  selector: 'app-club-detail',
  imports: [RouterLink, FaIconComponent, ClubCardComponent, SongTitlePipe],
  templateUrl: './club-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubDetailComponent {
  private readonly songService = inject(SongService);
  private readonly location = inject(Location);

  /** `:id` route parameter. */
  readonly id = input.required<string>();
  /** `null` while loading, `undefined` when the club is not in this edition. */
  readonly club = toSignal(toObservable(this.id).pipe(switchMap(id => this.songService.club$(id))), {initialValue: null});
  private readonly allSongs = toSignal(this.songService.all$);
  readonly songs = computed(() => (this.allSongs() ?? []).filter(song => song.clubId === this.id()));

  readonly pagesLabel = pagesLabel;
  readonly icons = {back: faChevronLeft};

  constructor() {
    const title = inject(Title);
    effect(() => {
      const club = this.club();
      if (club) {
        title.setTitle(titleCase(club.name));
      }
    });
  }

  back(): void {
    this.location.back();
  }
}
