// The Pronunciation module's "How it works" overview (data/pronunciationFlow.js)
// must match the way the screens run the module.

import fs from 'fs';
import path from 'path';
import { buildPronunciationFlow, WEAK_SOUND_REPEATS, TAP_SOUNDS_MIN } from '../data/pronunciationFlow';

const dir = '../screens/teacher/pronunciation/';
const read = (name) => fs.readFileSync(path.resolve(__dirname, dir + name), 'utf8');

describe('Pronunciation module "How it works" flow', () => {
  const flow = buildPronunciationFlow();

  test('stages run in the module order', () => {
    expect(flow.map((s) => s.key)).toEqual(
      ['choose', 'pick', 'learn', 'tap-sounds', 'speak', 'listen-choose', 'result'],
    );
  });

  test('each step leads where the screens do', () => {
    expect(read('PronunciationSessionSetupScreen.js')).toContain('"PronunciationWordSelection"');
    expect(read('PronunciationWordSelectionScreen.js')).toContain('"PronunciationLearnWord"');
    const learn = read('PronunciationLearnWordScreen.js');
    expect(learn).toContain('"PronunciationTapSounds"');
    expect(learn).toContain('"PronunciationSpeakWord"');
    expect(read('PronunciationTapSoundsScreen.js')).toContain('"PronunciationSpeakWord"');
    const speak = read('PronunciationSpeakWordScreen.js');
    expect(speak).toContain('"PronunciationListenChoose"');
    expect(speak).toContain('"PronunciationResult"');
    expect(read('PronunciationListenChooseScreen.js')).toContain('"PronunciationResult"');
  });

  test('the Tap-the-sounds and weak-sound thresholds match the screens', () => {
    expect(read('PronunciationLearnWordScreen.js'))
      .toMatch(new RegExp(`sounds\\?\\.length \\|\\| 0\\) >= ${TAP_SOUNDS_MIN}`));
    expect(read('PronunciationSpeakWordScreen.js'))
      .toMatch(new RegExp(`recurring_weak_phoneme_count\\) >= ${WEAK_SOUND_REPEATS}`));
  });

  test('the landing screen opens it from an ungated "How it works" button', () => {
    const setup = read('PronunciationSessionSetupScreen.js');
    expect(setup).toContain('onPress={() => setShowFlow(true)}');
    expect(setup).toMatch(/visible=\{showFlow\}/);
  });
});
