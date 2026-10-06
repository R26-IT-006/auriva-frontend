import { MAX_CYCLES_PER_LETTER_PER_DATE } from '../utils/letterCycleGuard';

/**
 * handwritingFlow.js
 *
 * What happens in the Writing module, as data — rendered by the shared
 * FlowOverviewModal ("How it works") on LetterHomeScreen, where the child
 * chooses Letters or Words. Traced from the screens:
 *
 *   WelcomeScreen         first visit only: press-and-drag → Instructions →
 *                         StudentWelcome → ShapeAssessment → AssessmentComplete;
 *                         once the assessment is complete it goes straight to
 *                         LetterHome
 *   LetterHome            Letters card → LetterPractice; Words card → WordLetterSelect
 *   LetterPractice        lowercase, or uppercase once all 26 lowercase are done
 *   LetterWriting /       3 attempts per round; guidance adapts to the child;
 *   UppercaseWriting      a warm-up (PreWritingActivity) when the next letter
 *                         starts a new stroke group; after 2 unsuccessful rounds
 *                         a short warm-up built from that letter's strokes, then
 *                         a last round; after MAX_CYCLES rounds the letter is
 *                         set aside for the day (not marked learnt)
 *   WordLetterSelect →    WordWriting → WordPractice (activities A–E) → result card
 *
 * Pure data; if the flow in the screens changes, change it here too.
 */

export const LETTER_ATTEMPTS_PER_ROUND = 3;   // LetterWritingScreen: isLastAttempt = attempt === 3
export const LOWERCASE_LETTERS = 26;          // LetterPracticeScreen: lowercaseDone = lowercaseProgress >= 26

export function buildHandwritingFlow(maxRounds = MAX_CYCLES_PER_LETTER_PER_DATE) {
  return [
    {
      key: 'assessment',
      kind: 'start',
      icon: 'clipboard',
      title: 'First visit: starting assessment',
      subtitle: 'Happens once, before practice begins',
      steps: ['Press & drag warm-up', 'Teacher instructions', 'Draw the shapes', 'Assessment summary'],
      childDoes: 'Warms up, then draws a set of basic shapes. This gives the starting point for practice. After it is done, the module opens straight on this screen.',
    },
    {
      key: 'choose',
      kind: 'start',
      icon: 'grid',
      title: 'Choose Letters or Words',
      subtitle: 'This screen',
      childDoes: 'Taps Letters to practise single letters, or Words to practise whole words.',
    },
    {
      key: 'lowercase',
      kind: 'tier',
      tag: 'Letters',
      icon: 'text',
      title: 'Lowercase letters',
      subtitle: 'a – z, grouped by the kind of strokes they use',
      steps: ['Look at the letter', 'Write it on the guide', 'Get feedback'],
      childDoes: `Writes each letter on the canvas, up to ${LETTER_ATTEMPTS_PER_ROUND} attempts in a round. The guide gives more or less help depending on how the child is doing. A short warm-up activity comes before a new group of strokes (e.g. straight to curved letters).`,
      ifWrong: `After 2 unsuccessful rounds, a short warm-up built from that letter's own strokes, then one more round. After ${maxRounds} rounds the letter is set aside for today (not marked as learnt) and comes back on another day.`,
    },
    {
      key: 'uppercase',
      kind: 'tier',
      tag: 'Letters',
      icon: 'text-outline',
      title: 'Uppercase letters',
      subtitle: `Opens after all ${LOWERCASE_LETTERS} lowercase letters are learnt`,
      steps: ['Look at the letter', 'Write it on the guide', 'Get feedback'],
      childDoes: 'Same way of practising as lowercase, for A – Z.',
      ifWrong: 'Same support as lowercase: a warm-up after repeated unsuccessful rounds, and the letter is set aside for the day if it is still hard.',
    },
    {
      key: 'words',
      kind: 'tier',
      tag: 'Words',
      icon: 'book',
      title: 'Words',
      subtitle: 'Open from the start',
      steps: ['Choose a letter', 'Write the word', 'Activities A – E', 'Result'],
      childDoes: 'Picks a letter, writes a word that starts with it (with its picture), then does five activities: A write the first letter, B circle the picture, C fill the blank, D spell the word, E write the word.',
      ifWrong: 'Hints are given so the child can still finish. The result card shows a star for each activity done on their own.',
    },
    {
      key: 'progress',
      kind: 'milestone',
      icon: 'trophy',
      title: 'Track progress',
      subtitle: 'Progress, Assessment and Word Progress',
      childDoes: 'Progress (on this screen and the Letter Practice screen) shows letters learnt and what is next. Assessment (needs the grown-up code) shows the shape assessment summary. Word Progress shows each word\'s activity results.',
    },
  ];
}
