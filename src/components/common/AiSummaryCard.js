import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

// Shared by the concept report and the teacher dashboard. Both render a generated
// summary of figures shown elsewhere on the same screen, and both must survive the
// summary being unavailable — the feature can be switched off server-side, and the
// model call can fail.
//
// The rule this component encodes: when there is nothing to show, show nothing.
// A summary is a convenience layered over data the teacher can already read, so a
// failure is not worth an error banner.

const GROUP_TINT = {
  neutral:  { fg: Colors.text.secondary, icon: null },
  positive: { fg: '#22A05F',             icon: 'trending-up-outline' },
  warning:  { fg: '#B4780A',             icon: 'alert-circle-outline' },
  mixup:    { fg: Colors.text.secondary, icon: 'swap-horizontal-outline' },
};

function Group({ title, items, tone = 'neutral' }) {
  if (!items?.length) return null;
  const tint = GROUP_TINT[tone] || GROUP_TINT.neutral;

  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={`${title}-${i}`} style={styles.row}>
          {tint.icon
            ? <Ionicons name={tint.icon} size={13} color={tint.fg} style={styles.rowIcon} />
            : <View style={[styles.bullet, { backgroundColor: tint.fg }]} />}
          <Text style={[styles.rowText, { color: tint.fg }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * @param {object|null} data      the endpoint response, or null while loading
 * @param {boolean}     loading
 * @param {function}    onRefresh optional — regenerate, bypassing the cache
 * @param {boolean}     refreshing
 * @param {object}      groups    { key: { title, tone } } in render order
 */
export function AiSummaryCard({ data, loading, onRefresh, refreshing, groups }) {
  if (loading) {
    return (
      <Card style={styles.card}>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Colors.icon.active} />
          <Text style={styles.loadingText}>Writing summary…</Text>
        </View>
      </Card>
    );
  }

  // Unavailable, errored, or nothing logged yet — all the same to the teacher.
  if (!data?.available || !data.summary) return null;

  const { summary } = data;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Ionicons name="sparkles" size={11} color={Colors.primary} />
          <Text style={styles.badgeText}>AI summary</Text>
        </View>
        {onRefresh ? (
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={Colors.icon.muted} />
              : <Ionicons name="refresh" size={15} color={Colors.icon.default} />}
          </TouchableOpacity>
        ) : null}
      </View>

      {summary.headline ? <Text style={styles.headline}>{summary.headline}</Text> : null}

      {Object.entries(groups).map(([key, cfg]) => (
        <Group key={key} title={cfg.title} items={summary[key]} tone={cfg.tone} />
      ))}

      {/* Rendered, never hidden: the teacher should see the boundary of what this
          summary knows before acting on it. */}
      {summary.caveat ? <Text style={styles.caveat}>{summary.caveat}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Layout.spacing.lg,
    borderColor: '#DFE6FA',
    backgroundColor: '#FBFCFF',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Layout.spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.status.infoLight,
    paddingHorizontal: Layout.spacing.sm,
    paddingVertical: 3,
    borderRadius: Layout.radius.full,
  },
  badgeText: {
    fontFamily: Layout.fonts.semibold,
    fontSize: Layout.fontSize.xs,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  headline: {
    fontFamily: Layout.fonts.semibold,
    fontSize: Layout.fontSize.md,
    lineHeight: 21,
    color: Colors.text.primary,
  },
  group: { marginTop: Layout.spacing.md },
  groupTitle: {
    fontFamily: Layout.fonts.semibold,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Layout.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  rowIcon: { marginTop: 2, marginRight: 6 },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 7,
    marginRight: 8,
    marginLeft: 4,
  },
  rowText: {
    flex: 1,
    fontFamily: Layout.fonts.regular,
    fontSize: Layout.fontSize.sm,
    lineHeight: 19,
  },
  caveat: {
    marginTop: Layout.spacing.md,
    paddingTop: Layout.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    fontFamily: Layout.fonts.regular,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
  },
  loadingText: {
    fontFamily: Layout.fonts.regular,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.muted,
  },
});
