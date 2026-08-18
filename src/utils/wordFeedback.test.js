import { childFeedbackMessage } from './wordFeedback';

describe('childFeedbackMessage', () => {
  test('size renders a size-specific message', () => {
    expect(childFeedbackMessage('size')).toBe('Try to keep your letters a similar size.');
  });

  test('spacing renders a spacing-specific message', () => {
    expect(childFeedbackMessage('spacing')).toBe('Try to leave even spaces between letters.');
  });

  test('both renders one concise combined message, not two separate ones', () => {
    const message = childFeedbackMessage('both');
    expect(message).toBe('Try to keep your letters a similar size and leave even spaces.');
    expect(message.split('.').filter(Boolean).length).toBe(1);
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
