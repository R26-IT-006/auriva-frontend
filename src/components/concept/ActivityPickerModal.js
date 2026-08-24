import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * The activity chooser behind the concept screen's Activities button.
 *
 * Two steps in one sheet: the activity list, and — only for colouring, which
 * needs to know *which* picture — a grid of the category's colouring pages.
 *
 * Unavailable activities are listed and disabled rather than hidden, so the
 * child and teacher can see what is coming and what unlocks it.
 */
export function ActivityPickerModal({
  visible,
  theme,
  activities,
  coloringItems,
  onPick,
  onClose,
}) {
  const [pickingColour, setPickingColour] = useState(false);

  // Always reopen on the activity list, never on the grid the last visit left.
  useEffect(() => { if (visible) setPickingColour(false); }, [visible]);

  function handlePress(activity) {
    if (activity.disabledReason) return;
    if (activity.key === 'coloring') {
      setPickingColour(true);
      return;
    }
    onPick(activity.screen, activity.params ?? {});
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Swallows taps so a press inside the sheet doesn't close it */}
        <Pressable style={styles.sheet} onPress={() => {}}>

          <View style={styles.header}>
            {pickingColour ? (
              <TouchableOpacity
                onPress={() => setPickingColour(false)}
                accessibilityRole="button"
                accessibilityLabel="Back to activities"
                style={styles.headerBtn}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={22} color={theme.headingText} />
              </TouchableOpacity>
            ) : (
              <View style={styles.headerBtn} />
            )}

            <Text style={[styles.title, { color: theme.headingText }]}>
              {pickingColour ? 'Pick a picture' : 'Choose an activity'}
            </Text>

            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.headerBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={theme.headingText} />
            </TouchableOpacity>
          </View>

          {pickingColour ? (
            <ScrollView contentContainerStyle={styles.colourGrid} showsVerticalScrollIndicator={false}>
              {coloringItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.colourCard, { borderColor: theme.cardOutline }]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Colour the ${item.label}`}
                  onPress={() => onPick('ConceptColoring', { conceptKey: item.key })}
                >
                  <Image source={item.coloring} style={styles.colourImage} resizeMode="contain" />
                  <Text style={[styles.colourLabel, { color: theme.headingText }]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {activities.map((activity) => {
                const locked = Boolean(activity.disabledReason);
                return (
                  <TouchableOpacity
                    key={activity.key}
                    style={[
                      styles.row,
                      { borderColor: theme.cardOutline },
                      locked && styles.rowLocked,
                    ]}
                    activeOpacity={locked ? 1 : 0.85}
                    disabled={locked}
                    accessibilityRole="button"
                    accessibilityLabel={activity.title}
                    accessibilityState={{ disabled: locked }}
                    accessibilityHint={activity.disabledReason || undefined}
                    onPress={() => handlePress(activity)}
                  >
                    <View
                      style={[
                        styles.rowIcon,
                        { backgroundColor: locked ? '#E4E4E4' : theme.button },
                      ]}
                    >
                      <Ionicons
                        name={locked ? 'lock-closed' : activity.icon}
                        size={22}
                        color="#FFFFFF"
                      />
                    </View>

                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme.headingText }]}>
                        {activity.title}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {activity.disabledReason || activity.subtitle}
                      </Text>
                    </View>

                    {!locked && (
                      <Ionicons name="chevron-forward" size={20} color={theme.cardOutline} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'DMSans_800ExtraBold',
    textAlign: 'center',
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowLocked: {
    borderColor: '#E4E4E4',
    backgroundColor: '#FAFAFA',
  },
  rowIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
  },
  rowSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#7A8A9A',
  },

  colourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  colourCard: {
    width: 104,
    borderWidth: 2,
    borderRadius: 18,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
  },
  colourImage: {
    width: '100%',
    height: 66,
  },
  colourLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
  },
});
