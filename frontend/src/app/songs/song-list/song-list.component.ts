import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, Injectable,
  Injector, input, signal, untracked, viewChild
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
import {titleCase} from '../title-case';

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
        kind: 'club', id: club.id, name: titleCase(club.name), page, section: song.section,
        searchText: normalize(`${page} ${club.name}`)
      });
    }
    items.push({
      kind: 'song', id: song.id, name: titleCase(song.title), page, section: song.section,
      searchText: normalize(`${page} ${song.title} ${song.sortTitle ?? ''} ${club?.name ?? ''}`)
    });
  }
  return items;
}

/** Where the reader left the list, per list (all songs, a section, favorites), so going back to it lands on the same spot. */
@Injectable({providedIn: 'root'})
export class SongListState {
  private readonly saved = new Map<string, {filter: string, offset: number}>();

  get(list: string): {filter: string, offset: number} | undefined {
    return this.saved.get(list);
  }

  set(list: string, filter: string, offset: number): void {
    this.saved.set(list, {filter, offset});
  }
}

@Component({
  selector: 'app-song-list',
  imports: [FormsModule, RouterLink, FaIconComponent],
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
  /** Route data: only the reader's favorite songs, without club headers. */
  readonly favorites = input(false);
  private readonly listKey = computed(() => `${this.favorites() ? 'favorites' : ''}/${this.section() ?? ''}`);
  readonly filter = signal('');
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  private readonly songs = toSignal(this.songService.all$);
  private readonly clubs = toSignal(this.songService.clubs$);
  readonly items = computed(() => {
    const songs = this.songs();
    const clubs = this.clubs();
    if (!songs || !clubs) {
      return undefined;
    }
    if (!this.favorites()) {
      return listItems(songs, clubs);
    }
    // Wait for Firebase to restore the session, then for the user's data (`null` until loaded).
    if (this.auth.user() === undefined || (this.loggedIn() && this.userData.data() === null)) {
      return undefined;
    }
    const favorites = this.userData.favorites();
    return listItems(songs, clubs).filter(item => item.kind === 'song' && favorites.has(item.id));
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
    // The offset is tracked while scrolling: by the time the component is destroyed, the list is detached and reads 0.
    // A plain passive listener, not a template binding, so scrolling doesn't run change detection.
    let offset = 0;
    effect(onCleanup => {
      const element = this.scroller()?.nativeElement;
      if (element) {
        const track = () => offset = element.scrollTop;
        element.addEventListener('scroll', track, {passive: true});
        onCleanup(() => element.removeEventListener('scroll', track));
      }
    });
    inject(DestroyRef).onDestroy(() => this.state.set(this.listKey(), this.filter(), offset));
  }

  isFavorite(item: ListItem): boolean {
    return this.userData.isFavorite(item.id);
  }

  toggleFavorite(item: ListItem): Promise<void> {
    return this.userData.toggleFavorite(item.id);
  }

  /** Puts back the saved filter, then the scroll offset once the list is rendered at full height. */
  private restore(): void {
    const saved = this.state.get(untracked(this.listKey));
    if (!saved) {
      return;
    }
    this.filter.set(saved.filter);
    const ref = effect(() => {
      const element = this.scroller()?.nativeElement;
      if (!element || this.visibleItems().length === 0) {
        return;
      }
      ref.destroy();
      // Scrolling before the rows are rendered gets clamped to 0.
      afterNextRender(() => element.scrollTop = saved.offset, {injector: this.injector});
    }, {injector: this.injector});
  }
}
