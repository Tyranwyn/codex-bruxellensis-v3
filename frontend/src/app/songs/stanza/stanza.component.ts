import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

import {Stanza} from '../models/song';
import {layoutLyrics, timesLabel} from './lyrics';

/** One stanza: verse, chorus (italic, indented), chorus reference or stage direction. */
@Component({
  selector: 'app-stanza',
  template: `
    @switch (stanza().kind) {
      @case ('chorus-ref') {
        <p class="stanza chorus-ref">Refrein{{ stanza().instruction ? ' ' + stanza().instruction : '' }}{{ times() }}</p>
      }
      @case ('direction') {
        <p class="stanza direction">{{ stanza().instruction }}{{ times() }}</p>
      }
      @default {
        <div class="stanza" [class.chorus]="stanza().kind === 'chorus'">
          <div class="lines" [style.grid-template-columns]="columns()">
            @for (line of layout().lines; track $index) {
              <span class="line" [style.grid-row]="$index + 1">{{ line.text }}@for (mark of line.marks; track $index) {<span class="mark">{{ mark }}</span>}</span>
            }
            @for (bracket of layout().brackets; track $index) {
              <span class="bracket" [style.grid-row]="(bracket.from + 1) + ' / ' + (bracket.to + 2)"
                    [style.grid-column]="bracket.lane + 2"
                    [title]="bracket.marker + ', ' + (bracket.to - bracket.from + 1) + ' regels'">{{ bracket.marker }}</span>
            }
          </div>
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StanzaComponent {
  readonly stanza = input.required<Stanza>();

  readonly layout = computed(() => layoutLyrics(this.stanza()));
  readonly times = computed(() => timesLabel(this.stanza().repeat));
  /** The text column shrinks and wraps on narrow screens; brackets stay beside it. */
  readonly columns = computed(() => {
    const lanes = this.layout().laneCount;
    return lanes ? `minmax(0, max-content) repeat(${lanes}, auto)` : null;
  });
}
