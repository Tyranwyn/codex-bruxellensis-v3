import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {signal} from '@angular/core';
import {of} from 'rxjs';

import {AuthService} from '../../core/auth.service';
import {UserDataService} from '../../core/user-data.service';
import {Club} from '../models/club';
import {Song} from '../models/song';
import {SongService} from '../song.service';
import {listItems, normalize, SongListComponent} from './song-list.component';

function song(overrides: Partial<Song>): Song {
  return {
    id: 'id', slug: 'slug', title: '', section: 'nederlandstalige-liederen', language: 'nl', clubId: null,
    pages: {start: 1, end: 1}, position: 0, lyricist: null, melody: null, notes: null, footnotes: [],
    stanzas: [{kind: 'verse', lines: ['la']}], ...overrides
  };
}

const CLUBS = new Map<string, Club>([['k', {
  id: 'k', slug: 'antverpia', name: 'ANTVERPIA', motto: null, description: null, founded: 1977,
  founders: [], colours: [], position: 0
}]]);

const SONGS = [
  song({id: 'c', title: 'ANTVERPIA LIED', clubId: 'k', section: 'kringliederen', pages: {start: 33, end: 33}}),
  song({id: 'a', title: 'LA BRABANÇONNE', section: 'officiele-liederen', pages: {start: 90, end: 90}}),
  song({id: 'b', title: 'DE VLAAMSE LEEUW', sortTitle: 'VLAAMSE LEEUW, DE', pages: {start: 91, end: 91}})
];

describe('song list items', () => {
  it('normalize strips accents and case', () => {
    expect(normalize('Brabançonne É')).toBe('brabanconne e');
  });

  it('puts each club before its first song and matches on page, title and club name', () => {
    const items = listItems(SONGS, CLUBS);
    expect(items.map(item => `${item.kind}/${item.id}`)).toEqual(['club/k', 'song/c', 'song/a', 'song/b']);
    expect(items[0].section).toBe('kringliederen');
    expect(items[1].searchText).toContain('antverpia');
    expect(items[2].searchText).toContain('brabanconne');
    expect(items[2].searchText).toContain('90');
    expect(items[3].searchText).toContain('vlaamse leeuw, de');
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
        {provide: SongService, useValue: {all$: of(SONGS), clubs$: of(CLUBS)}},
        {provide: AuthService, useValue: {uid: signal(null)}},
        {provide: UserDataService, useValue: {isFavorite: () => false}}
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(SongListComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const ids = () => component.visibleItems().map(item => item.id);

  it('shows all songs and clubs by default', () => {
    expect(ids()).toEqual(['k', 'c', 'a', 'b']);
  });

  it('filters by section', () => {
    fixture.componentRef.setInput('section', 'kringliederen');
    expect(ids()).toEqual(['k', 'c']);
  });

  it('narrows and widens the search again', () => {
    component.filter.set('vlaamse');
    expect(ids()).toEqual(['b']);
    component.filter.set('antverp');
    expect(ids()).toEqual(['k', 'c']);
    component.filter.set('');
    expect(ids()).toEqual(['k', 'c', 'a', 'b']);
  });
});
