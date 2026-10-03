import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js'),
  'utf8',
);

describe('LetterHome dashboard presentation', () => {
  test('shows no avatar — the side-column, Learning Path and summary-banner avatars were all removed', () => {
    expect(source).not.toContain('assets/handwriting-avatars/');
    expect(source).not.toMatch(/AVATAR_MAP|avatarSource/);
  });

  test('shows one consistent 52-letter count and percentage', () => {
    expect(source).toContain('Math.max(0, lowercaseProgress) + Math.max(0, uppercaseProgress)');
    expect(source).toContain('(completedLetterCount / 52) * 100');
    expect(source).toContain('{completedLetterCount} / 52 done');
    expect(source).toContain('{completedLetterCount} of 52 letters done');
    expect(source).not.toMatch(/\{lowercaseProgress\}\s*(?:\/|of)\s*26/);
  });

  test('uses the same plain card frame for Letters and Words — no landscape band', () => {
    expect(source).toContain('style={[styles.learningModeCard, styles.lettersCard]}');
    expect(source).toContain('style={[styles.learningModeCard, styles.wordsCard]}');
    // The decorative green / purple hills along the bottom were removed by request.
    expect(source).not.toMatch(/CardLandscape|cardLandscapeBand/);
  });

  test('presents Words as open — no padlock, no unlock caption', () => {
    expect(source).not.toContain('Complete all 52 letters to unlock words');
    expect(source).not.toContain('lock-closed');
    expect(source).toContain('Ready to practise words');
    expect(source).toContain('Words are unlocked');
  });

  test('top controls keep only the gated Assessment action — no Writing Check, Dashboard or Report', () => {
    expect(source).toContain("requestGatedAction('assessment')");
    for (const removed of ['dashboard', 'progress']) {
      expect(source).not.toContain(`requestGatedAction('${removed}')`);
    }
    expect(source).not.toMatch(/>Dashboard</);
    expect(source).not.toMatch(/>Report</);
  });

  test('the Progress button opens the child-facing progress pop-up, ungated', () => {
    expect(source).toContain('onPress={() => setShowProgress(true)}');
    expect(source).toMatch(/visible=\{showProgress\}/);

    const topControls = source.slice(
      source.indexOf('<View style={styles.topBtnGroup}>'),
      source.indexOf('</View>', source.indexOf('<View style={styles.topBtnGroup}>')),
    );
    expect(topControls).not.toContain("requestGatedAction('writingCheck')");
    expect(topControls).not.toContain('Writing Check');
  });
});
