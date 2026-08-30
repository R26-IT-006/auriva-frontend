import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js'),
  'utf8',
);

describe('LetterHome dashboard presentation', () => {
  test('uses the selected handwriting avatar with Lily as the display fallback', () => {
    for (const name of ['Boba', 'Glitter', 'Lily', 'Megatron']) {
      expect(source).toContain(`assets/handwriting-avatars/${name}.png`);
    }
    expect(source).toContain('const avatarSource = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;');
    expect(source.match(/source=\{avatarSource\}/g)).toHaveLength(3);
  });

  test('shows one consistent 52-letter count and percentage', () => {
    expect(source).toContain('Math.max(0, lowercaseProgress) + Math.max(0, uppercaseProgress)');
    expect(source).toContain('(completedLetterCount / 52) * 100');
    expect(source).toContain('{completedLetterCount} / 52 done');
    expect(source).toContain('{completedLetterCount} of 52 letters done');
    expect(source).not.toMatch(/\{lowercaseProgress\}\s*(?:\/|of)\s*26/);
  });

  test('uses the same card frame and edge-to-edge landscape band for Letters and Words', () => {
    expect(source).toContain('style={[styles.learningModeCard, styles.lettersCard]}');
    expect(source).toContain('style={[styles.learningModeCard, styles.wordsCard, wordsPreview && styles.previewCard]}');
    const band = source.slice(source.indexOf('  cardLandscapeBand: {'), source.indexOf('  modeIconCircle: {'));
    expect(band).toMatch(/left:\s*0/);
    expect(band).toMatch(/right:\s*0/);
    expect(band).toMatch(/bottom:\s*0/);
  });

  test('keeps Words visibly locked until the existing real gate is earned', () => {
    expect(source).toContain('Complete all 52 letters to unlock words');
    expect(source).toContain("name={wordsUnlocked ? 'book-outline' : 'lock-closed'}");
    expect(source).toContain('<CardLandscape variant="words" locked={!wordsUnlocked} />');
    expect(source).toContain('const wordsUnlocked   = isWordsUnlocked(lowercaseProgress, uppercaseProgress);');
  });

  test('top controls retain their remaining gated actions without Writing Check', () => {
    expect(source).toContain('accessibilityState={{ selected: true }}');
    for (const action of ['dashboard', 'assessment', 'progress']) {
      expect(source).toContain(`requestGatedAction('${action}')`);
    }

    const topControls = source.slice(
      source.indexOf('<View style={styles.topBtnGroup}>'),
      source.indexOf('</View>', source.indexOf('<View style={styles.topBtnGroup}>')),
    );
    expect(topControls).not.toContain("requestGatedAction('writingCheck')");
    expect(topControls).not.toContain('Writing Check');
  });
});
