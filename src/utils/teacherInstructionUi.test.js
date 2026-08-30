import fs from 'fs';
import path from 'path';

const SCREEN = '../screens/teacher/handwriting/InstructionScreen.js';
const read = () => fs.readFileSync(path.resolve(__dirname, SCREEN), 'utf8');
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function styleBody(source, name) {
  const at = source.indexOf(`  ${name}: {`);
  expect(at).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf('\n  },', at));
}

describe('Teacher Instruction page UI', () => {
  const source = stripComments(read());

  test('uses the shorter five-step teacher guidance', () => {
    for (const title of [
      'Comfortable grip',
      'Trace each shape',
      'Let the child lead',
      'Take your time',
      'Recording is automatic',
    ]) {
      expect(source).toContain(`title: '${title}'`);
    }

    expect(source).toContain("Help {student?.full_name ?? 'the child'} get comfortable, then follow these five steps.");
    expect(source).not.toContain('Ensure the child is comfortably holding');
    expect(source).not.toContain('The system records movement');
  });

  test('removes the gray frames and shadows from the instruction area', () => {
    const container = styleBody(source, 'stepsContainer');
    const step = styleBody(source, 'stepCard');

    expect(container).not.toMatch(/borderWidth|shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation/);
    expect(step).not.toMatch(/borderWidth: 1|borderColor: '#E8EDF7'|shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation/);
    expect(source).not.toContain("borderColor: theme.button + '22'");
  });

  test('keeps clear emphasis without adding more UI', () => {
    const step = styleBody(source, 'stepCard');
    const title = styleBody(source, 'stepTitle');

    expect(step).toContain('borderLeftWidth: 5');
    expect(source).toContain('borderLeftColor: theme.button');
    expect(title).toMatch(/fontWeight: '800'/);
    expect(source).toContain('<Ionicons name={step.icon}');
    expect(source).toContain('{index + 1}');
    expect(source).not.toMatch(/ScrollView/);
  });

  test('retains the existing assessment action and route', () => {
    expect(source).toContain('Begin Assessment');
    expect(source).toContain("navigation.navigate('StudentWelcome', { student, theme })");
  });
});
