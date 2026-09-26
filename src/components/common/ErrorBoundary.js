import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ButtonFeedback } from "./ButtonFeedback";
import { Colors } from "../../constants/colors";
import { Layout } from "../../constants/layout";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.status.error} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.copy}>
            The app hit an unexpected error. Your recorded work should still be saved — try
            going back and continuing.
          </Text>
          <ButtonFeedback style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </ButtonFeedback>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Layout.spacing.xl,
    gap: Layout.spacing.md,
  },
  title: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.bold,
    color: Colors.text.primary,
  },
  copy: {
    textAlign: "center",
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.sm,
    lineHeight: 20,
  },
  button: {
    marginTop: Layout.spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: Layout.radius.md,
    paddingHorizontal: Layout.spacing.xl,
    paddingVertical: Layout.spacing.md,
  },
  buttonText: {
    color: Colors.text.white,
    fontWeight: Layout.fontWeight.bold,
    fontSize: Layout.fontSize.md,
  },
});
