import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import { teacherApi } from "../../../../../api/teacher";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { useToast } from "../../../../../context/ToastContext";
import { formatDateTime, getScoreColor } from "./pronunciationHistory.js";

const QUEUE_LIMIT = 50;

function ConfidenceBadge({ confidenceScore }) {
  if (confidenceScore == null) return null;
  const color = confidenceScore >= 75
    ? Colors.status.success
    : confidenceScore >= 55
      ? Colors.status.warning
      : Colors.status.review;

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}1A` }]}>
      <Text style={[styles.badgeText, { color }]}>{confidenceScore}% confident</Text>
    </View>
  );
}

function QueueCard({ item, onReview }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName} numberOfLines={1}>
            {item.student?.full_name || "Student"}
          </Text>
          <Text style={styles.wordLabel} numberOfLines={1}>
            {item.word_label || item.word_id}
          </Text>
        </View>
        <View
          style={[
            styles.scoreCircle,
            { borderColor: getScoreColor(item.overall_score) },
          ]}
        >
          <Text style={[styles.scoreCircleText, { color: getScoreColor(item.overall_score) }]}>
            {item.overall_score}%
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <ConfidenceBadge confidenceScore={item.confidence_score} />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.population_tag}</Text>
        </View>
        <View style={[styles.badge, styles.priorityBadge]}>
          <Ionicons name="flag-outline" size={12} color={Colors.primary} />
          <Text style={[styles.badgeText, { color: Colors.primary }]}>
            priority {item.informativeness_score}
          </Text>
        </View>
      </View>

      {item.informativeness_reasons?.length ? (
        <View style={styles.reasonsBox}>
          {item.informativeness_reasons.map((reason, index) => (
            <Text key={index} style={styles.reasonText}>
              • {reason}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>{formatDateTime(item.created_at)}</Text>
        <TouchableOpacity
          style={styles.reviewButton}
          activeOpacity={0.82}
          onPress={() => onReview(item)}
        >
          <Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />
          <Text style={styles.reviewButtonText}>Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ReplayAudioButton({ resultId, hasRawAudio }) {
  const soundRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function stopAudio() {
    if (!soundRef.current) return;
    await soundRef.current.unloadAsync().catch(() => {});
    soundRef.current = null;
    setIsPlaying(false);
  }

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [resultId]);

  if (!hasRawAudio) {
    return (
      <View style={styles.audioRow}>
        <Ionicons name="mic-off-outline" size={16} color={Colors.text.secondary} />
        <Text style={styles.audioUnavailableText}>No recording saved for this attempt</Text>
      </View>
    );
  }

  async function handlePress() {
    if (isPlaying) {
      await stopAudio();
      return;
    }

    setIsLoading(true);
    try {
      await stopAudio();
      const audio = await teacherApi.getPronunciationResultAudio(resultId);
      const audioBase64 = audio?.raw_audio_base64;
      const audioMimeType = audio?.raw_audio_mime_type || "audio/mp4";

      if (!audioBase64) {
        throw new Error("No saved audio was returned for this attempt.");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:${audioMimeType};base64,${audioBase64}` },
        { shouldPlay: true },
      );

      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) {
            soundRef.current = null;
            setIsPlaying(false);
          }
        }
      });
    } catch (error) {
      Alert.alert("Playback error", error.message || "Unable to play this recording right now.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <TouchableOpacity
      style={styles.audioRow}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : (
        <Ionicons
          name={isPlaying ? "pause-circle" : "play-circle"}
          size={22}
          color={Colors.primary}
        />
      )}
      <Text style={styles.audioRowText}>
        {isPlaying ? "Playing…" : "Play the student's recording"}
      </Text>
    </TouchableOpacity>
  );
}

