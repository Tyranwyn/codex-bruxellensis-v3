import {DocumentReference} from 'firebase/firestore';

import {favoriteId} from './user';

describe('favoriteId', () => {
  it('reads song ids and legacy document references', () => {
    expect(favoriteId('emAKYQi9Qjkus6gFXHjB')).toBe('emAKYQi9Qjkus6gFXHjB');
    expect(favoriteId({id: 'emAKYQi9Qjkus6gFXHjB'} as DocumentReference)).toBe('emAKYQi9Qjkus6gFXHjB');
  });
});
