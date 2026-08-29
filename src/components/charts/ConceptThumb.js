import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import { getConceptItem } from '../../data/conceptData';
import { formatConceptLabel } from './ConfusionList';

/**
 * A concept, shown the way the child meets it.
 *
 * The report named concepts in text — "mango", "banana" — while the entire child
 * side of the app is pictures. A teacher reading "guava, papaya, passion" had to
 * translate three words back into three images before any of it meant anything,
 * and for a child who cannot yet read, the word is not even the thing being taught.
 *
 * The rule this exists to enforce: wherever the report names a concept, it shows
 * the same picture the child was shown.
 *
 * `size` drives everything else so one number places it in a row, a card or a grid.
 */
export function ConceptThumb({ categoryKey, conceptKey, size = 34, showLabel = false, tone }) {
  const item = getConceptItem(categoryKey, conceptKey);
  const label = item?.label ?? formatConceptLabel(conceptKey);
  const source = item?.icon ?? item?.real ?? null;

  return (
    <View style={showLabel ? styles.withLabel : null}>
      <View
        style={[
          styles.box,
          { width: size, height: size, borderRadius: Math.round(size * 0.28) },
          tone ? styles[`box_${tone}`] : null,
        ]}
      >
        {source ? (
          <Image
            source={source}
            style={{ width: size * 0.76, height: size * 0.76 }}
            resizeMode="contain"
          />
        ) : (
          // A concept dropped from the catalogue still has a progress row, so this
          // has to render something rather than collapsing the layout around it.
          <Ionicons name="help-circle-outline" size={size * 0.6} color={Colors.icon.muted} />
        )}
      </View>

      {showLabel && (
        <Text style={[styles.label, { width: size + 10 }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

/** The concept's display name, for rows that show the picture separately. */
export function conceptLabel(categoryKey, conceptKey) {
  return getConceptItem(categoryKey, conceptKey)?.label ?? formatConceptLabel(conceptKey);
}

const styles = StyleSheet.create({
  withLabel: { alignItems: 'center', gap: 3 },
  box: {
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  // Tones carry the same meaning as the day chips: green cleared, amber tricky.
  box_good:   { backgroundColor: '#E6F7EE', borderColor: '#B7E6CD' },
  box_tricky: { backgroundColor: '#FDF3E0', borderColor: '#F0DBB0' },

  label: {
    fontSize: 9,
    textAlign: 'center',
    color: Colors.text.secondary,
    fontFamily: 'DMSans_600SemiBold',
  },
});
