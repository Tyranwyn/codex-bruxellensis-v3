import {CapitalizePipe} from './capitalize.pipe';

describe('CapitalizePipe', () => {
  const pipe = new CapitalizePipe();

  it('capitalizes an upper-case word', () => {
    expect(pipe.transform('FRENCH')).toBe('French');
  });

  it('handles an empty string', () => {
    expect(pipe.transform('')).toBe('');
  });
});
