import {inject, Injectable} from '@angular/core';
import {
  addDoc,
  collection,
  CollectionReference,
  deleteDoc,
  doc,
  DocumentReference,
  orderBy,
  query,
  updateDoc
} from 'firebase/firestore';
import {collectionData, docData} from 'rxfire/firestore';
import {Observable} from 'rxjs';

import {FIRESTORE} from '../core/firebase';
import {environment} from '../../environment';
import {Song, SongData} from './models/song';

@Injectable({providedIn: 'root'})
export class SongService {
  private readonly songs = collection(inject(FIRESTORE), environment.databases.songs) as CollectionReference<SongData>;

  /** All songs in book order, live. */
  readonly all$ = collectionData(query(this.songs, orderBy('page')), {idField: 'id' as keyof SongData}) as Observable<Song[]>;

  song$(id: string): Observable<Song | undefined> {
    return docData(this.songRef(id), {idField: 'id' as keyof SongData}) as Observable<Song | undefined>;
  }

  songRef(id: string): DocumentReference<SongData> {
    return doc(this.songs, id);
  }

  async add(song: SongData): Promise<void> {
    await addDoc(this.songs, song);
  }

  update(id: string, song: Partial<SongData>): Promise<void> {
    return updateDoc(this.songRef(id), song);
  }

  delete(id: string): Promise<void> {
    return deleteDoc(this.songRef(id));
  }
}
