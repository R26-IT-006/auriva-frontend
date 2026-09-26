/**
 * PeriodSelector.js
 *
 * Proposal FR-19, Phase 7C — teacher-facing period selector (spec §14).
 *
 * The Custom fields open a native date picker (ReportDateField) rather than
 * accepting free-typed text, and are bounded: the earliest selectable day is
 * the student's registration date and the latest is today. Out-of-range days
 * are unselectable in the picker itself, so a teacher cannot construct a
 * range covering days before the student existed or days in the future.
 *
 * The bounds are a UI affordance, not the authority — utils/reportPeriod.js
 * re-validates them, and the server remains the sole authority (spec §3).
 */

'use strict';

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { REPORT_PERIOD_PRESETS } from '../../../constants/reportPeriodPolicy';
import ReportDateField from './ReportDateField';
import { parseDateOnly } from '../../../utils/reportPeriod';

const ACCENT = '#6366F1';

export default function PeriodSelector({
  presetKey, onSelectPreset, customRange, onApplyCustomRange, customError,
  minDate, maxDate,
}) {
  const [draftStart, setDraftStart] = useState(customRange?.startDate ?? '');
  const [draftEnd, setDraftEnd] = useState(customRange?.endDate ?? '');

  return (
    <View>
      <View style={styles.row}>
        {REPORT_PERIOD_PRESETS.map((p) => {
          const active = p.key === presetKey;
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onSelectPreset(p.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Report period: ${p.label}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {presetKey === 'custom' && (
        <View style={styles.customBlock}>
          <View style={styles.customRow}>
            <ReportDateField
              label="Start Date"
              value={draftStart}
              onChange={setDraftStart}
              minDate={minDate}
              // The start day can never be after the end day, so the end date
              // (when already chosen) tightens the start field's own ceiling.
              maxDate={parseDateOnly(draftEnd) ?? maxDate}
              accessibilityLabel="Custom period start date"
            />
            <ReportDateField
              label="End Date"
              value={draftEnd}
              onChange={setDraftEnd}
              // Symmetrically, the chosen start day raises the end field's floor.
              minDate={parseDateOnly(draftStart) ?? minDate}
              maxDate={maxDate}
              accessibilityLabel="Custom period end date"
            />
          </View>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => onApplyCustomRange({ startDate: draftStart.trim(), endDate: draftEnd.trim() })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Apply custom date range"
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
          {customError ? <Text style={styles.errorText}>{customError}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: '#F1F2FB', borderWidth: 1, borderColor: '#E2E6F0',
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  chipText: { fontSize: 12.5, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', color: '#5A5F7A' },
  chipTextActive: { color: '#FFFFFF' },
  customBlock: { marginTop: 12 },
  customRow: { flexDirection: 'row', gap: 10 },
  customField: { flex: 1 },
  applyBtn: {
    marginTop: 10, alignSelf: 'flex-start', backgroundColor: ACCENT,
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', fontFamily: 'Nunito_700Bold' },
  errorText: { marginTop: 8, fontSize: 11.5, color: '#DC2626' },
});
