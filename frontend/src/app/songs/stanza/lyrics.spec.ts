import {lanes, layoutLyrics, pagesLabel, timesLabel} from './lyrics';

describe('lyrics layout', () => {
  it('labels repeats and pages', () => {
    expect(timesLabel(2)).toBe(' (BIS)');
    expect(timesLabel(5)).toBe(' (5×)');
    expect(timesLabel()).toBe('');
    expect(pagesLabel({start: 33, end: 33})).toBe('p. 33');
    expect(pagesLabel({start: 33, end: 34})).toBe('pp. 33–34');
  });

  it('puts overlapping spans in separate lanes and reuses free ones', () => {
    expect(lanes([
      {from: 0, to: 1, marker: '(BIS)'},
      {from: 2, to: 3, marker: '(BIS)'},
      {from: 0, to: 3, marker: '(BIS)'}
    ])).toEqual([0, 0, 1]);
  });

  it('keeps one-line repeats inline and brackets the rest, inner spans first', () => {
    const layout = layoutLyrics({
      kind: 'verse',
      lines: ['a', 'b', 'c'],
      repeats: [
        {from: 0, to: 2, times: 2, marker: '(BIS)'},
        {from: 1, to: 2, times: 3, marker: '(TER)'},
        {from: 0, to: 0, times: 2, marker: '(BIS)'}
      ]
    });
    expect(layout.lines.map(line => line.marks)).toEqual([['(BIS)'], [], []]);
    expect(layout.brackets.map(b => [b.marker, b.lane])).toEqual([['(TER)', 0], ['(BIS)', 1]]);
    expect(layout.laneCount).toBe(2);
  });
});
