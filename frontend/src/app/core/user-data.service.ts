import {computed, inject, Injectable} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {arrayRemove, arrayUnion, collection, CollectionReference, doc, setDoc, updateDoc} from 'firebase/firestore';
import {docData} from 'rxfire/firestore';
import {Observable, of, switchMap, tap} from 'rxjs';

import {environment} from '../../environment';
import {favoriteId, Role, UserDataDoc} from '../user/user';
import {AuthService} from './auth.service';
import {FIRESTORE} from './firebase';

const DEFAULT_USER_DATA: UserDataDoc = {role: Role.USER, favorites: []};

/** Role and favorites of the signed-in user. */
@Injectable({providedIn: 'root'})
export class UserDataService {
  private readonly auth = inject(AuthService);
  private readonly userData = collection(inject(FIRESTORE), environment.databases.userData) as CollectionReference<UserDataDoc>;

  readonly data = toSignal(
    toObservable(this.auth.uid).pipe(switchMap(uid => uid ? this.watch(uid) : of(null))),
    {initialValue: null}
  );
  readonly isAdmin = computed(() => this.data()?.role === Role.ADMIN);
  /** Ids of the favorite songs. */
  readonly favorites = computed(() => new Set(this.data()?.favorites.map(favoriteId)));

  isFavorite(songId: string): boolean {
    return this.favorites().has(songId);
  }

  toggleFavorite(songId: string): Promise<void> {
    const uid = this.auth.uid();
    if (!uid) {
      return Promise.resolve();
    }
    // Removing also drops legacy document references to the same song.
    const update = this.isFavorite(songId)
      ? arrayRemove(songId, ...(this.data()?.favorites ?? []).filter(fav => typeof fav !== 'string' && fav.id === songId))
      : arrayUnion(songId);
    return updateDoc(doc(this.userData, uid), {favorites: update});
  }

  /** Streams the user's data, creating the default document on first login. */
  private watch(uid: string): Observable<UserDataDoc | undefined> {
    const ref = doc(this.userData, uid);
    return docData(ref).pipe(
      tap(data => {
        if (!data) {
          setDoc(ref, DEFAULT_USER_DATA).catch(err => console.error('Could not create user data', err));
        }
      })
    );
  }
}
