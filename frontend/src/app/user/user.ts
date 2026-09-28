import {DocumentReference} from 'firebase/firestore';

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
}

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

/**
 * A user-data document as stored in Firestore. Favorites are song ids, which are the same in every edition.
 * Favorites saved by older versions of the app are references to documents in the old songs collection.
 */
export interface UserDataDoc {
  role: Role;
  favorites: (string | DocumentReference)[];
}

export function favoriteId(favorite: string | DocumentReference): string {
  return typeof favorite === 'string' ? favorite : favorite.id;
}
