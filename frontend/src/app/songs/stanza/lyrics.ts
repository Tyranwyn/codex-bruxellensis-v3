import {RepeatSpan, Stanza} from '../models/song';

const TIMES: Record<number, string> = {2: 'BIS', 3: 'TER', 4: 'QUATER'};

/** ' (BIS)' for 2, ' (TER)' for 3, …; '' when not repeated. */
export function timesLabel(times?: number): string {
  return times ? ` (${TIMES[times] ?? `${times}×`})` : '';
}

/** 'p. 33' or 'pp. 33–34'. */
export function pagesLabel(pages: {start: number; end: number}): string {
  return pages.start === pages.end ? `p. ${pages.start}` : `pp. ${pages.start}–${pages.end}`;
}

/** Gives each span the first lane (column) that is free over its whole range. */
export function lanes(spans: readonly RepeatSpan[]): number[] {
  const taken: [number, number][][] = [];
  return spans.map(span => {
    let lane = taken.findIndex(ranges => ranges.every(([from, to]) => span.to < from || span.from > to));
    if (lane < 0) {
      lane = taken.push([]) - 1;
    }
    taken[lane].push([span.from, span.to]);
    return lane;
  });
}

export interface LyricsLine {
  text: string;
  /** Markers of repeats over this line only, shown at its end. */
  marks: string[];
}

export interface Bracket extends RepeatSpan {
  lane: number;
}

export interface LyricsLayout {
  lines: LyricsLine[];
  /** Repeats over several lines, drawn as brackets beside them. */
  brackets: Bracket[];
  laneCount: number;
}

/** Splits a stanza's repeats into inline markers and bracket lanes, like `data/.../export_html.py`. */
export function layoutLyrics(stanza: Stanza): LyricsLayout {
  const lines: LyricsLine[] = (stanza.lines ?? []).map(text => ({text, marks: []}));
  const spans: RepeatSpan[] = [];
  for (const span of stanza.repeats ?? []) {
    if (span.from === span.to) {
      lines[span.to]?.marks.push(span.marker);
    } else {
      spans.push(span);
    }
  }
  // Shorter (inner) spans take the lanes nearest the text.
  spans.sort((a, b) => (a.to - a.from) - (b.to - b.from) || a.from - b.from);
  const spanLanes = lanes(spans);
  const brackets = spans.map((span, i) => ({...span, lane: spanLanes[i]}));
  return {lines, brackets, laneCount: brackets.length ? Math.max(...spanLanes) + 1 : 0};
}
