import { INSTRUCTION_KEYS } from './childInstructions';

// One canonical key -> bundled recording map. The same keys drive the visible
// bilingual copy in childInstructions.js, so text and audio cannot drift into
// separate string-based lookup systems.
export const HANDWRITING_INSTRUCTION_AUDIO = Object.freeze({
  [INSTRUCTION_KEYS.FOLLOW_PATH]: require('../../assets/handwriting_instructions/follow_path.mp4'),
  [INSTRUCTION_KEYS.WATCH_TRACE]: require('../../assets/handwriting_instructions/watch_trace.mp4'),
  [INSTRUCTION_KEYS.FOLLOW_GUIDE]: require('../../assets/handwriting_instructions/follow_guide.mp4'),
  [INSTRUCTION_KEYS.WRITE_BY_YOURSELF]: require('../../assets/handwriting_instructions/write_by_yourself.mp4'),
  [INSTRUCTION_KEYS.CHOOSE_FIRST_LETTER]: require('../../assets/handwriting_instructions/choose_first_letter.mp4'),
  [INSTRUCTION_KEYS.CHOOSE_PICTURE]: require('../../assets/handwriting_instructions/choose_picture.mp4'),
  [INSTRUCTION_KEYS.CHOOSE_MISSING_LETTER]: require('../../assets/handwriting_instructions/choose_missing_letter.mp4'),
  [INSTRUCTION_KEYS.MAKE_WORD]: require('../../assets/handwriting_instructions/make_word.mp4'),
  [INSTRUCTION_KEYS.WRITE_WORD]: require('../../assets/handwriting_instructions/write_word.mp4'),
});

export function getHandwritingInstructionAudio(instructionKey) {
  return HANDWRITING_INSTRUCTION_AUDIO[instructionKey] ?? null;
}
