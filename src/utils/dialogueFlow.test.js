// The Dialogue module's "How it works" overview (data/dialogueFlow.js) must
// match the way the screens run the module.

import fs from 'fs';
import path from 'path';
import { buildDialogueFlow, PHASE1_DRAG_ACTIVITIES, L2_SENTENCES } from '../data/dialogueFlow';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

describe('Dialogue module "How it works" flow', () => {
  const flow = buildDialogueFlow();

  test('stages run in the module order: level → Phase 1 → 2 → 3 → word done → Level 2', () => {
    expect(flow.map((s) => s.key)).toEqual(
      ['choose', 'l1-category', 'phase1', 'phase2', 'phase3', 'word-done', 'level2', 'level2-done'],
    );
  });

  test('each Level 1 phase leads where the screens do', () => {
    const phase1 = read('../screens/teacher/dialogue/magic-words/Phase1CompleteScreen.js');
    expect(phase1).toContain("'Phase2Production'");
    const phase2 = read('../screens/teacher/dialogue/magic-words/Phase2ProductionScreen.js');
    expect(phase2).toContain("'Phase3Contextual'");
    expect(phase2).toContain("'Phase2NonVerbal'");
    expect(read('../screens/teacher/dialogue/magic-words/Phase3ContextualScreen.js')).toContain("'WordComplete'");
  });

  test('Phase 1 has the number of drag activities the screen defines per word', () => {
    const drag = read('../screens/teacher/dialogue/magic-words/DragToLineScreen.js');
    const thankYou = drag.slice(drag.indexOf('thank_you: ['), drag.indexOf('im_sorry: ['));
    expect((thankYou.match(/\bid:\s*\d+/g) ?? []).length).toBe(PHASE1_DRAG_ACTIVITIES);
  });

  test('Level 2 sentence count matches the session-complete copy', () => {
    expect(read('../screens/teacher/dialogue/level2/L2SessionCompleteScreen.js'))
      .toContain(`all ${L2_SENTENCES} sentences`);
  });

  test('the assessed phases explain the support given after a mistake', () => {
    for (const key of ['phase1', 'phase2', 'phase3', 'level2']) {
      expect(flow.find((s) => s.key === key).ifWrong).toEqual(expect.any(String));
    }
  });

  test('DialogueLanding opens it from an ungated "How it works" button', () => {
    const landing = read('../screens/teacher/students/DialogueLandingScreen.js');
    expect(landing).toContain('onPress={() => setShowFlow(true)}');
    expect(landing).toMatch(/visible=\{showFlow\}/);
  });
});
