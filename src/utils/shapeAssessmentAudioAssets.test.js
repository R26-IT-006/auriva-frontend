import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('Shape Assessment audio asset resolution', () => {
  const screen = read('src/screens/handwriting/ShapeAssessmentScreen.js');

  it('has no stale shape-specific MP3 map or expo-av sound loader', () => {
    expect(screen).not.toMatch(/SHAPE_AUDIO|horizontal_line\.mp3|vertical_line\.mp3/);
    expect(screen).not.toMatch(/circle\.mp3|curved\.mp3|zig_zag\.mp3|wave\.mp3/);
    expect(screen).not.toMatch(/Audio\.Sound\.createAsync|soundRef/);
  });

  it('preserves automatic and speaker-button shape instruction speech', () => {
    expect(screen).toMatch(/Speech\.speak\(shape\.instruction,/);
    expect(screen).toMatch(/language:\s*SPEECH_LOCALE_EN/);
    expect(screen).toMatch(/setTimeout\(\(\) => \{ speakShapeInstruction\(shape\); \}, 300\)/);
    expect(screen).toMatch(/onSpeak=\{\(\) => speakShapeInstruction\(currentShape\)\}/);
  });

  it('does not mis-map shape instructions to FOLLOW_PATH', () => {
    expect(screen).not.toMatch(/FOLLOW_PATH|follow_path\.mp4|useInstructionAudio/);
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
