import {Pipe, PipeTransform} from '@angular/core';

/** Articles and prepositions that stay lowercase inside a title; an elided "d’" or "l’" does too. */
const SMALL_WORDS = new Set([
  'de', 'het', 'een', 'en', 'van', 'in', 'op', 'te', 'met', 'aan', 'voor', 'naar', 'der', 'den',
  'la', 'le', 'les', 'l', 'd', 'du', 'des', 'et', 'à', 'a', 'del', 'au', 'aux', 'un', 'une', 'pour', 'par', 'sur',
  'die', 'das', 'dem', 'und', 'im', 'auf', 'von', 'ein', 'eine',
  'the', 'of', 'and', 'on', 'to', 'with', 'for'
]);

const LETTER = /\p{L}/u;
const VOWEL = /[aeiouyàâäéèêëïîôöùûü]/i;

/**
 * Turns a title printed in capitals ("LA BALLADE DES BRAVES GUEUX") into title case ("La Ballade des Braves Gueux").
 * Words without a vowel ("KBS", "VRG-LIED") are taken for acronyms and stay in capitals; an elided "’T" becomes "’t".
 */
export function titleCase(text: string): string {
  let first = true;
  return text.replace(/[\p{L}@’']+/gu, word => {
    const letters = word.replace(/[^\p{L}]/gu, '');
    const isFirst = first;
    first = false;
    if (letters.length > 1 && !VOWEL.test(letters)) {
      return word;
    }
    const lower = word.toLowerCase();
    if (!isFirst && (SMALL_WORDS.has(lower.replace(/[’']$/, '')) || /^[dl][’']/.test(lower))) {
      return lower;
    }
    // Only the first character is raised, so "L’HOMME" becomes "L’homme" and "’T" stays "’t".
    return LETTER.test(lower[0]) ? lower[0].toUpperCase() + lower.slice(1) : lower;
  });
}

/** `titleCase` as a pipe; named apart from Angular's own `titlecase`. */
@Pipe({name: 'songTitle'})
export class SongTitlePipe implements PipeTransform {
  transform(text: string): string {
    return titleCase(text);
  }
}
