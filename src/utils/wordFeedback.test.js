import { childFeedbackMessage } from './wordFeedback';

describe('childFeedbackMessage', () => {
  test('size renders a size-specific message', () => {
    expect(childFeedbackMessage('size')).toBe('Keep letters the same size');
  });

  test('spacing renders a spacing-specific message', () => {
    expect(childFeedbackMessage('spacing')).toBe('Keep even spaces');
  });

  test('both renders one concise combined message, not two separate ones', () => {
    const message = childFeedbackMessage('both');
    expect(message).toBe('Keep even sizes and spaces');
    expect(message.split('.').filter(Boolean).length).toBe(1);
  });

  // The detector scores spacing through Math.abs(meanGapRatio - 1), so letters
  // bunched together and letters spread apart score identically, and the sign
  // never leaves wordLayoutService.js. Wording that picks a direction would be
  // guessing at the child's actual problem.
  test('spacing wording claims no direction the detector cannot supply', () => {
    for (const feedback of ['size', 'spacing', 'both']) {
      const message = childFeedbackMessage(feedback).toLowerCase();
      for (const directional of ['closer', 'further', 'apart', 'wider', 'narrower',
                                 'a little space', 'too close', 'too far']) {
        expect(message).not.toContain(directional);
      }
    }
  });

  // Short imperative phrases, like the Letter Writing avatar's own copy.
  test('every message is short and stays in the avatar register', () => {
    for (const feedback of ['size', 'spacing', 'both']) {
      const message = childFeedbackMessage(feedback);
      expect(message.split(/\s+/).length).toBeLessThanOrEqual(5);
      expect(message).not.toMatch(/^Try to /);
      expect(message).not.toMatch(/[.]$/);
    }
  });

  // English only for this feedback — no Sinhala line, by requirement.
  test('carries no Sinhala', () => {
    for (const feedback of ['size', 'spacing', 'both']) {
      expect(childFeedbackMessage(feedback)).not.toMatch(/[඀-෿]/);
    }
  });

  test('null renders no advisory', () => {
    expect(childFeedbackMessage(null)).toBeNull();
  });

  test('an unrecognized value renders no advisory rather than guessing', () => {
    expect(childFeedbackMessage(undefined)).toBeNull();
    expect(childFeedbackMessage('unexpected')).toBeNull();
  });

  test('wording avoids judgemental/clinical language', () => {
    const banned = ['wrong', 'bad', 'poor', 'motor', 'severity', 'fail', 'impair'];
    for (const feedback of ['size', 'spacing', 'both']) {
      const message = childFeedbackMessage(feedback).toLowerCase();
      banned.forEach(word => expect(message).not.toContain(word));
    }
  });

  // Purity — this task's section 5 requires child_feedback to never affect
  // score/passed. childFeedbackMessage takes ONLY the advisory string and
  // returns text; it has no access to (and therefore cannot read or alter)
  // score/passed/completion_passed at all, by construction.
  test('is a pure function of the advisory value alone (no side effects, no other inputs)', () => {
    expect(childFeedbackMessage.length).toBe(1);
    const before = childFeedbackMessage('size');
    const after = childFeedbackMessage('size');
    expect(before).toBe(after);
  });
});
