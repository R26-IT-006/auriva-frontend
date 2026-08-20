/**
 * PeriodSelector.js
 *
 * Proposal FR-19, Phase 7C — teacher-facing period selector (spec §14).
 * Plain TextInput fields for Custom (YYYY-MM-DD) — no third-party
 * date-picker dependency, matching this project's existing "simple,
 * reliable, project-convention" preference.
 */

'use strict';

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { REPORT_PERIOD_PRESETS } from '../../../constants/reportPeriodPolicy';

const ACCENT = '#6366F1';

export default function PeriodSelector({ presetKey, onSelectPreset, customRange, onApplyCustomRange, customError }) {
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
            <View style={styles.customField}>
              <Text style={styles.customLabel}>Start Date</Text>
              <TextInput
                style={styles.customInput}
                value={draftStart}
                onChangeText={setDraftStart}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#B8BCC8"
                autoCapitalize="none"
                accessibilityLabel="Custom period start date"
              />
            </View>
            <View style={styles.customField}>
              <Text style={styles.customLabel}>End Date</Text>
              <TextInput
                style={styles.customInput}
                value={draftEnd}
                onChangeText={setDraftEnd}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#B8BCC8"
                autoCapitalize="none"
                accessibilityLabel="Custom period end date"
              />
            </View>
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
  chipText: { fontSize: 12.5, fontWeight: '600', color: '#5A5F7A' },
  chipTextActive: { color: '#FFFFFF' },
  customBlock: { marginTop: 12 },
  customRow: { flexDirection: 'row', gap: 10 },
  customField: { flex: 1 },
  customLabel: { fontSize: 11, color: '#5A5F7A', marginBottom: 4, fontWeight: '600' },
  customInput: {
    borderWidth: 1, borderColor: '#E2E6F0', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#1A1A2E', backgroundColor: '#FFFFFF',
  },
  applyBtn: {
    marginTop: 10, alignSelf: 'flex-start', backgroundColor: ACCENT,
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  errorText: { marginTop: 8, fontSize: 11.5, color: '#DC2626' },
});