function ReviewScoreModal({ item, onCancel, onSubmit, submitting }) {
  const [scoreText, setScoreText] = useState(
    item ? String(item.overall_score ?? "") : ""
  );

  useEffect(() => {
    setScoreText(item ? String(item.overall_score ?? "") : "");
  }, [item?.id]);

  const parsedScore = Number(scoreText);
  const isValid =
    scoreText.trim() !== "" &&
    Number.isInteger(parsedScore) &&
    parsedScore >= 0 &&
    parsedScore <= 100;

  return (
    <Modal
      visible={Boolean(item)}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Confirm the score</Text>
          <Text style={styles.modalSubtitle}>
            {item?.student?.full_name} — "{item?.word_label || item?.word_id}"
          </Text>
          <Text style={styles.modalHint}>
            The system scored this attempt {item?.overall_score}%. Enter what you judge
            the correct score to be — this becomes the labeled ground truth used to
            calibrate future scoring for this student's population.
          </Text>

          {item ? (
            <ReplayAudioButton
              key={item.id}
              resultId={item.id}
              hasRawAudio={Boolean(item.has_raw_audio)}
            />
          ) : null}

          <TextInput
            style={styles.scoreInput}
            value={scoreText}
            onChangeText={setScoreText}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="0-100"
            placeholderTextColor={Colors.text.secondary}
            autoFocus
          />

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={onCancel}
              activeOpacity={0.8}
              disabled={submitting}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.modalSubmitButton,
                !isValid && styles.modalSubmitButtonDisabled,
              ]}
              onPress={() => isValid && onSubmit(parsedScore)}
              activeOpacity={0.8}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function PronunciationReviewQueueScreen() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewingItem, setReviewingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const fetchQueue = useCallback(async () => {
    try {
      const data = await teacherApi.getPronunciationReviewQueue(QUEUE_LIMIT);
      setQueue(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.show(error.message || "Could not load the review queue.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      fetchQueue();
    }, [fetchQueue])
  );

  async function handleSubmitReview(score) {
    if (!reviewingItem) return;
    setSubmitting(true);
    try {
      await teacherApi.submitPronunciationReview(reviewingItem.id, score);
      setQueue((current) => current.filter((row) => row.id !== reviewingItem.id));
      setReviewingItem(null);
      toast.show("Review saved.", "success");
    } catch (error) {
      toast.show(error.message || "Could not save this review.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Review Queue</Text>
        <Text style={styles.subtitle}>
          Attempts ranked by how much labeling them would help the AI scoring model —
          not just recency. Low-confidence attempts and under-represented student
          populations are surfaced first.
        </Text>
      </View>

      {loading ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : queue.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-done-circle-outline" size={28} color={Colors.icon.muted} />
          <Text style={styles.emptyTitle}>Nothing to review</Text>
          <Text style={styles.emptyCopy}>
            Every recent attempt has either been reviewed or is confidently scored.
          </Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <QueueCard item={item} onReview={setReviewingItem} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchQueue();
              }}
            />
          }
        />
      )}

      <ReviewScoreModal
        item={reviewingItem}
        submitting={submitting}
        onCancel={() => !submitting && setReviewingItem(null)}
        onSubmit={handleSubmitReview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Layout.spacing.lg,
    paddingTop: Layout.spacing.md,
    paddingBottom: Layout.spacing.sm,
  },
  title: {
    fontSize: Layout.fontSize.xl,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
  },
  subtitle: {
    marginTop: 4,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.sm,
    lineHeight: 19,
  },
  list: {
    padding: Layout.spacing.lg,
    paddingTop: Layout.spacing.sm,
    gap: Layout.spacing.md,
  },
  emptyCard: {
    flex: 1,
    minHeight: 220,
    marginHorizontal: Layout.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: Layout.spacing.lg,
  },
  emptyTitle: {
    marginTop: Layout.spacing.sm,
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    fontFamily: Layout.fonts.bold,
  },
  emptyCopy: {
    marginTop: 4,
    textAlign: "center",
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    padding: Layout.spacing.lg,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.md,
  },
  studentName: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
  },
  wordLabel: {
    marginTop: 2,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.bold,
    textTransform: "capitalize",
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleText: {
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
  },
  badgeRow: {
    marginTop: Layout.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priorityBadge: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Layout.fonts.semibold,
    color: Colors.text.secondary,
    textTransform: "capitalize",
  },
  reasonsBox: {
    marginTop: Layout.spacing.sm,
    gap: 2,
  },
  reasonText: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 17,
  },
  cardFooter: {
    marginTop: Layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
  },
  reviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: Layout.spacing.md,
    backgroundColor: Colors.primary,
  },
  reviewButtonText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    width: "88%",
    maxWidth: 420,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    padding: Layout.spacing.lg,
  },
  modalTitle: {
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.semibold,
    color: Colors.text.secondary,
    textAlign: "center",
    textTransform: "capitalize",
  },
  modalHint: {
    marginTop: Layout.spacing.md,
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 17,
    textAlign: "center",
  },
  audioRow: {
    marginTop: Layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 20,
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: 8,
  },
  audioRowText: {
    color: Colors.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.semibold,
  },
  audioUnavailableText: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
  },
  scoreInput: {
    marginTop: Layout.spacing.lg,
    height: 56,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.background,
    textAlign: "center",
    fontSize: Layout.fontSize.xl,
    fontFamily: Layout.fonts.bold,
    color: Colors.text.primary,
  },
  modalButtonRow: {
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    gap: Layout.spacing.sm,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: Layout.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButton: {
    backgroundColor: Colors.background,
  },
  modalCancelText: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.semibold,
  },
  modalSubmitButton: {
    backgroundColor: Colors.primary,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: Colors.icon.muted,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
  },
});
