import {computed, inject, Injectable} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {arrayRemove, arrayUnion, collection, CollectionReference, doc, setDoc, updateDoc} from 'firebase/firestore';
import {docData} from 'rxfire/firestore';
import {map, Observable, of, switchMap, tap} from 'rxjs';

import {environment} from '../../environments/environment';
import {SongService} from '../songs/song.service';
import {Role, UserData, UserDataDoc} from '../user/user';
import {AuthService} from './auth.service';
import {FIRESTORE} from './firebase';

const DEFAULT_USER_DATA: UserDataDoc = {role: Role.USER, favorites: []};

/** Role and favorites of the signed-in user. */
@Injectable({providedIn: 'root'})
export class UserDataService {
  private readonly auth = inject(AuthService);
  private readonly songService = inject(SongService);
  private readonly userData = collection(inject(FIRESTORE), environment.databases.userData) as CollectionReference<UserDataDoc>;

  readonly data = toSignal(
    toObservable(this.auth.uid).pipe(switchMap(uid => uid ? this.watch(uid) : of(null))),
    {initialValue: null}
  );
  readonly isAdmin = computed(() => this.data()?.role === Role.ADMIN);
  readonly favorites = computed(() => new Set(this.data()?.favorites));

  isFavorite(songId: string): boolean {
    return this.favorites().has(songId);
  }

  toggleFavorite(songId: string): Promise<void> {
    const uid = this.auth.uid();
    if (!uid) {
      return Promise.resolve();
    }
    const song = this.songService.songRef(songId);
    const update = this.isFavorite(songId) ? arrayRemove(song) : arrayUnion(song);
    return updateDoc(doc(this.userData, uid), {favorites: update});
  }

  /** Streams the user's data, creating the default document on first login. */
  private watch(uid: string): Observable<UserData | null> {
    const ref = doc(this.userData, uid);
    return docData(ref).pipe(
      tap(data => {
        if (!data) {
          setDoc(ref, DEFAULT_USER_DATA).catch(err => console.error('Could not create user data', err));
        }
      }),
      map(data => data ? {role: data.role, favorites: data.favorites.map(fav => fav.id)} : null)
    );
  }
}
