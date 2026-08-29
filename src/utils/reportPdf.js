import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
  StorageAccessFramework as SAF,
} from 'expo-file-system/legacy';
import { buildReportHtml } from './reportHtml';

/**
 * Turning a saved report into a PDF, and then either sharing it or saving it.
 *
 * Two actions rather than one because they answer different needs. Sharing hands
 * the file to another app — mail it to a parent, put it in the school's chat —
 * and the file itself never lands anywhere the teacher can find again. Saving
 * puts it in a folder they choose and can open next term without this app.
 *
 * The legacy file-system import is deliberate: the Storage Access Framework, the
 * only way to write into a folder the user picks on Android, lives there and has
 * no equivalent in the new `File`/`Directory` API yet.
 */

/**
 * A filename a teacher can recognise in a folder of fifty.
 *
 * `printToFileAsync` names its output with a random id, so without this a shared
 * report arrives as `a41f9c2e-....pdf` — which tells the person receiving it
 * nothing, and makes a saved one impossible to find later.
 */
export function reportFileName(report = {}, student = {}) {
  const parts = [student.full_name, report.label].filter(Boolean).join(' - ');
  const safe = (parts || 'Learning report')
    // Anything a filesystem might refuse, plus the ones Android silently mangles.
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${safe}.pdf`;
}

/**
 * Render one report to a PDF in the cache, named properly.
 *
 * Returns `{ uri, name }`. The caller is responsible for the file's fate — the
 * cache is cleared by the OS eventually, which is right for a temporary artefact
 * that has already been handed to the share sheet or copied out.
 */
export async function makeReportPdf(report, student, opts = {}) {
  const html = buildReportHtml(report, student, opts);
  const { uri } = await Print.printToFileAsync({ html });

  const name = reportFileName(report, student);
  if (!cacheDirectory) return { uri, name };

  // Copied rather than moved, so a failure here still leaves a usable PDF at the
  // original path instead of losing the render.
  const named = `${cacheDirectory}${encodeURIComponent(name)}`;
  try {
    await deleteAsync(named, { idempotent: true });
    await copyAsync({ from: uri, to: named });
    return { uri: named, name };
  } catch {
    return { uri, name };
  }
}

/** Hand the PDF to another app — mail, chat, print. */
export async function shareReportPdf(report, student) {
  const { uri, name } = await makeReportPdf(report, student);

  if (!(await Sharing.isAvailableAsync())) {
    // Printing still works where sharing does not, so the teacher is not simply
    // left with nothing.
    await Print.printAsync({ uri });
    return { method: 'print', name };
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: name.replace(/\.pdf$/, ''),
  });
  return { method: 'share', name };
}

/**
 * Save the PDF into a folder the teacher picks.
 *
 * Android has a real answer: the Storage Access Framework opens the system
 * folder picker and writes the file where they choose — Downloads, a class
 * folder on the SD card, Drive. The file is then theirs, findable without this
 * app installed.
 *
 * iOS has no user-visible download folder, and no way to write outside the app's
 * sandbox without a native module this project cannot add. There, "Save to
 * Files" lives inside the share sheet, so that is where this sends them — the
 * same sheet, but opened for saving rather than sending. The returned `method`
 * says which happened so the caller can tell the teacher the truth about where
 * their file went.
 */
export async function downloadReportPdf(report, student) {
  const { uri, name } = await makeReportPdf(report, student);

  if (Platform.OS !== 'android') {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Save ${name.replace(/\.pdf$/, '')}`,
      });
      return { method: 'files', name };
    }
    await Print.printAsync({ uri });
    return { method: 'print', name };
  }

  const permission = await SAF.requestDirectoryPermissionsAsync();
  if (!permission.granted) return { method: 'cancelled', name };

  // Base64 both ways. A PDF is binary, and reading it as text would corrupt every
  // byte above 0x7F — the file would arrive the right size and refuse to open.
  const data = await readAsStringAsync(uri, { encoding: 'base64' });
  const target = await SAF.createFileAsync(permission.directoryUri, name, 'application/pdf');
  await writeAsStringAsync(target, data, { encoding: 'base64' });

  return { method: 'saved', name, uri: target, folder: folderNameOf(permission.directoryUri) };
}

/**
 * The folder's own name out of a SAF tree URI, so the confirmation can say where
 * the file went rather than "saved successfully".
 *
 * These URIs are opaque and vary by provider, so this is best-effort: it returns
 * null rather than guessing, and the caller words the message accordingly.
 */
function folderNameOf(directoryUri) {
  try {
    const decoded = decodeURIComponent(String(directoryUri));
    const tail = decoded.split(':').pop();
    const leaf = tail?.split('/').filter(Boolean).pop();
    return leaf || null;
  } catch {
    return null;
  }
}
