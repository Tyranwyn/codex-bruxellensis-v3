import {EnvironmentProviders, InjectionToken, makeEnvironmentProviders} from '@angular/core';
import {FirebaseApp, initializeApp} from 'firebase/app';
import {Auth, getAuth} from 'firebase/auth';
import {Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager} from 'firebase/firestore';

import {firebaseConfig} from '../firebase-config';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FirebaseApp');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FirebaseAuth');
export const FIRESTORE = new InjectionToken<Firestore>('Firestore');

/** Firebase app, Auth and Firestore (with an offline cache shared across tabs). */
export function provideFirebase(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {provide: FIREBASE_APP, useFactory: () => initializeApp(firebaseConfig)},
    {provide: FIREBASE_AUTH, useFactory: (app: FirebaseApp) => getAuth(app), deps: [FIREBASE_APP]},
    {
      provide: FIRESTORE,
      useFactory: (app: FirebaseApp) => initializeFirestore(app, {
        localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
      }),
      deps: [FIREBASE_APP]
    }
  ]);
}
