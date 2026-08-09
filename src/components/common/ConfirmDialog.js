import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ButtonFeedback } from './ButtonFeedback';
import { Layout } from '../../constants/layout';

const K = {
  purple:      '#8A80BC',
  purpleLight: '#EFEDF8',
  purpleDark:  '#6B62A8',
  danger:      '#E05252',
  dangerLight: '#FDEAEA',
  text:        '#1A1A2E',
  subtext:     '#666',
};

/**
 * ConfirmDialog
 *
 * Props:
 *   visible      – boolean
 *   title        – string  (default "Confirmation")
 *   message      – string
 *   confirmLabel – string  (default "Confirm")
 *   cancelLabel  – string  (default "Cancel")
 *   icon         – Ionicons name (default "help-circle")
 *   onConfirm    – () => void
 *   onCancel     – () => void
 *   danger       – bool  (confirm button and icon turn red)
 */
export function ConfirmDialog({
  visible = false,
  title = 'Confirmation',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
  onConfirm,
  onCancel,
  danger = false,
}) {
  const resolvedIcon = icon ?? (danger ? 'trash' : 'help-circle');
  const accentColor  = danger ? K.danger : K.purple;
  const accentLight  = danger ? K.dangerLight : K.purpleLight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>

              {/* Icon circle */}
              <View style={[styles.iconCircle, { backgroundColor: accentLight }]}>
                <Ionicons name={resolvedIcon} size={36} color={accentColor} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              <Text style={styles.message}>{message}</Text>

              {/* Buttons — Cancel left, Confirm right */}
              <View style={styles.btnRow}>
                <ButtonFeedback
                  style={[styles.btn, styles.btnCancel]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnCancelText}>{cancelLabel}</Text>
                </ButtonFeedback>

                <ButtonFeedback
                  style={[styles.btn, styles.btnConfirm, { backgroundColor: accentColor }]}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
                </ButtonFeedback>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 28,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
  },

  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  title: {
    fontSize: Layout.fontSize.xl,
    fontFamily: 'Nunito_800ExtraBold',
    color: K.text,
    textAlign: 'center',
  },
  message: {
    fontSize: Layout.fontSize.md,
    color: K.subtext,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },

  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirm: {
    // backgroundColor set inline via accentColor
  },
  btnConfirmText: {
    color: '#FFF',
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.3,
  },
  btnCancel: {
    backgroundColor: '#F2F2F7',
  },
  btnCancelText: {
    color: K.text,
    fontSize: Layout.fontSize.md,
    fontFamily: 'Nunito_600SemiBold',
    letterSpacing: 0.3,
  },
});
