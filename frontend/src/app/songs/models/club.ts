/** A club document as stored in `<codex>/<edition>/clubs`. Mirrors `data/schema/club.schema.json`. */
export interface ClubData {
  slug: string;
  name: string;
  motto: string | null;
  description: string | null;
  founded: number | null;
  founders: string[];
  colours: string[];
  position: number;
}

export interface Club extends ClubData {
  id: string;
}
