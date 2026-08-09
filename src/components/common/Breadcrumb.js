import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ButtonFeedback } from '../components/common/ButtonFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';

const K = {
  purple:     '#8A80BC',
  purpleLight:'#EFEDF8',
  bg:         '#F2F1F8',
};

/**
 * crumbs – array of { label, onPress? }
 *   - Last item is the current page (not tappable, bold)
 *   - Earlier items are tappable links
 * title  – large title shown below the crumb trail
 * right  – optional right-side element
 */
export function Breadcrumb({ crumbs = [], title, right }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* Back button + crumb trail */}
      <View style={styles.trailRow}>
        {/* Back chevron navigates to previous crumb */}
        {crumbs.length > 1 && crumbs[crumbs.length - 2]?.onPress && (
          <ButtonFeedback
            onPress={crumbs[crumbs.length - 2].onPress}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color={K.purple} />
          </ButtonFeedback>
        )}

        <View style={styles.trail}>
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <View key={i} style={styles.crumbItem}>
                {i > 0 && (
                  <Ionicons
                    name="chevron-forward"
                    size={10}
                    color={Colors.text.muted}
                    style={styles.separator}
                  />
                )}
                {isLast || !crumb.onPress ? (
                  <Text
                    style={[styles.crumbText, isLast && styles.crumbTextActive]}
                    numberOfLines={1}
                  >
                    {crumb.label}
                  </Text>
                ) : (
                  <ButtonFeedback onPress={crumb.onPress} activeOpacity={0.7}>
                    <Text style={[styles.crumbText, styles.crumbTextLink]} numberOfLines={1}>
                      {crumb.label}
                    </Text>
                  </ButtonFeedback>
                )}
              </View>
            );
          })}
        </View>

        {right && <View style={styles.right}>{right}</View>}
      </View>

      {/* Page title */}
      {title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Layout.spacing.lg,
    paddingBottom: Layout.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    ...Layout.shadow.sm,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: K.purpleLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Layout.spacing.sm,
    flexShrink: 0,
  },
  trail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  separator: {
    marginHorizontal: 3,
  },
  crumbText: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.muted,
    fontFamily: 'Nunito_600SemiBold',
    flexShrink: 1,
  },
  crumbTextLink: {
    color: K.purple,
    fontFamily: 'Nunito_600SemiBold',
  },
  crumbTextActive: {
    color: Colors.text.primary,
    fontFamily: 'Nunito_700Bold',
  },
  right: {
    marginLeft: Layout.spacing.sm,
    flexShrink: 0,
  },
  title: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_800ExtraBold',
    color: Colors.text.primary,
    marginTop: 4,
  },
});
