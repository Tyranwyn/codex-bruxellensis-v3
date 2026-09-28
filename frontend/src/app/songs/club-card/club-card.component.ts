import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {RouterLink} from '@angular/router';

import {Club} from '../models/club';

/** A club's header from the book: name, motto, description, founding year, founders and colours. */
@Component({
  selector: 'app-club-card',
  imports: [RouterLink],
  template: `
    <aside class="club-card">
      @if (link()) {
        <a class="club-name" [routerLink]="['/club', club().id]">{{ club().name }}</a>
      } @else {
        <h1 class="song-title">{{ club().name }}</h1>
      }
      @if (club().motto) {
        <p class="club-motto">{{ club().motto }}</p>
      }
      @if (club().description) {
        <p class="club-description">{{ club().description }}</p>
      }
      @if (club().founded || club().founders.length || club().colours.length) {
        <dl class="song-meta">
          @if (club().founded) {
            <dt>Gesticht</dt><dd>{{ club().founded }}</dd>
          }
          @if (club().founders.length) {
            <dt>Stichters</dt><dd>{{ club().founders.join(', ') }}</dd>
          }
          @if (club().colours.length) {
            <dt>Kleuren</dt><dd>{{ club().colours.join(' – ') }}</dd>
          }
        </dl>
      }
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubCardComponent {
  readonly club = input.required<Club>();
  /** Show the name as a link to the club page, for use above a song. */
  readonly link = input(false);
}
