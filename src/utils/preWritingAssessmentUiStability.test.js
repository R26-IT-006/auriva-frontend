import fs from 'fs';
import path from 'path';

import { actionRowMinHeight } from '../constants/writingActionRow';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../constants/childInstructions';

const read = (rel) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const readCode = (rel) => stripComments(read(rel));

const PRE = '../screens/handwriting/PreWritingActivityScreen.js';
const SHAPE = '../screens/handwriting/ShapeAssessmentScreen.js';
const AVATAR = '../screens/handwriting/AttemptAvatarFeedback.js';

function styleBody(source, name) {
  const at = source.indexOf(`  ${name}: {`);
  expect(at).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf('\n  },', at));
}

describe('Pre-Writing bilingual instruction readability', () => {
  const source = readCode(PRE);
  const card = source.slice(
    source.indexOf('styles.instructionCard'),
    source.indexOf('styles.canvasArea'),
  );

  test('English and Sinhala remain separate approved text elements', () => {
    expect(card).toMatch(/<Text style=\{styles\.instructionEn\}>\{PRE_WRITING_INSTRUCTION\.en\}<\/Text>/);
    expect(card).toMatch(/<Text style=\{styles\.instructionSi\}>\{PRE_WRITING_INSTRUCTION\.si\}<\/Text>/);
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.FOLLOW_PATH]).toEqual({
      en: 'Follow the path', si: 'රේඛාව දිගේ අඳින්න',
    });
  });

  test('the text region has stable vertical room and the speaker stays separate', () => {
    expect(styleBody(source, 'instructionCard')).toMatch(/minHeight: 108/);
    expect(styleBody(source, 'instructionInner')).toMatch(/minHeight: 84/);
    expect(styleBody(source, 'instructionTexts')).toMatch(/minHeight: 76/);
    expect(styleBody(source, 'instructionTexts')).toMatch(/gap: 8/);
    expect(styleBody(source, 'instructionTexts')).toMatch(/justifyContent: 'center'/);
    expect(styleBody(source, 'instructionEn')).toMatch(/fontSize: 20[\s\S]*lineHeight: 28/);
    expect(styleBody(source, 'instructionSi')).toMatch(/fontSize: 20[\s\S]*lineHeight: 32/);
    expect(styleBody(source, 'instructionEn')).not.toMatch(/flex:/);
    expect(styleBody(source, 'instructionSi')).not.toMatch(/fontFamily:/);
    expect(card).toMatch(/<\/View>\s*<TouchableOpacity[\s\S]*styles\.speakerBtn/);
    expect(styleBody(source, 'speakerBtn')).toMatch(/width: 48[\s\S]*flexShrink: 0/);
  });

  test('the two-line block has no vertical overlay hacks or clipping constraints', () => {
    const layout = [
      styleBody(source, 'instructionCard'),
      styleBody(source, 'instructionInner'),
      styleBody(source, 'instructionTexts'),
      styleBody(source, 'instructionEn'),
      styleBody(source, 'instructionSi'),
    ].join('\n');
    expect(layout).not.toMatch(/position:\s*'absolute'|translateY|marginTop:\s*-|marginBottom:\s*-|maxHeight:|\n\s*height:/);
  });

  test('FOLLOW_PATH remains the only prerecorded instruction path', () => {
    expect(source).toMatch(/useInstructionAudio\(INSTRUCTION_KEYS\.FOLLOW_PATH/);
    expect((source.match(/useInstructionAudio\(/g) || [])).toHaveLength(1);
  });
});

