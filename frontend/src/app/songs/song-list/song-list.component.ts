import {CdkVirtualScrollViewport, ScrollingModule} from '@angular/cdk/scrolling';
import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, Injectable, Injector, input,
  signal, untracked, viewChild
} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {Title} from '@angular/platform-browser';
import {Router, RouterLink} from '@angular/router';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {faStar} from '@fortawesome/free-regular-svg-icons';
import {faSearch, faStar as faStarSolid} from '@fortawesome/free-solid-svg-icons';

import {AuthService} from '../../core/auth.service';
import {UserDataService} from '../../core/user-data.service';
import {environment} from '../../../environment';
import {Club} from '../models/club';
import {Song} from '../models/song';
import {SongService} from '../song.service';

/** A row in the list: a song, or a club header placed right before the club's first song. */
export interface ListItem {
  kind: 'song' | 'club';
  id: string;
  name: string;
  page: number;
  section: string;
  /** Normalized text that the search matches against. */
  searchText: string;
}

/** Lowercases and strips accents, so "e" matches "é". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Songs in book order, each club inserted before its first song. */
export function listItems(songs: readonly Song[], clubs: ReadonlyMap<string, Club>): ListItem[] {
  const items: ListItem[] = [];
  const placed = new Set<string>();
  for (const song of songs) {
    const club = song.clubId ? clubs.get(song.clubId) : undefined;
    const page = song.pages.start;
    if (club && !placed.has(club.id)) {
      placed.add(club.id);
      items.push({
        kind: 'club', id: club.id, name: club.name, page, section: song.section,
        searchText: normalize(`${page} ${club.name}`)
      });
    }
    items.push({
      kind: 'song', id: song.id, name: song.title, page, section: song.section,
      searchText: normalize(`${page} ${song.title} ${song.sortTitle ?? ''} ${club?.name ?? ''}`)
    });
  }
  return items;
}

/** Where the reader left the list, per section filter, so going back to it lands on the same spot. */
@Injectable({providedIn: 'root'})
export class SongListState {
  private readonly saved = new Map<string, {filter: string, offset: number}>();

  get(section: string | undefined): {filter: string, offset: number} | undefined {
    return this.saved.get(section ?? '');
  }

  set(section: string | undefined, filter: string, offset: number): void {
    this.saved.set(section ?? '', {filter, offset});
  }
}

@Component({
  selector: 'app-song-list',
  imports: [FormsModule, RouterLink, ScrollingModule, FaIconComponent],
  templateUrl: './song-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SongListComponent {
  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserDataService);
  private readonly songService = inject(SongService);
  private readonly state = inject(SongListState);
  private readonly injector = inject(Injector);

  /** `?section=` query parameter. */
  readonly section = input<string>();
  readonly filter = signal('');
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  private readonly songs = toSignal(this.songService.all$);
  private readonly clubs = toSignal(this.songService.clubs$);
  readonly items = computed(() => {
    const songs = this.songs();
    const clubs = this.clubs();
    return songs && clubs ? listItems(songs, clubs) : undefined;
  });
  readonly visibleItems = computed(() => {
    const section = this.section();
    const term = normalize(this.filter().trim());
    return (this.items() ?? []).filter(item =>
      (!section || item.section === section) && (!term || item.searchText.includes(term)));
  });

  readonly loggedIn = computed(() => !!this.auth.uid());

  readonly icons = {search: faSearch, star: faStar, starSolid: faStarSolid};

  constructor() {
    inject(Title).setTitle(environment.title);
    // Only a back/forward navigation returns to the saved spot; a link to the list starts at the top.
    if (inject(Router).currentNavigation()?.trigger === 'popstate') {
      this.restore();
    }
    // The offset is tracked while scrolling: by the time the component is destroyed, the viewport is detached and reads 0.
    let offset = 0;
    effect(onCleanup => {
      const viewport = this.viewport();
      if (viewport) {
        const subscription = viewport.elementScrolled().subscribe(() => offset = viewport.measureScrollOffset());
        onCleanup(() => subscription.unsubscribe());
      }
    });
    inject(DestroyRef).onDestroy(() => this.state.set(this.section(), this.filter(), offset));
  }

  readonly trackItem = (_: number, item: ListItem) => `${item.kind}/${item.id}`;

  isFavorite(item: ListItem): boolean {
    return this.userData.isFavorite(item.id);
  }

  toggleFavorite(item: ListItem): Promise<void> {
    return this.userData.toggleFavorite(item.id);
  }

  /** Puts back the saved filter, then the scroll offset once the list is rendered at full height. */
  private restore(): void {
    const saved = this.state.get(untracked(this.section));
    if (!saved) {
      return;
    }
    this.filter.set(saved.filter);
    const ref = effect(() => {
      const viewport = this.viewport();
      if (!viewport || this.visibleItems().length === 0) {
        return;
      }
      ref.destroy();
      // The viewport sizes its content in a later render; scrolling before that gets clamped to 0.
      let attempts = 10;
      const scroll = () => {
        viewport.scrollToOffset(saved.offset);
        if (viewport.measureScrollOffset() < saved.offset && --attempts > 0) {
          afterNextRender(scroll, {injector: this.injector});
          viewport.checkViewportSize();
        }
      };
      afterNextRender(scroll, {injector: this.injector});
    }, {injector: this.injector});
  }
}
