import {Category} from './category';

/** A song document as stored in Firestore. */
export interface SongData {
  title: string;
  associationName: string;
  associationInfo: string;
  battleCryName: string;
  battleCryInfo: string;
  battleCry: string;
  bgInfo: string;
  category: Category;
  lyrics: string;
  page: number;
  removed?: boolean;
}

export interface Song extends SongData {
  id: string;
}
