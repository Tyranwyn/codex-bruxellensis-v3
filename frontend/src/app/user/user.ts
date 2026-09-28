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

export interface UserData {
  role: Role;
  /** Ids of the user's favorite songs. */
  favorites: string[];
}

/** A user-data document as stored in Firestore. */
export interface UserDataDoc {
  role: Role;
  favorites: DocumentReference[];
}
