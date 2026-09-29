import {titleCase} from './title-case';

describe('titleCase', () => {
  it('lowercases articles and prepositions after the first word', () => {
    expect(titleCase('LA BALLADE DES BRAVES GUEUX')).toBe('La Ballade des Braves Gueux');
    expect(titleCase('HET LIED VAN HERTOG JAN')).toBe('Het Lied van Hertog Jan');
    expect(titleCase('THE BALL OF KERRYMUIR')).toBe('The Ball of Kerrymuir');
  });

  it('keeps acronyms in capitals', () => {
    expect(titleCase('VRG-LIED')).toBe('VRG-Lied');
    expect(titleCase('CRI DE GUERRE DU CP')).toBe('Cri de Guerre du CP');
  });

  it('handles elisions and accents', () => {
    expect(titleCase('’T SMIDJE')).toBe('’t Smidje');
    expect(titleCase('L’HOMME AU PUISSANT BRAQUEMART')).toBe('L’homme au Puissant Braquemart');
    expect(titleCase('À FOND LIÈGEOIS')).toBe('À Fond Liègeois');
    expect(titleCase('AU TRENTE ET UN DU MOIS D’AOÛT')).toBe('Au Trente et un du Mois d’août');
    expect(titleCase('COMMIN@-KREET')).toBe('Commin@-Kreet');
  });
});
