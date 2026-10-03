import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterPracticeScreen.js'),
  'utf8',
);
const chooserReference = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/LetterHomeScreen.js'),
  'utf8',
);
const panel = fs.readFileSync(
  path.resolve(__dirname, '../components/handwriting/LetterProgressPanel.js'),
  'utf8',
);
const letterProgress = fs.readFileSync(
  path.resolve(__dirname, '../screens/teacher/handwriting/ProgressReportScreen.js'),
  'utf8',
);

describe('Letter Practice chooser UI cleanup', () => {
  it('uses the landing-page header: centred icon title and a one-line instruction', () => {
    expect(source).toMatch(/<Text style=\{\[styles\.title, \{ color: theme\.headingText \}\]\}>Letter Practice<\/Text>/);
    expect(source).toMatch(/styles\.titleIconCircle/);
    expect(source).toMatch(/Choose lowercase or uppercase/);
    // The student's name and the old "Choose your practice!" hero are gone.
    expect(source).not.toMatch(/\{student\?\.full_name\}/);
    expect(source).not.toMatch(/Choose your practice!/);
    expect(source).not.toMatch(/avatarRing|avatarImg/);
  });

  it('opens the progress bars in a pop-up from the Progress button', () => {
    expect(source).toContain('onPress={() => setShowProgress(true)}');
    expect(source).toMatch(/visible=\{showProgress\}/);
  });

  it('shows the full Letter Progress content in the pop-up instead of a separate screen', () => {
    // No navigation to the old screen any more — its content is the panel.
    expect(source).not.toMatch(/navigate\('ProgressReport'/);
    expect(source).not.toMatch(/View Letter Progress|View Progress Report/);
    expect(source).toMatch(/import LetterProgressPanel from '\.\.\/\.\.\/\.\.\/components\/handwriting\/LetterProgressPanel';/);
    const call = source.slice(source.indexOf('<LetterProgressPanel'), source.indexOf('<LetterProgressPanel') + 400);
    expect(call).toMatch(/student=\{student\}/);
    expect(call).toMatch(/theme=\{theme\}/);
    expect(call).toMatch(/letterSequence=\{letterSequence\}/);
    expect(call).toMatch(/initLow=\{lowercaseProgress\}/);
    expect(call).toMatch(/initUp=\{uppercaseProgress\}/);
  });

  it('labels the destination screen Letter Progress', () => {
    expect(letterProgress).toMatch(/<Text style=\{\[styles\.headerTitle,[\s\S]*?>\s*Letter Progress\s*<\/Text>/);
    expect(letterProgress).not.toMatch(/<Text style=\{\[styles\.headerTitle,[\s\S]*?>\s*Progress Report\s*<\/Text>/);
  });

  it('keeps the authoritative progress calculations (now in the pop-up panel)', () => {
    // The panel shows each case's real count and percentage, one bar each.
    expect(panel).toMatch(/\{lowercase\} \/ 26 letters completed/);
    expect(panel).toMatch(/\{uppercase\} \/ 26 letters completed/);
    expect(panel).toMatch(/Math\.round\(\(lowercase \/ 26\) \* 100\)/);
    expect(panel).toMatch(/Math\.round\(\(uppercase \/ 26\) \* 100\)/);
    expect(panel.match(/<View style=\{styles\.barTrack\}>/g)).toHaveLength(2);
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

  it('shows no avatar, like LetterHome', () => {
    expect(source).not.toContain('assets/handwriting-avatars/');
    expect(source).not.toMatch(/AVATAR_MAP|avatarSource|heroSection/);
    // LetterHome no longer has a side column either.
    expect(chooserReference).not.toMatch(/sideColumn:\s*\{/);
  });

  it('uses the landing pages’ DM Sans typography and 34pt title', () => {
    expect(source).toMatch(/title:\s*\{\s*fontSize: 34,\s*fontFamily: 'DMSans_800ExtraBold',/);
    expect(source).not.toMatch(/Nunito/);
  });

  it('drops the white wrapper panel — the two cards sit directly on the page', () => {
    expect(source).not.toMatch(/\n  card:\s*\{/);
    expect(source).toMatch(/pillsRow:\s*\{\s*width: '100%',\s*maxWidth: 680,/);
  });

  it('keeps both chooser cards equally sized, in the landing-page card frame', () => {
    for (const pill of ['lowercasePill', 'uppercasePill']) {
      expect(source).toMatch(new RegExp(`${pill}:\\s*\\{[\\s\\S]*?backgroundColor: '#FFFFFF',[\\s\\S]*?borderRadius: 28,[\\s\\S]*?paddingVertical: 32,[\\s\\S]*?paddingHorizontal: 22,[\\s\\S]*?minHeight: 260,[\\s\\S]*?borderWidth: 3,`));
    }
  });
});
