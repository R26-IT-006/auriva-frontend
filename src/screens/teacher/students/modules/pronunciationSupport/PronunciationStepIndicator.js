import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";

function Step({ label, active, done, theme }) {
  return (
    <View style={styles.stepWrap}>
      <View
        style={[
          styles.stepCircle,
          active && { backgroundColor: theme.button, borderColor: theme.button },
          done && {
            backgroundColor: theme.cardOutline,
            borderColor: theme.cardOutline,
          },
        ]}
      >
        {done ? (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        ) : (
          <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

export function PronunciationStepIndicator({ currentStep, totalSteps = 3, theme }) {
  return (
    <View style={styles.stepsRow}>
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1;
        const isLast = step === totalSteps;

        return (
          <React.Fragment key={step}>
            <Step
              label={String(step)}
              active={step === currentStep}
              done={step < currentStep}
              theme={theme}
            />
            {!isLast ? (
              <View
                style={[
                  styles.stepConnector,
                  { backgroundColor: theme.cardOutline },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stepsRow: {
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#98A8BC",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontSize: Layout.fontSize.xs,
    color: "#6E7D92",
    fontFamily: Layout.fonts.bold,
  },
  stepNumberActive: {
    color: "#FFFFFF",
  },
  stepConnector: {
    width: 54,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginHorizontal: 8,
  },
});
