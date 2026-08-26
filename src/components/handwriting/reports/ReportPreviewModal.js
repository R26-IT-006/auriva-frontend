/**
 * ReportPreviewModal.js
 *
 * Lets a teacher READ the generated handwriting report before deciding whether
 * to send it to anyone.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The export button previously generated the PDF and opened the share sheet in
 * one action, so the first time anyone saw the report was after choosing a
 * recipient. Sharing a child's progress report is not reversible once it has
 * left the device, so review has to come first: generate → review → share (or
 * close and change the period, and generate again).
 *
 * ── Why the HTML and not the PDF file ──────────────────────────────────────
 * The preview renders the SAME html string the PDF was built from, passed in
 * by generatePeriodicReportPdf(). Rendering the .pdf itself would need a PDF
 * viewer dependency, and — more importantly — rendering the html guarantees the
 * teacher reviews exactly the document that was written to disk rather than a
 * second, separately-assembled approximation that could drift from it.
 *
 * react-native-webview is already a dependency of this project; no new package
 * is introduced. The WebView is deliberately inert: no navigation, no remote
 * loads, JavaScript disabled — it is a viewport onto a local string, and the
 * report html contains only markup and inline SVG.
 */

'use strict';

import React from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

const ACCENT = '#6366F1';
const TEXT_1 = '#0F172A';
const TEXT_2 = '#475569';
const TEXT_3 = '#94A3B8';

export default function ReportPreviewModal({
  visible, html, filename, onShare, onClose, sharing = false, message = null,
  // The document being previewed. Defaults to the periodic report's own
  // wording so existing report behaviour is unchanged; the worksheet preview
  // passes its own title rather than a second preview component being built.
  title = 'Report preview',
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {filename ? <Text style={styles.subtitle} numberOfLines={1}>{filename}</Text> : null}
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Close preview without sharing"
          >
            <Ionicons name="close" size={22} color={TEXT_2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Check the report below. It has been saved to this device — nothing is sent to anyone
          until you choose Share.
        </Text>

        <View style={styles.viewer}>
          {html ? (
            <WebView
              originWhitelist={['*']}
              source={{ html }}
              // Inert viewer: the report is a local string of markup and inline
              // SVG, so nothing needs to run or load.
              javaScriptEnabled={false}
              domStorageEnabled={false}
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={() => false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator size="small" color={ACCENT} />
                </View>
              )}
              style={styles.webview}
            />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          )}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.secondaryBtn]}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close without sharing"
          >
            <Text style={styles.secondaryBtnText}>Close</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, sharing && styles.btnDisabled]}
            onPress={onShare}
            disabled={sharing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Share this report"
          >
            {sharing
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Ionicons name="share-outline" size={16} color="#FFFFFF" />}
            <Text style={styles.primaryBtnText}>Share Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: TEXT_1 },
  subtitle: { fontSize: 11.5, color: TEXT_3, marginTop: 2 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F2FB',
  },
  hint: {
    fontSize: 12, color: TEXT_2, lineHeight: 17,
    paddingHorizontal: 18, paddingBottom: 10,
  },
  viewer: {
    flex: 1, marginHorizontal: 14, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E2E6F0', backgroundColor: '#FFFFFF',
  },
  webview: { flex: 1, backgroundColor: '#FFFFFF' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  message: { fontSize: 12, color: '#DC2626', paddingHorizontal: 18, paddingTop: 10 },
  footer: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 14,
  },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 13,
  },
  secondaryBtn: { backgroundColor: '#F1F2FB', borderWidth: 1, borderColor: '#E2E6F0' },
  secondaryBtnText: { color: TEXT_2, fontSize: 13, fontWeight: '700' },
  primaryBtn: { backgroundColor: ACCENT },
  primaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.7 },
});
