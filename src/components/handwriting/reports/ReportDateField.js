/**
 * ReportDateField.js
 *
 * A tappable date field for the periodic report's Custom range. Opens the
 * platform's native date picker with hard `minimumDate`/`maximumDate` bounds,
 * so out-of-range days cannot be selected at all rather than being typed and
 * then rejected by an error message.
 *
 * Uses @react-native-community/datetimepicker, which is already a dependency
 * of this project (and already declared as an Expo config plugin in app.json)
 * — no new package is introduced. The bounds are enforced natively by the
 * picker itself, which is why they are passed straight through.
 *
 * Deliberately NOT the project's existing common/DatePickerField.js: that is a
 * free-scrolling wheel modal for date-of-birth with no min/max support, so it
 * cannot express "this day is not selectable".
 *
 * Values cross this boundary as `YYYY-MM-DD` strings in UTC, matching the rest
 * of the report period pipeline (utils/reportPeriod.js and the backend's
 * reportDateRange.js both use UTC date-only semantics). Converting through
 * local-time Date objects would shift the day for teachers east/west of UTC,
 * so the parse/format helpers below pin everything to UTC.
 */

'use strict';

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
// Pure date helpers live in utils/reportPeriod.js so they stay dependency-free
// and unit-testable without an RN environment.
import { parseDateOnly, formatDateOnly, clampDate } from '../../../utils/reportPeriod';

const ACCENT = '#6366F1';

export default function ReportDateField({
  label, value, onChange, minDate, maxDate, accessibilityLabel, disabled = false,
}) {
  const [open, setOpen] = useState(false);

  const selected = parseDateOnly(value);
  // What the picker opens on when nothing is chosen yet: the max bound is the
  // most useful default (today for the end date, and the latest legal day for
  // the start date), and it is guaranteed to be inside the allowed range.
  const pickerValue = clampDate(selected, minDate, maxDate) ?? maxDate ?? new Date();

  function handleChange(event, picked) {
    // Android fires with type 'dismissed' on cancel and closes itself; iOS
    // keeps the inline picker mounted until the field is tapped again.
    if (Platform.OS === 'android') setOpen(false);
    if (event?.type === 'dismissed' || !picked) return;

    const clamped = clampDate(picked, minDate, maxDate);
    const next = formatDateOnly(clamped);
    if (next) onChange(next);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={[styles.input, disabled && styles.inputDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.75}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint="Opens a date picker"
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value || 'Select date'}
        </Text>
        <Ionicons name="chevron-down" size={15} color={disabled ? '#B8BCC8' : ACCENT} />
      </TouchableOpacity>

      {open && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minDate ?? undefined}
          maximumDate={maxDate ?? undefined}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1 },
  label: { fontSize: 11, color: '#5A5F7A', marginBottom: 4, fontWeight: '600', fontFamily: 'Nunito_600SemiBold' },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#E2E6F0', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#FFFFFF',
  },
  inputDisabled: { backgroundColor: '#F5F6FA', borderColor: '#EDEFF5' },
  value: { fontSize: 13, color: '#1A1A2E' },
  placeholder: { color: '#B8BCC8' },
});
