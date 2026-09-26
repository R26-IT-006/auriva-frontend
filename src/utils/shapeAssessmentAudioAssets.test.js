import fs from 'fs';
import path from 'path';
import { CHILD_INSTRUCTIONS, INSTRUCTION_KEYS } from '../constants/childInstructions';

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('Shape Assessment audio asset resolution', () => {
  const screen = read('src/screens/handwriting/ShapeAssessmentScreen.js');

  it('has no stale shape-specific MP3 map or expo-av sound loader', () => {
    expect(screen).not.toMatch(/SHAPE_AUDIO|horizontal_line\.mp3|vertical_line\.mp3/);
    expect(screen).not.toMatch(/circle\.mp3|curved\.mp3|zig_zag\.mp3|wave\.mp3/);
    expect(screen).not.toMatch(/Audio\.Sound\.createAsync|soundRef/);
  });

  it('uses the canonical FOLLOW_PATH copy for every displayed shape', () => {
    expect(CHILD_INSTRUCTIONS[INSTRUCTION_KEYS.FOLLOW_PATH]).toEqual({
      en: 'Follow the path',
      si: 'රේඛාව දිගේ අඳින්න',
    });
    expect(screen).toMatch(/const ASSESSMENT_INSTRUCTION = CHILD_INSTRUCTIONS\[INSTRUCTION_KEYS\.FOLLOW_PATH\]/);
    expect(screen).toMatch(/instruction:\s*ASSESSMENT_INSTRUCTION\.en/);
    expect(screen).toMatch(/instructionSi:\s*ASSESSMENT_INSTRUCTION\.si/);
    expect(screen).toMatch(/shape=\{displayedShape\}/);
  });

  it('autoplays and replays the same prerecorded FOLLOW_PATH asset', () => {
    expect(screen).toMatch(/useInstructionAudio\(INSTRUCTION_KEYS\.FOLLOW_PATH, \{/);
    expect(screen).toMatch(/autoPlay:\s*true/);
    expect(screen).toMatch(/autoPlayToken:\s*currentShapeIndex/);
    expect(screen).toMatch(/delayMs:\s*300/);
    expect(screen).toMatch(/onSpeak=\{replayInstruction\}/);
    expect(screen).not.toMatch(/expo-speech|Speech\.speak|SPEECH_LOCALE_EN/);
  });

  it('removes all six shape-specific instructions from the assessment UI path', () => {
    for (const oldInstruction of [
      'Trace left to right',
      'Trace top to bottom',
      'Trace the circle',
      'Trace the curve',
      'Trace the zigzag',
      'Trace the wave',
    ]) {
      expect(screen).not.toContain(oldInstruction);
    }
    expect((screen.match(/pageLabel: 'Assessment \d of 6'/g) ?? [])).toHaveLength(6);
  });

  it('keeps English and Sinhala in separate readable text elements', () => {
    const stage = read('src/components/handwriting/ShapeAssessmentStage.js');
    expect(stage).toContain('<Text style={styles.instructionEn}>{shape.instruction}</Text>');
    expect(stage).toContain('<Text style={styles.instructionSi}>{shape.instructionSi}</Text>');
  });

  it('leaves scoring, shape order and completion navigation wired as before', () => {
    for (const shapeId of [
      'horizontal_line', 'vertical_line', 'full_circle',
      'half_circle', 'zigzag', 'curve_wave',
    ]) {
      expect(screen).toContain(`id: '${shapeId}'`);
    }
    expect(screen).toContain('computeUnifiedShapeScore(dtw_distance, smoothness)');
    expect(screen).toContain('features:  calculateFeatures(allPathsRef.current, shapeId)');
    expect(screen).toContain('setCurrentShapeIndex(idx + 1)');
    expect(screen).toContain("navigation.navigate('AssessmentComplete'");
  });
});

describe('canonical fixed instruction recordings', () => {
  const map = read('src/constants/handwritingInstructionAudio.js');
  const files = [
    'follow_path.mp4',
    'watch_trace.mp4',
    'follow_guide.mp4',
    'write_by_yourself.mp4',
    'choose_first_letter.mp4',
    'choose_picture.mp4',
    'choose_missing_letter.mp4',
    'make_word.mp4',
    'write_word.mp4',
  ];

  it.each(files)('%s is mapped and physically present', (file) => {
    expect(map).toContain(`/handwriting_instructions/${file}`);
    expect(fs.existsSync(path.join(ROOT, 'assets/handwriting_instructions', file))).toBe(true);
  });
});
