/**
 * pdfShare.js
 *
 * The one place that talks to expo-sharing.
 *
 * Two documents leave this app as PDFs — the periodic report (sent to a
 * parent or therapist) and the handwriting practice worksheet (printed for a
 * child). They are different documents with different wording, but the
 * mechanics of handing a file to the native share sheet are identical, and
 * the parts that are easy to get wrong are exactly the parts worth having in
 * one place:
 *
 *   • a share MUST NOT rebuild the document — it sends the file that was
 *     previewed, by uri, so what is sent is what was reviewed;
 *   • availability is checked before sharing, and reported distinctly from a
 *     failure, because "this device has no share sheet" is not an error the
 *     teacher can act on the same way;
 *   • user cancellation is NOT a failure. expo-sharing resolves on cancel on
 *     most platforms, but some native share sheets reject with a
 *     cancellation message — that is normal use, never an error to show.
 *
 * Caller-specific wording (dialog title, the message when there is no file)
 * is passed in, so each document speaks in its own terms.
 *
 * Never throws — every outcome is a tagged result.
 *
 * Dependency-free at module level: expo-sharing is required lazily at call
 * time, so the pure PDF builders that import this file stay unit-testable
 * under plain jest with no RN native module registry.
 */

'use strict';

/**
 * Sanitizes a name into a safe filename segment — letters/digits/spaces
 * only, spaces collapsed to underscores (spec §20: "sanitize student name,
 * avoid path traversal"). Shared so every exported document sanitizes
 * identically; a name that survives here cannot contain a path separator,
 * a parent-directory hop, or a shell-significant character.
 *
 * Returns `fallback` when nothing usable survives sanitization.
 */
export function sanitizeForFilename(value, fallback = 'Student') {
  return String(value ?? fallback)
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || fallback;
}

/**
 * Hands an ALREADY-GENERATED PDF file to the native share sheet.
 *
 * @param {{
 *   fileUri: string,
 *   dialogTitle: string,
 *   missingFileMessage?: string,
 *   logTag?: string,
 * }} params
 * @returns {Promise<{status: 'shared'|'cancelled'|'sharing_unavailable'|'failed', error: string|null}>}
 */
export async function sharePdfFile({
  fileUri,
  dialogTitle,
  missingFileMessage = 'There is no document to share.',
  logTag = 'pdfShare',
}) {
  try {
    const Sharing = require('expo-sharing');

    if (!fileUri) {
      return { status: 'failed', error: missingFileMessage };
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { status: 'sharing_unavailable', error: 'Sharing is not available on this device.' };
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
    return { status: 'shared', error: null };
  } catch (err) {
    const message = err?.message ?? String(err);
    if (/cancel/i.test(message)) {
      return { status: 'cancelled', error: null };
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(`[${logTag}] export/share failed:`, message);
    }
    return { status: 'failed', error: message };
  }
}
