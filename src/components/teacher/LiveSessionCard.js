/**
 * LiveSessionCard.js
 *
 * Proposal FR-16, Phase 7B — compact "Live Handwriting Session" card
 * (spec §14). Near-real-time only: polls GET /handwriting/live-session/:id
 * every LIVE_SESSION_POLL_MS (spec §2/§15), never claims sub-second
 * streaming or continuous biometric monitoring. Neutral language, no raw
 * JSON, no model terminology — every label comes from
 * utils/liveSessionSnapshot.js's describeLiveSession().
 *
 * Polling lifecycle (spec §15): starts on focus, stops on blur/unmount,
 * and the ref-guarded `intervalRef` makes a duplicate interval structurally
 * impossible even across a fast blur/refocus.
 */

'use strict';

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/Card';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { fetchLiveSessionSnapshot } from '../../api/liveSession';
import { describeLiveSession } from '../../utils/liveSessionSnapshot';
import { LIVE_SESSION_POLL_MS } from '../../constants/liveSessionPolicy';

const CONNECTION_DOT = Object.freeze({
  live:       Colors.status.success,
  stale:      Colors.status.warning,
  not_active: Colors.icon.muted,
});

function StatRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function LiveSessionCard({ studentId, compactWhenInactive = false }) {
  const [snapshot, setSnapshot] = useState(undefined); // undefined = not fetched yet
  const intervalRef = useRef(null);

  const poll = useCallback(async () => {
    if (!studentId) return;
    const data = await fetchLiveSessionSnapshot(studentId);
    setSnapshot(data);
  }, [studentId]);

  // Starts polling on focus, stops on blur — never leaves an interval
  // running against a screen the teacher has navigated away from (spec
  // §15). The explicit clear-before-set guards against a duplicate
  // interval even if this effect were ever to re-run while one is live.
  useFocusEffect(
    useCallback(() => {
      poll();
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(poll, LIVE_SESSION_POLL_MS);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [poll])
  );

  if (snapshot === undefined) {
    // While compact, the "checking" state occupies the SAME one-line row the
    // inactive state will settle into, so the surrounding layout never jumps
    // as the first poll resolves.
    if (compactWhenInactive) {
      return (
        <View style={styles.compactRow}>
          <View style={styles.compactLeft}>
            <Ionicons name="radio-outline" size={14} color={Colors.icon.muted} />
            <Text style={styles.compactLabel}>Live Session</Text>
          </View>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      );
    }
    return (
      <Card style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.loadingText}>Checking live session…</Text>
        </View>
      </Card>
    );
  }

  const display = describeLiveSession(snapshot);

  // ── Compact inactive state ──────────────────────────────────────────────
  // Opt-in via `compactWhenInactive`, so the default full-card rendering is
  // untouched for any other consumer. Nothing about polling, the snapshot,
  // describeLiveSession() or the ACTIVE rendering below changes — only how
  // much room "nothing is happening" is allowed to take up. A full-width
  // card announcing an empty state was the single largest block on the
  // Writing tab.
  if (compactWhenInactive && !display.active) {
    return (
      <View style={styles.compactRow}>
        <View style={styles.compactLeft}>
          <Ionicons name="radio-outline" size={14} color={Colors.icon.muted} />
          <Text style={styles.compactLabel}>Live Session</Text>
        </View>
        <View style={styles.compactRight}>
          <View style={[styles.dot, { backgroundColor: CONNECTION_DOT[display.connection] ?? CONNECTION_DOT.not_active }]} />
          <Text style={styles.compactValue}>Not Active</Text>
        </View>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="radio-outline" size={16} color={display.active ? Colors.text.link : Colors.icon.muted} />
        </View>
        <Text style={styles.title}>Live Handwriting Session</Text>
        <View style={styles.connectionBadge}>
          <View style={[styles.dot, { backgroundColor: CONNECTION_DOT[display.connection] ?? CONNECTION_DOT.not_active }]} />
          <Text style={styles.connectionText}>{display.connectionLabel}</Text>
        </View>
      </View>

      {!display.active ? (
        <Text style={styles.notActiveText}>No active handwriting session right now.</Text>
      ) : (
        <View style={styles.statsBlock}>
          <StatRow label="Activity" value={display.activityLabel} />
          <StatRow label={display.caseType ? 'Letter' : (display.currentItem ? 'Word' : null)} value={display.currentItem} />
          <StatRow label="Attempt" value={display.attemptNumber ? `${display.attemptNumber}` : null} />
          <StatRow label="Support" value={display.supportLevel} />
          <StatRow label="Session duration" value={display.elapsedLabel} />
          <StatRow label="Latest saved result" value={display.latestScore != null ? `${display.latestScore} / 100` : null} />
          <StatRow label="Status" value={display.statusLabel} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Layout.spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7, height: 7, borderRadius: 3.5,
  },
  connectionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  // One-line inactive/loading row — deliberately not a Card: no elevation,
  // no card padding, no empty vertical space.
  compactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, paddingHorizontal: 4, marginBottom: 8,
  },
  compactLeft:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  compactRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactLabel: { fontSize: 12.5, color: Colors.text.secondary },
  compactValue: { fontSize: 12.5, fontWeight: '600', color: Colors.text.muted },
  notActiveText: {
    fontSize: 13,
    color: Colors.text.muted,
  },
  statsBlock: {
    gap: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  statLabel: {
    fontSize: 12.5,
    color: Colors.text.secondary,
  },
  statValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.text.primary,
    maxWidth: '60%',
    textAlign: 'right',
  },
});
