import { getAllLetters } from '../data/letterCategories';

// Fixed letter sets for the research protocol.
// Order is intentional: straight → curved → mixed, easy → hard within each group.
const LC_LETTERS = ['i','l','t','o','c','s','a','k','b','h'];
const UC_LETTERS = ['I','L','T','O','C','S','A','K','B','H'];

function buildSequence(letters, caseType) {
  const all = getAllLetters(caseType);
  return letters.map(l => all.find(obj => obj.letter === l)).filter(Boolean);
}

export const DATA_COLLECTION_PROTOCOL = {
  shapes:    ['horizontal_line','vertical_line','full_circle','half_circle','zigzag','curve_wave'],
  lowercase: buildSequence(LC_LETTERS, 'lowercase'),
  uppercase: buildSequence(UC_LETTERS, 'uppercase'),
};
