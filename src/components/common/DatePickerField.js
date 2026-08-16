import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const K = {
  purple:     '#8A80BC',
  purpleLight:'#EFEDF8',
  banner:     '#3D5A9E',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ITEM_H = 44;
const VISIBLE = 5; // rows shown

function range(start, end) {
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

function WheelColumn({ items, selectedIndex, onChange, format }) {
  const ref = useRef(null);

  useEffect(() => {
    // scroll to selected after mount
    setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
    }, 50);
  }, [selectedIndex]);

  function handleMomentumEnd(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    onChange(clamped);
    ref.current?.scrollTo({ y: clamped * ITEM_H, animated: true });
  }

  return (
    <View style={col.wrapper}>
      {/* Faded top + bottom overlays */}
      <View style={[col.fade, col.fadeTop]} pointerEvents="none" />
      <View style={[col.fade, col.fadeBottom]} pointerEvents="none" />
      {/* Selection highlight */}
      <View style={col.highlight} pointerEvents="none" />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        style={{ height: ITEM_H * VISIBLE }}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={col.item}
            activeOpacity={0.7}
            onPress={() => {
              onChange(i);
              ref.current?.scrollTo({ y: i * ITEM_H, animated: true });
            }}
          >
            <Text style={[col.itemText, i === selectedIndex && col.itemTextActive]}>
              {format ? format(item) : String(item).padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const col = StyleSheet.create({
  wrapper: { flex: 1, position: 'relative' },
  highlight: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 4,
    right: 4,
    height: ITEM_H,
    backgroundColor: K.purpleLight,
    borderRadius: 10,
    zIndex: 0,
  },
  fade: {
    position: 'absolute',
    left: 0, right: 0,
    height: ITEM_H * 2,
    zIndex: 2,
  },
  fadeTop: {
    top: 0,
    background: 'transparent',
  },
  fadeBottom: {
    bottom: 0,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  itemText: {
    fontSize: Layout.fontSize.lg,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
  },
  itemTextActive: {
    fontSize: Layout.fontSize.xl,
    color: K.purple,
    fontFamily: 'Nunito_800ExtraBold',
  },
});

/**
 * Props:
 *   label       – field label string
 *   value       – ISO date string "YYYY-MM-DD" (or empty)
 *   onChange    – (isoString) => void
 *   error       – error string (optional)
 *   maximumDate – Date (optional)
 *   minimumDate – Date (optional)
 */
export default function DatePickerField({
  label,
  value,
  onChange,
  error,
  maximumDate,
  minimumDate,
}) {
  const [show, setShow] = useState(false);

  const now     = new Date();
  const minYear = minimumDate ? minimumDate.getFullYear() : 1940;
  const maxYear = maximumDate ? maximumDate.getFullYear() : now.getFullYear();

  // Parse current value or default to today
  const parsed = value ? new Date(value + 'T00:00:00') : now;
  const [selDay,   setSelDay]   = useState(parsed.getDate());
  const [selMonth, setSelMonth] = useState(parsed.getMonth()); // 0-based
  const [selYear,  setSelYear]  = useState(parsed.getFullYear());

  const days   = range(1, daysInMonth(selMonth, selYear));
  const months = MONTHS;
  const years  = range(minYear, maxYear).reverse();

  function daysInMonth(month, year) {
    return new Date(year, month + 1, 0).getDate();
  }

  // Clamp day if month/year change reduces max days
  useEffect(() => {
    const max = daysInMonth(selMonth, selYear);
    if (selDay > max) setSelDay(max);
  }, [selMonth, selYear]);

  function formatDisplay(iso) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${d} ${MONTHS[parseInt(m, 10) - 1]} ${y}`;
  }

  function handleDone() {
    const d = String(Math.min(selDay, daysInMonth(selMonth, selYear))).padStart(2, '0');
    const m = String(selMonth + 1).padStart(2, '0');
    onChange(`${selYear}-${m}-${d}`);
    setShow(false);
  }

  function handleOpen() {
    // sync wheel state to current value each time the picker opens
    if (value) {
      const p = new Date(value + 'T00:00:00');
      setSelDay(p.getDate());
      setSelMonth(p.getMonth());
      setSelYear(p.getFullYear());
    }
    setShow(true);
  }

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.field, error && { borderColor: Colors.status.error }]}
        onPress={handleOpen}
        activeOpacity={0.8}
      >
        <View style={styles.iconBox}>
          <Ionicons name="calendar-outline" size={16} color={K.purple} />
        </View>
        <Text style={[styles.fieldText, !value && styles.placeholder]}>
          {formatDisplay(value) || 'Select date of birth'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.icon.default} />
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      <Modal
        visible={show}
        transparent
        animationType="slide"
        onRequestClose={() => setShow(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShow(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>

            {/* Sheet header */}
            <View style={styles.sheetBanner} />
            <View style={styles.sheetTitleRow}>
              <View style={styles.sheetIconBox}>
                <Ionicons name="calendar" size={16} color={K.purple} />
              </View>
              <Text style={styles.sheetTitle}>{label || 'Date of Birth'}</Text>
            </View>

            {/* Column labels */}
            <View style={styles.colLabels}>
              <Text style={styles.colLabel}>Day</Text>
              <Text style={styles.colLabel}>Month</Text>
              <Text style={styles.colLabel}>Year</Text>
            </View>

            {/* Wheels */}
            <View style={styles.wheels}>
              <WheelColumn
                items={days}
                selectedIndex={Math.min(selDay, days.length) - 1}
                onChange={(i) => setSelDay(i + 1)}
              />
              <View style={styles.wheelDivider} />
              <WheelColumn
                items={months}
                selectedIndex={selMonth}
                onChange={(i) => setSelMonth(i)}
                format={(m) => m}
              />
              <View style={styles.wheelDivider} />
              <WheelColumn
                items={years}
                selectedIndex={years.indexOf(selYear) === -1 ? 0 : years.indexOf(selYear)}
                onChange={(i) => setSelYear(years[i])}
                format={(y) => String(y)}
              />
            </View>

            {/* Done */}
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Confirm</Text>
            </TouchableOpacity>

          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },

  label: {
    fontSize: Layout.fontSize.sm,
    fontFamily: 'Nunito_600SemiBold',
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
    paddingHorizontal: Layout.spacing.md,
    gap: Layout.spacing.sm,
  },
  iconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: K.purpleLight,
    alignItems: 'center', justifyContent: 'center',
  },
  fieldText: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    fontFamily: 'Nunito_600SemiBold',
  },
  placeholder: {
    color: Colors.text.muted,
    fontFamily: 'Nunito_400Regular',
  },
  error: {
    fontSize: Layout.fontSize.xs,
    color: Colors.status.error,
    marginLeft: 4,
  },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    paddingBottom: Layout.spacing.xl,
  },
  sheetBanner: {
    height: 6,
    backgroundColor: K.banner,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.lg,
    paddingVertical: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sheetIconBox: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: K.purpleLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.primary,
  },

  colLabels: {
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: 4,
  },
  colLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: Layout.fontSize.xs,
    fontFamily: 'Nunito_700Bold',
    color: Colors.text.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  wheels: {
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.lg,
    gap: 4,
  },
  wheelDivider: {
    width: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Layout.spacing.sm,
  },

  doneBtn: {
    marginHorizontal: Layout.spacing.lg,
    marginTop: Layout.spacing.md,
    backgroundColor: K.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    color: '#FFFFFF',
  },
});
