export interface Section {
  id: string;
  title: string;
  position: number;
  startPage: number;
}

/** An edition document in the codex collection. Its id is the edition number. */
export interface Edition {
  number: number;
  year: number;
  sections: Section[];
  songCount: number;
  clubCount: number;
}

