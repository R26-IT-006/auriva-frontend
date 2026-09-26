import { shuffleSameOptions, shuffleAvailableTiles, ANSWER_FEEDBACK_COLORS }
  from '../components/word/wordAnswerFeedback';

describe('word-practice answer feedback helpers', () => {
  it('reorders the exact same option set even when random would preserve the order', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const shuffled = shuffleSameOptions(options, () => 0.999999);
    expect(shuffled).not.toEqual(options);
    expect(new Set(shuffled)).toEqual(new Set(options));
    expect(options.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps used tile positions fixed and only rearranges available candidates', () => {
    const order = [0, 1, 2, 3, 4];
    const used = [false, true, false, true, false];
    const shuffled = shuffleAvailableTiles(order, used, () => 0.999999);
    expect(shuffled[1]).toBe(1);
    expect(shuffled[3]).toBe(3);
    expect(new Set(shuffled)).toEqual(new Set(order));
    expect(shuffled).not.toEqual(order);
  });

  it('uses calm, readable verdict tokens without geometry', () => {
    expect(ANSWER_FEEDBACK_COLORS).toEqual(expect.objectContaining({
      wrongSurface: '#FDECEC', wrongBorder: '#D64545', wrongText: '#8B1E1E',
      correctSurface: '#E8F5E9', correctBorder: '#388E3C', correctText: '#1B5E20',
    }));
    for (const dimension of ['width', 'height', 'padding', 'margin', 'borderWidth']) {
      expect(ANSWER_FEEDBACK_COLORS).not.toHaveProperty(dimension);
    }
  });
});
