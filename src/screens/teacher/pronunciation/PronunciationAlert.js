import React, { useCallback, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableWithoutFeedback } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ButtonFeedback } from "../../../components/common/ButtonFeedback";
import { Layout } from "../../../constants/layout";
import { DEFAULT_THEME } from "../../../constants/avatarThemes";
import { ThemedGradientFill } from "./pronunciationDesignKit.js";

// The session flow used to surface every message through `Alert.alert`, which
// renders the platform's own dialog — a plain black box on iOS dark mode, with
// none of the module's rounded cards, avatar colours, or Nunito type. This is
// the in-app replacement: same call shape (title + message), but drawn in the
// child's avatar theme so a mispronunciation notice looks like part of the
// lesson instead of a system error.

// Tone drives only the icon badge and its tint. The action button always uses
// the child's avatar-theme gradient, so the dialog matches whichever character
// they picked.
const TONES = {
  mismatch: { icon: "ear-outline",             color: "#E8832A", light: "#FDF0E1" },
  quality:  { icon: "mic-off-outline",         color: "#D9822B", light: "#FBEEDF" },
  error:    { icon: "alert-circle-outline",    color: "#E05252", light: "#FDEAEA" },
  warning:  { icon: "warning-outline",         color: "#D99A2B", light: "#FBF2DF" },
  success:  { icon: "checkmark-circle-outline",color: "#3FA372", light: "#E4F5EC" },
  info:     { icon: "information-circle-outline", color: "#4A8FD4", light: "#E6F0FB" },
};

function resolveTone(tone) {
  return TONES[tone] || TONES.info;
}

/**
 * PronunciationAlert
 *
 * Props:
 *   visible       – boolean
 *   title         – string
 *   message       – string
 *   tone          – key of TONES (default "info")
 *   heardWord     – string, what the recogniser actually heard (mismatch only)
 *   targetWord    – string, the word/letter that was being practised
 *   confirmLabel  – string (default "Try Again" for mismatch/quality, else "OK")
 *   theme         – avatar theme object
 *   onDismiss     – () => void
 */
export function PronunciationAlert({
  visible = false,
  title = "",
  message = "",
  tone = "info",
  heardWord = null,
  targetWord = null,
  confirmLabel,
  theme,
  onDismiss,
}) {
  const activeTheme = theme || DEFAULT_THEME;
  const toneStyle = resolveTone(tone);
  const isRetryTone = tone === "mismatch" || tone === "quality";
  const buttonLabel = confirmLabel || (isRetryTone ? "Try Again" : "OK");

  // The heard-vs-target comparison only helps when both halves are known and
  // actually differ; otherwise the sentence in `message` already says it.
  const showComparison =
    Boolean(heardWord) &&
    Boolean(targetWord) &&
    String(heardWord).toLowerCase() !== String(targetWord).toLowerCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { borderColor: activeTheme.cardOutline }]}>

              <LinearGradient
                colors={[toneStyle.light, "#FFFFFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.iconCircle}
              >
                <Ionicons name={toneStyle.icon} size={38} color={toneStyle.color} />
              </LinearGradient>

              <Text style={[styles.title, { color: activeTheme.headingText }]}>
                {title}
              </Text>

              {showComparison ? (
                <View style={styles.comparison}>
                  <View style={[styles.chip, { backgroundColor: toneStyle.light }]}>
                    <Text style={[styles.chipLabel, { color: toneStyle.color }]}>
                      We heard
                    </Text>
                    <Text style={[styles.chipWord, { color: toneStyle.color }]} numberOfLines={1}>
                      {heardWord}
                    </Text>
                  </View>

                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={activeTheme.cardOutline}
                    style={styles.comparisonArrow}
                  />

                  <View style={[styles.chip, { backgroundColor: `${activeTheme.cardOutline}22` }]}>
                    <Text style={[styles.chipLabel, { color: activeTheme.headingText }]}>
                      Let's say
                    </Text>
                    <Text style={[styles.chipWord, { color: activeTheme.headingText }]} numberOfLines={1}>
                      {targetWord}
                    </Text>
                  </View>
                </View>
              ) : null}

              {message ? <Text style={styles.message}>{message}</Text> : null}

              <ButtonFeedback style={styles.actionButton} onPress={onDismiss} activeOpacity={0.9}>
                <ThemedGradientFill theme={activeTheme} style={styles.actionFill}>
                  <Text style={[styles.actionText, { color: activeTheme.buttonText }]}>
                    {buttonLabel}
                  </Text>
                </ThemedGradientFill>
              </ButtonFeedback>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/**
 * usePronunciationAlert
 *
 * Drop-in replacement for `Alert.alert(title, message)` inside this module:
 *
 *   const { showAlert, alertProps } = usePronunciationAlert();
 *   showAlert("Different word detected", err.message, { tone: "mismatch" });
 *   ...
 *   <PronunciationAlert {...alertProps} theme={theme} />
 *
 * Only one dialog is ever shown at a time — a second call replaces the first,
 * matching how the platform alert behaved.
 */
export function usePronunciationAlert() {
  const [alertState, setAlertState] = useState(null);

  const showAlert = useCallback((title, message, options = {}) => {
    setAlertState({ title, message, ...options });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(null);
  }, []);

  const alertProps = {
    visible: Boolean(alertState),
    title: alertState?.title ?? "",
    message: alertState?.message ?? "",
    tone: alertState?.tone ?? "info",
    heardWord: alertState?.heardWord ?? null,
    targetWord: alertState?.targetWord ?? null,
    confirmLabel: alertState?.confirmLabel,
    onDismiss: hideAlert,
  };

  return { showAlert, hideAlert, alertProps };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(26, 32, 44, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: Layout.spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 2,
    paddingVertical: Layout.spacing.xl,
    paddingHorizontal: Layout.spacing.lg,
    alignItems: "center",
    gap: Layout.spacing.sm,
    shadowColor: "#1A2030",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 14,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Layout.spacing.xs,
  },
  title: {
    fontSize: Layout.fontSize.xl,
    fontFamily: Layout.fonts.extrabold,
    textAlign: "center",
  },
  message: {
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.regular,
    color: "#5A6472",
    textAlign: "center",
    lineHeight: 22,
  },

  comparison: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Layout.spacing.sm,
    marginTop: Layout.spacing.xs,
  },
  chip: {
    flexShrink: 1,
    minWidth: 104,
    borderRadius: Layout.radius.lg,
    paddingVertical: Layout.spacing.sm,
    paddingHorizontal: Layout.spacing.md,
    alignItems: "center",
    gap: 2,
  },
  chipLabel: {
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
    opacity: 0.8,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  chipWord: {
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.extrabold,
  },
  comparisonArrow: {
    marginTop: Layout.spacing.md,
  },

  actionButton: {
    width: "100%",
    marginTop: Layout.spacing.md,
    borderRadius: Layout.radius.lg,
    overflow: "hidden",
  },
  actionFill: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.bold,
    letterSpacing: 0.3,
  },
});