describe('Pre-Writing and Shape Assessment canvas stability', () => {
  test.each([PRE, SHAPE])('%s reserves the complete 51 px action row from first render', (rel) => {
    const source = readCode(rel);
    const row = styleBody(source, 'buttonsRow');
    expect(row).toMatch(/minHeight: actionRowMinHeight\(\{/);
    expect(row).toMatch(/maxButtonPaddingVertical: 13/);
    expect(row).toMatch(/maxButtonBorderWidth: 1\.5/);
    expect(actionRowMinHeight({
      maxButtonPaddingVertical: 13,
      maxButtonBorderWidth: 1.5,
    })).toBe(51);
    expect(source).toMatch(/\{canClearCanvas && \(/);
    expect(source).not.toMatch(/opacity: canClearCanvas \? 1 : 0|placeholderBtn/);
  });

  test.each([PRE, SHAPE])('%s preserves the established coordinate mapper', (rel) => {
    const source = readCode(rel);
    expect(source).toMatch(/canvasRef\.current\?\.measure\?\.\(\(_x, _y, _w, _h, pageX, pageY\)/);
    expect(source).toMatch(/pageX: evt\.nativeEvent\.pageX, pageY: evt\.nativeEvent\.pageY/);
    expect(source).toMatch(/inset: CANVAS_BORDER_WIDTH/);
  });
});

describe('completion-only avatar feedback', () => {
  const pre = readCode(PRE);
  const shape = readCode(SHAPE);

  test('Pre-Writing has no permanent avatar and shows feedback only after Done evaluation', () => {
    expect(pre).not.toMatch(/AVATAR_MAP|styles\.avatarImage/);
    expect(pre).toMatch(/setAttemptFeedback\(\{ passed, attempt \}\)/);
    expect(pre).toMatch(/\{attemptFeedback && \([\s\S]*<AttemptAvatarFeedback/);
    expect(pre).toMatch(/note=\{attemptFeedback\.passed \? 'Great job!' : 'Try again!'\}/);
  });

  test('Shape Assessment has no permanent/custom avatar and waits for Next evaluation', () => {
    expect(shape).not.toMatch(/AVATAR_MAP|avatarImage|avatarBubble/);
    expect(shape).toMatch(/const handleNext = useCallback\(async \(\) => \{/);
    const handleNext = shape.slice(shape.indexOf('const handleNext'), shape.indexOf('// ── Render'));
    expect(handleNext.indexOf('calculateFeatures')).toBeLessThan(handleNext.indexOf('setAssessmentFeedback(true)'));
    expect(handleNext).toMatch(/setAssessmentFeedback\(true\)[\s\S]*ASSESSMENT_FEEDBACK_MS/);
    expect(shape).toMatch(/\{assessmentFeedback && \([\s\S]*<AttemptAvatarFeedback/);
    expect(shape).toMatch(/passed[\s\S]*note="Nice work!"/);
    const responder = shape.slice(shape.indexOf('PanResponder.create'), shape.indexOf('const submitAssessment'));
    expect(responder).not.toMatch(/setAssessmentFeedback/);
  });

  test('the shared feedback remains an absolute non-layout overlay', () => {
    const avatar = readCode(AVATAR);
    expect(avatar).toMatch(/overlay: \{\s*position: 'absolute'/);
    expect(avatar).toMatch(/pointerEvents="none"/);
  });
});

describe('short child feedback contract', () => {
  const avatar = readCode(AVATAR);
  const messages = [
    'Great tracing!', 'Try again!',
    'Nice work!', 'Follow the guide!',
    'Great writing!', 'Try once more!',
    'Great job!',
  ];

  test.each(messages)('%s is present and contains no more than four words', (message) => {
    expect(avatar).toContain(`'${message}'`);
    expect(message.replace(/[^A-Za-z ]/g, '').trim().split(/\s+/).length).toBeLessThanOrEqual(4);
  });

  test('assessment feedback exposes no score, severity, or threshold', () => {
    const shape = readCode(SHAPE);
    const start = shape.indexOf('{assessmentFeedback &&');
    const overlay = shape.slice(start, shape.indexOf('</SafeAreaView>', start));
    expect(overlay).toContain('Nice work!');
    expect(overlay).not.toMatch(/score|severity|threshold|Motor Score|failed/i);
  });
});
