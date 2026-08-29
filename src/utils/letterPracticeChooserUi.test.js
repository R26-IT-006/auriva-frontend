import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterPracticeScreen.js'),
  'utf8',
);
const chooserReference = fs.readFileSync(
  path.resolve(__dirname, '../screens/handwriting/LetterHomeScreen.js'),
  'utf8',
);

describe('Letter Practice chooser UI cleanup', () => {
  it('keeps the student text header without the small header avatar', () => {
    expect(source).toMatch(/\{student\?\.full_name\}/);
    expect(source).toMatch(/Letter Practice/);
    expect(source).not.toMatch(/avatarRing|avatarImg/);
  });

  it('restores the original child progress action under its specific label', () => {
    expect(source).toMatch(/View Letter Progress/);
    expect(source).not.toMatch(/View Progress Report/);
    const call = source.slice(source.indexOf("navigation.navigate('ProgressReport'"), source.indexOf("navigation.navigate('ProgressReport'") + 400);
    expect(call).toMatch(/student,/);
    expect(call).toMatch(/theme,/);
    expect(call).toMatch(/lowercaseProgress,/);
    expect(call).toMatch(/uppercaseProgress,/);
    expect(call).toMatch(/letterSequence,/);
    expect(call).toMatch(/originRoute: 'LetterPractice'/);
  });

  it('keeps the approved heading and authoritative progress calculations', () => {
    expect(source).toMatch(/Choose your practice!/);
    expect(source).toMatch(/What would you like to write today\?/);
    expect(source).toMatch(/Lowercase: \{lowercaseProgress\} \/ 26 completed/);
    expect(source).toMatch(/Uppercase: \{uppercaseProgress\} \/ 26 completed/);
    expect(source).toMatch(/Math\.round\(\(lowercaseProgress \/ 26\) \* 100\)/);
    expect(source).toMatch(/Math\.round\(\(uppercaseProgress \/ 26\) \* 100\)/);
    expect(source.match(/<View style=\{styles\.progressTrack\}>/g)).toHaveLength(2);
  });

  it('keeps lowercase navigation and uppercase gating unchanged', () => {
    expect(source).toMatch(/goToLetterScreen\('lowercase'/);
    expect(source).toMatch(/const lowercaseDone\s+= lowercaseProgress >= 26;/);
    expect(source).toMatch(/const uppercaseOpen\s+= canOpen\(lowercaseDone\);/);
    expect(source).toMatch(/onPress=\{\(\) => uppercaseOpen && goToLetterScreen\('uppercase'/);
  });

  it('stays landscape and does not introduce scrolling', () => {
    expect(source).toMatch(/useLockLandscape\(\);/);
    expect(source).not.toMatch(/<ScrollView|\bScrollView\b/);
  });

  it('uses the Letter/Word chooser avatar source and exact rendered region', () => {
    const hero = source.slice(source.indexOf('<View style={styles.heroSection}>'), source.indexOf('{/* ── Card ── */}'));
    expect(hero.indexOf('heroTextBlock')).toBeLessThan(hero.indexOf('heroAvatar'));
    for (const name of ['Boba', 'Glitter', 'Lily', 'Megatron']) {
      expect(source).toContain(`assets/handwriting-avatars/${name}.png`);
      expect(chooserReference).toContain(`assets/handwriting-avatars/${name}.png`);
    }
    expect(source).toContain('const avatarSource = AVATAR_MAP[student?.avatar_key] ?? AVATAR_MAP.lily;');
    expect(source).toMatch(/heroAvatarCard:\s*\{\s*width: 260,\s*height: 210,/);
    expect(source).toMatch(/heroAvatar:\s*\{\s*width: '100%',\s*height: '100%',/);
    expect(source).toMatch(/source=\{avatarSource\}[\s\S]*?resizeMode="contain"/);
    expect(chooserReference).toMatch(/sideAvatarCard:\s*\{[\s\S]*?width: '100%',\s*height: 210,/);
    expect(chooserReference).toMatch(/sideColumn:\s*\{\s*width: 260,/);
  });

  it('increases both heading sizes while retaining their typography', () => {
    expect(source).toMatch(/heroGreeting:\s*\{\s*fontSize: 32,/);
    expect(source).toMatch(/heroSubtitle:\s*\{\s*fontSize: 18,/);
    expect(source).toMatch(/fontFamily: 'Nunito_900Black'/);
    expect(source).toMatch(/fontFamily: 'Nunito_600SemiBold'/);
  });

  it('enlarges the white chooser container', () => {
    expect(source).toMatch(/card:\s*\{\s*width: '100%',\s*maxWidth: 680,\s*minHeight: 350,/);
    expect(source).toMatch(/minHeight: 350,[\s\S]*?padding: 30,/);
  });

  it('keeps both enlarged chooser cards equally sized', () => {
    expect(source).toMatch(/lowercasePill:\s*\{[\s\S]*?paddingVertical: 28,[\s\S]*?paddingHorizontal: 22,[\s\S]*?minHeight: 220,/);
    expect(source).toMatch(/uppercasePill:\s*\{[\s\S]*?paddingVertical: 28,[\s\S]*?paddingHorizontal: 22,[\s\S]*?minHeight: 220,/);
  });
});
