/**
 * pronunciationFlow.js
 *
 * What happens in the Pronunciation module, as data — rendered by the shared
 * FlowOverviewModal ("How it works") on PronunciationSessionSetupScreen, where
 * the child chooses Alphabet or Words. Traced from the screens:
 *
 *   PronunciationSessionSetup    Alphabet, or Words → pick a category
 *   PronunciationWordSelection   pick a letter tile / word picture
 *   PronunciationLearnWord       picture, word, Sinhala meaning, Hear Sounds
 *   PronunciationTapSounds       words with 2+ sounds and a reference clip:
 *                                tap the sounds in the order heard
 *   PronunciationSpeakWord       record the word; it is scored
 *     → PronunciationListenChoose  (words) "Tap the picture you hear"; when the
 *                                  same sound was weakest on 2+ attempts the
 *                                  round targets that sound
 *   PronunciationResult          feedback, sound to practise, Try Again, and a
 *                                "For the teacher" panel (completed / flagged
 *                                for teacher review)
 *
 * Pure data; if the flow in the screens changes, change it here too.
 */

export const WEAK_SOUND_REPEATS = 2;   // SpeakWord: recurring_weak_phoneme_count >= 2
export const TAP_SOUNDS_MIN = 2;       // LearnWord: sounds.length >= 2 → Tap the Sounds

export function buildPronunciationFlow() {
  return [
    {
      key: 'choose',
      kind: 'start',
      icon: 'options',
      title: 'Choose Alphabet or Words',
      subtitle: 'This screen',
      childDoes: 'Alphabet practises letter names one by one. Words practises whole words, picked from a category.',
    },
    {
      key: 'pick',
      kind: 'start',
      icon: 'grid',
      title: 'Pick a letter or word',
      subtitle: 'Letter tiles or word pictures',
      childDoes: 'Taps a letter tile or a word picture to start practising it.',
    },
    {
      key: 'learn',
      kind: 'tier',
      tag: 'Step 1',
      icon: 'ear',
      title: 'Listen & learn',
      subtitle: 'Hear it before saying it',
      steps: ['See the picture', 'Hear the sounds', 'Sinhala meaning'],
      childDoes: 'Sees the picture and the word (with its Sinhala meaning) and taps Hear Sounds to listen to it.',
    },
    {
      key: 'tap-sounds',
      kind: 'tier',
      tag: 'Step 2',
      icon: 'apps',
      title: 'Tap the sounds',
      subtitle: `Words with ${TAP_SOUNDS_MIN} or more sounds`,
      steps: ['Listen', 'Tap the sounds in order'],
      childDoes: 'Taps the word\'s sounds in the order they were heard, to notice each part of the word.',
      note: 'Skipped in Alphabet mode and for one-sound words.',
    },
    {
      key: 'speak',
      kind: 'tier',
      tag: 'Step 3',
      icon: 'mic',
      title: 'Say it',
      subtitle: 'Recorded and scored',
      steps: ['Record', 'Scored'],
      childDoes: 'Taps Record and says the word. The recording is scored for how close it is to the target.',
      ifWrong: 'If the recording is unclear or sounds like a different word, the child is asked to try again.',
    },
    {
      key: 'listen-choose',
      kind: 'tier',
      tag: 'Step 4',
      icon: 'images',
      title: 'Listen & choose',
      subtitle: 'Words mode',
      steps: ['Hear the word', 'Tap the matching picture'],
      childDoes: 'Hears a word and taps the picture that matches it.',
      ifWrong: `If the same sound has been the weakest on ${WEAK_SOUND_REPEATS} or more attempts, this round focuses on that sound before the next speaking attempt.`,
    },
    {
      key: 'result',
      kind: 'milestone',
      icon: 'star',
      title: 'Result',
      subtitle: 'Feedback and what to practise',
      childDoes: 'Shows how it went and the sound to practise, with Try Again. The "For the teacher" panel shows whether the attempt is completed or flagged for teacher review.',
    },
  ];
}
