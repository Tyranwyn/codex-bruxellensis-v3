import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {signal} from '@angular/core';
import {of} from 'rxjs';

import {AuthService} from '../../core/auth.service';
import {UserDataService} from '../../core/user-data.service';
import {Category} from '../models/category';
import {Song} from '../models/song';
import {SongService} from '../song.service';
import {matchesSearch, normalize, SongListComponent} from './song-list.component';

function song(overrides: Partial<Song>): Song {
  return {
    id: 'id', title: '', associationName: '', associationInfo: '', battleCryName: '', battleCryInfo: '',
    battleCry: '', bgInfo: '', category: Category.DUTCH, lyrics: '', page: 1, ...overrides
  };
}

const SONGS = [
  song({id: 'a', title: 'Brabançonne', category: Category.FRENCH, page: 90}),
  song({id: 'b', title: 'De Vlaamse Leeuw', category: Category.DUTCH, page: 91}),
  song({id: 'c', associationName: 'Antverpia', category: Category.ASSOCIATION, page: 33})
];

describe('song search', () => {
  it('normalize strips accents and case', () => {
    expect(normalize('Brabançonne É')).toBe('brabanconne e');
  });

  it('matches on page, title and association name', () => {
    expect(matchesSearch(SONGS[0], 'braban')).toBeTrue();
    expect(matchesSearch(SONGS[0], '90')).toBeTrue();
    expect(matchesSearch(SONGS[2], 'antverp')).toBeTrue();
    expect(matchesSearch(SONGS[1], 'antverp')).toBeFalse();
  });
});

describe('SongListComponent', () => {
  let fixture: ComponentFixture<SongListComponent>;
  let component: SongListComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SongListComponent],
      providers: [
        provideRouter([]),
        {provide: SongService, useValue: {all$: of(SONGS)}},
        {provide: AuthService, useValue: {uid: signal(null)}},
        {provide: UserDataService, useValue: {isAdmin: signal(false), isFavorite: () => false}}
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SongListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const ids = () => component.visibleSongs().map(s => s.id);

  it('shows all songs by default', () => {
    expect(ids()).toEqual(['a', 'b', 'c']);
  });

  it('filters by category', () => {
    fixture.componentRef.setInput('category', Category.DUTCH);
    expect(ids()).toEqual(['b']);
  });

  it('narrows and widens the search again', () => {
    component.filter.set('vlaamse');
    expect(ids()).toEqual(['b']);
    component.filter.set('');
    expect(ids()).toEqual(['a', 'b', 'c']);
  });
});
