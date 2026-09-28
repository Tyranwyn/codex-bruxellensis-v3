import {inject, Injectable} from '@angular/core';
import {toObservable} from '@angular/core/rxjs-interop';
import {collection, CollectionReference, doc, DocumentReference, orderBy, query} from 'firebase/firestore';
import {collectionData, docData} from 'rxfire/firestore';
import {distinctUntilChanged, filter, map, Observable, shareReplay, switchMap} from 'rxjs';

import {EditionService} from '../core/edition.service';
import {FIRESTORE} from '../core/firebase';
import {environment} from '../../environment';
import {Club, ClubData} from './models/club';
import {Song, SongData} from './models/song';

/** Songs and clubs of the selected edition, live: `<codex>/<edition>/{songs,clubs}`. */
@Injectable({providedIn: 'root'})
export class SongService {
  private readonly codex = collection(inject(FIRESTORE), environment.databases.codex);

  private readonly edition$: Observable<DocumentReference> = toObservable(inject(EditionService).selected).pipe(
    filter((edition): edition is number => edition !== null),
    distinctUntilChanged(),
    map(edition => doc(this.codex, String(edition))),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /** All songs of the edition in book order. */
  readonly all$ = this.edition$.pipe(
    switchMap(edition => collectionData(query(this.songs(edition), orderBy('position')), {idField: 'id' as keyof SongData}) as Observable<Song[]>),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /** All clubs of the edition by id. */
  readonly clubs$ = this.edition$.pipe(
    switchMap(edition => collectionData(this.clubs(edition), {idField: 'id' as keyof ClubData}) as Observable<Club[]>),
    map(clubs => new Map(clubs.map(club => [club.id, club]))),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /** A song, or `undefined` when it is not in this edition. */
  song$(id: string): Observable<Song | undefined> {
    return this.edition$.pipe(
      switchMap(edition => docData(doc(this.songs(edition), id), {idField: 'id' as keyof SongData}) as Observable<Song | undefined>)
    );
  }

  /** A club, or `undefined` when it is not in this edition. */
  club$(id: string): Observable<Club | undefined> {
    return this.edition$.pipe(
      switchMap(edition => docData(doc(this.clubs(edition), id), {idField: 'id' as keyof ClubData}) as Observable<Club | undefined>)
    );
  }

  private songs(edition: DocumentReference): CollectionReference<SongData> {
    return collection(edition, 'songs') as CollectionReference<SongData>;
  }

  private clubs(edition: DocumentReference): CollectionReference<ClubData> {
    return collection(edition, 'clubs') as CollectionReference<ClubData>;
  }
}
