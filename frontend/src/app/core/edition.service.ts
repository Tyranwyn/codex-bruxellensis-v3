import {computed, inject, Injectable, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {collection, CollectionReference, orderBy, query} from 'firebase/firestore';
import {collectionData} from 'rxfire/firestore';

import {environment} from '../../environment';
import {Edition} from '../songs/models/edition';
import {FIRESTORE} from './firebase';

const STORAGE_KEY = 'codex-edition';

function readStoredEdition(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** The Codex editions in Firestore, and the one the reader chose (the newest by default). */
@Injectable({providedIn: 'root'})
export class EditionService {
  private readonly codex = collection(inject(FIRESTORE), environment.databases.codex) as CollectionReference<Edition>;

  /** All editions, newest first. `undefined` while loading. */
  readonly editions = toSignal(collectionData(query(this.codex, orderBy('number', 'desc'))));

  private readonly chosen = signal(readStoredEdition());

  /** Number of the edition being read: the chosen one if it exists, else the newest. */
  readonly selected = computed(() => {
    const editions = this.editions();
    if (!editions?.length) {
      return null;
    }
    const chosen = this.chosen();
    return editions.some(edition => edition.number === chosen) ? chosen : editions[0].number;
  });
  readonly current = computed(() => this.editions()?.find(edition => edition.number === this.selected()));

  select(edition: number): void {
    this.chosen.set(edition);
    try {
      localStorage.setItem(STORAGE_KEY, String(edition));
    } catch {
      // Storage can be blocked; the choice then lasts for this session only.
    }
  }
}
