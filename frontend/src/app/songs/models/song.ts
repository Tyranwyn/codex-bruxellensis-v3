/** A repeat marker over lines `from`..`to` (0-based, inclusive) of a stanza. */
export interface RepeatSpan {
  from: number;
  to: number;
  /** (BIS) = 2, (TER) = 3, …; absent for markers such as '(ULB)'. */
  times?: number;
  /** The marker as printed, e.g. '(BIS)'. */
  marker: string;
}

export type StanzaKind = 'verse' | 'chorus' | 'chorus-ref' | 'direction';

/** A block of lines, or a printed instruction. Mirrors `data/schema/song.schema.json`. */
export interface Stanza {
  kind: StanzaKind;
  lines?: string[];
  repeats?: RepeatSpan[];
  /** How many times the whole stanza is sung, e.g. 'Refrein (BIS)'. */
  repeat?: number;
  /** Text of a 'direction', or the extra text of a 'chorus-ref'. */
  instruction?: string;
}

export interface Pages {
  start: number;
  end: number;
}

/** A song document as stored in `<codex>/<edition>/songs`, written by `scripts/import-edition.mjs`. */
export interface SongData {
  /** Id in `data/output/json/songs.json`, e.g. 'antverpia-lied'. */
  slug: string;
  title: string;
  /** Title as in the book's index, e.g. 'SMIDJE, ’T'. */
  sortTitle?: string;
  section: string;
  language: string;
  /** Firestore id of the club, for songs in the club and official sections. */
  clubId: string | null;
  pages: Pages;
  /** Index in book order. */
  position: number;
  lyricist: string | null;
  melody: string | null;
  notes: string | null;
  stanzas: Stanza[];
  /** Printed below the lyrics, with the marker they share with a line, e.g. '* De keuze wordt …'. */
  footnotes?: string[];
}

export interface Song extends SongData {
  id: string;
}
