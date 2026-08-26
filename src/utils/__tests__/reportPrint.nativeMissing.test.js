/**
 * TASK-48 — an app build that predates expo-print must degrade, not crash.
 *
 * This is a real failure mode, not a hypothetical: expo-print's native half only
 * exists in a binary built after the dependency was added, and a top-level
 * `import * as Print from 'expo-print'` throws "Cannot find native module
 * 'ExpoPrint'" at module-evaluation time on any older build — which would take
 * both report screens down, not just printing.
 *
 * Deliberately its own file with NO jest.mock for expo-print: a file-level mock
 * is re-applied whenever jest builds a fresh module registry, so it would
 * override the throwing doMock below.
 */

beforeEach(() => {
  jest.resetModules();
});

describe('older app build without the native print module', () => {
  function mockNativeModulesMissing() {
    jest.doMock('expo-print', () => {
      throw new Error("Cannot find native module 'ExpoPrint'");
    });
    jest.doMock('expo-sharing', () => {
      throw new Error("Cannot find native module 'ExpoSharing'");
    });
  }

  it('can be imported at all — the crash was at import time', () => {
    mockNativeModulesMissing();
    expect(() => require('../reportPrint')).not.toThrow();
  });

  it('still builds report HTML, which needs no native module', () => {
    mockNativeModulesMissing();
    const { buildReportHtml } = require('../reportPrint');
    const html = buildReportHtml({
      title: 'Level 1 Trajectory Report',
      sections: [{ heading: 'Greetings', lines: ['hello — fast.'] }],
    });
    expect(html).toContain('Level 1 Trajectory Report');
    expect(html).toContain('hello');
  });

  it('reports the module as unavailable rather than pretending', () => {
    mockNativeModulesMissing();
    const { isPrintAvailable } = require('../reportPrint');
    expect(isPrintAvailable()).toBe(false);
  });

  it('rejects with an actionable message the screen can show', async () => {
    mockNativeModulesMissing();
    const { printReport } = require('../reportPrint');
    await expect(printReport('<html></html>'))
      .rejects.toThrow(/needs a new build of the app/i);
  });

  it('reports availability truthfully when the module IS present', () => {
    jest.doMock('expo-print', () => ({
      printAsync: jest.fn(),
      printToFileAsync: jest.fn(),
    }));
    const { isPrintAvailable } = require('../reportPrint');
    expect(isPrintAvailable()).toBe(true);
  });
});
