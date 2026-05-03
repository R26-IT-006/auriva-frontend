import React, { useState } from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Layout } from "../../constants/layout";
import { ButtonFeedback } from "./ButtonFeedback";

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "none",
  leftIcon,
  error,
  editable = true,
  multiline = false,
  numberOfLines,
  style,
  inputStyle,
  onBlur,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const isPassword = secureTextEntry;
  const secure = isPassword && !showPassword;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          error && styles.inputWrapperError,
          !editable && styles.inputWrapperDisabled,
          multiline && {
            height: "auto",
            minHeight: 80,
            alignItems: "flex-start",
          },
        ]}
      >
        {leftIcon && (
          <View
            style={[styles.leftIconContainer, multiline && { paddingTop: 12 }]}
          >
            {leftIcon}
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={[
            styles.input,
            !leftIcon && { paddingLeft: Layout.spacing.md },
            isPassword && { paddingRight: 44 },
            multiline && { textAlignVertical: "top", paddingTop: 12 },
            inputStyle,
          ]}
        />
        {isPassword && (
          <ButtonFeedback
            onPress={() => setShowPassword((p) => !p)}
            style={styles.eyeIcon}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={Colors.icon.default}
            />
          </ButtonFeedback>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Layout.spacing.md,
  },
  label: {
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.semibold,
    color: Colors.text.secondary,
    marginBottom: Layout.spacing.xs,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Layout.radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
    ...Layout.shadow.sm,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
  },
  inputWrapperError: {
    borderColor: Colors.status.error,
  },
  inputWrapperDisabled: {
    backgroundColor: Colors.surfaceAlt,
    opacity: 0.7,
  },
  leftIconContainer: {
    paddingLeft: Layout.spacing.md,
    paddingRight: Layout.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    height: "100%",
    paddingRight: Layout.spacing.md,
  },
  eyeIcon: {
    position: "absolute",
    right: Layout.spacing.md,
  },
  error: {
    fontSize: Layout.fontSize.xs,
    color: Colors.status.error,
    marginTop: 4,
    marginLeft: 4,
  },
});
