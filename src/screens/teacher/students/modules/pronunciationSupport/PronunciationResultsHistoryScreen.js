import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { teacherApi } from "../../../../../api/teacher";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";

function getScoreColor(score) {
  if (score >= 80) return Colors.status.success;
  if (score >= 60) return Colors.status.warning;
  return Colors.status.error;
}

function formatDateTime(value) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PhonemeRow({ item }) {
  const score = item?.score ?? 0;
  return (
    <View style={styles.phonemeRow}>
      <View style={styles.phonemeTag}>
        <Text style={styles.phonemeText}>{item?.text || "/-/"}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${score}%`, backgroundColor: getScoreColor(score) },
          ]}
        />
      </View>
      <Text style={styles.phonemeScore}>{score}%</Text>
    </View>
  );
}

function SessionTab({ result, isSelected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.sessionTab, isSelected && styles.sessionTabActive]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <View style={styles.sessionTabTop}>
        <Text
          style={[
            styles.sessionTitle,
            isSelected && styles.sessionTitleActive,
          ]}
          numberOfLines={1}
        >
          Session {result.session_number}
        </Text>
        <View
          style={[
            styles.scorePill,
            { backgroundColor: getScoreColor(result.overall_score) },
          ]}
        >
          <Text style={styles.scorePillText}>{result.overall_score}%</Text>
        </View>
      </View>
      <Text style={styles.sessionWord} numberOfLines={1}>
        {result.word_label || "Pronunciation"}
      </Text>
      {result.workflow_completed ? (
        <View style={styles.completedPill}>
          <Ionicons
            name="checkmark-circle"
            size={13}
            color={Colors.status.success}
          />
          <Text style={styles.completedPillText}>Completed</Text>
        </View>
      ) : null}
      <Text style={styles.sessionMeta} numberOfLines={1}>
        {formatDateTime(result.created_at)}
      </Text>
    </TouchableOpacity>
  );
}

export default function PronunciationResultsHistoryScreen({ route }) {
  const student = route.params?.student;
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const soundRef = useRef(null);

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedId) || results[0],
    [results, selectedId],
  );
  const selectedActivityCount = useMemo(() => {
    if (!selectedResult) return 0;
    return 1 + (selectedResult.listen_choose_data ? 1 : 0);
  }, [selectedResult]);

  const fetchResults = useCallback(async () => {
    if (!student?.sid) return;

    try {
      const data = await teacherApi.getPronunciationResults(student.sid);
      setResults(data);
      setSelectedId((currentId) => {
        if (data.some((result) => result.id === currentId)) return currentId;
        return data[0]?.id ?? null;
      });
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student?.sid]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    setActivitiesOpen(false);
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  async function stopAudio() {
    if (!soundRef.current) return;

    await soundRef.current.unloadAsync().catch(() => {});
    soundRef.current = null;
    setPlayingId(null);
  }

  async function handlePlayAudio(result) {
    if (!result?.has_raw_audio) return;

    if (playingId === result.id) {
      await stopAudio();
      return;
    }

    setLoadingAudioId(result.id);

    try {
      await stopAudio();
      const audio = await teacherApi.getPronunciationResultAudio(result.id);
      const mimeType = audio.raw_audio_mime_type || "audio/mp4";
      const dataUri = `data:${mimeType};base64,${audio.raw_audio_base64}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { shouldPlay: true },
      );

      soundRef.current = sound;
      setPlayingId(result.id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) {
            soundRef.current = null;
            setPlayingId(null);
          }
        }
      });
    } catch (error) {
      Alert.alert(
        "Playback error",
        error.message || "Unable to play this recording right now.",
      );
    } finally {
      setLoadingAudioId(null);
    }
  }

  if (!student) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchResults();
            }}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Pronunciation Support</Text>
            <Text style={styles.title}>{student.full_name}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{results.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="mic-outline" size={28} color={Colors.icon.muted} />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyCopy}>
              Saved pronunciation results for this student will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sessions</Text>
              <Text style={styles.sectionHint}>Tap a session to view it</Text>
            </View>
            <FlatList
              horizontal
              data={results}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <SessionTab
                  result={item}
                  isSelected={selectedResult?.id === item.id}
                  onPress={() => setSelectedId(item.id)}
                />
              )}
              contentContainerStyle={styles.sessionTabs}
              showsHorizontalScrollIndicator={false}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
            />

            {selectedResult && (
              <>
                <Text style={styles.detailSectionTitle}>Session Details</Text>
                <View style={styles.detailCard}>
                  <View style={styles.detailTop}>
                    <View>
                      <Text style={styles.detailLabel}>
                        Session {selectedResult.session_number}
                      </Text>
                      <Text style={styles.wordText}>
                        {selectedResult.word_label}
                      </Text>
                      {selectedResult.workflow_completed ? (
                        <View style={styles.completedPill}>
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color={Colors.status.success}
                          />
                          <Text style={styles.completedPillText}>
                            Completed
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.scoreCircle,
                        {
                          borderColor: getScoreColor(
                            selectedResult.overall_score,
                          ),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scoreCircleText,
                          {
                            color: getScoreColor(selectedResult.overall_score),
                          },
                        ]}
                      >
                        {selectedResult.overall_score}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsGrid}>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Mode</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.mode === "alphabet"
                          ? "Alphabet"
                          : "Word"}
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Response</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.response_duration ?? "-"} s
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Pause</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.hesitation_time ?? "-"} s
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Attempt</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.attempt_number}
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Audio</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.has_raw_audio ? "Captured" : "Missing"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.activitiesSection}>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => setActivitiesOpen((value) => !value)}
                      style={styles.activitiesToggle}
                    >
                      <View style={styles.activitiesToggleLeft}>
                        <View style={styles.activitiesIcon}>
                          <Ionicons
                            name="albums-outline"
                            size={18}
                            color={Colors.primary}
                          />
                        </View>
                        <View>
                          <Text style={styles.activitiesTitle}>Activities</Text>
                          <Text style={styles.activitiesSubtitle}>
                            {selectedActivityCount} saved activit{selectedActivityCount === 1 ? "y" : "ies"}
                          </Text>
                        </View>
                      </View>
                      <Ionicons
                        name={activitiesOpen ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={Colors.text.secondary}
                      />
                    </TouchableOpacity>

                    {activitiesOpen ? (
                      <View style={styles.activitiesBody}>
                        <View style={styles.audioCard}>
                          <View style={styles.audioInfo}>
                            <View style={styles.audioIcon}>
                              <Ionicons
                                name="volume-high-outline"
                                size={18}
                                color={Colors.primary}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.audioTitle}>Audio Capture</Text>
                              <Text style={styles.audioMeta}>
                                {selectedResult.has_raw_audio
                                  ? "Recorded audio is available for this session."
                                  : "No audio was captured for this session."}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={[
                              styles.playButton,
                              !selectedResult.has_raw_audio &&
                                styles.playButtonDisabled,
                            ]}
                            activeOpacity={0.82}
                            disabled={
                              !selectedResult.has_raw_audio ||
                              loadingAudioId === selectedResult.id
                            }
                            onPress={() => handlePlayAudio(selectedResult)}
                          >
                            {loadingAudioId === selectedResult.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Ionicons
                                name={
                                  playingId === selectedResult.id ? "stop" : "play"
                                }
                                size={16}
                                color="#FFFFFF"
                              />
                            )}
                            <Text style={styles.playButtonText}>
                              {playingId === selectedResult.id ? "Stop" : "Play"}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {!!selectedResult.listen_choose_data && (
                          <View style={styles.listenChooseCard}>
                            <View style={styles.listenChooseHeader}>
                              <View style={styles.listenChooseIcon}>
                                <Ionicons
                                  name="ear-outline"
                                  size={18}
                                  color={Colors.primary}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.listenChooseTitle}>
                                  Listen and Choose
                                </Text>
                                <Text style={styles.listenChooseMeta}>
                                  Heard "{selectedResult.listen_choose_data.target_word_label || selectedResult.word_label}"
                                  {selectedResult.listen_choose_data.selected_choice_label
                                    ? `, chose "${selectedResult.listen_choose_data.selected_choice_label}"`
                                    : ""}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.listenChooseStatus,
                                  selectedResult.listen_choose_data.is_correct
                                    ? styles.listenChooseStatusCorrect
                                    : styles.listenChooseStatusReview,
                                ]}
                              >
                                <Ionicons
                                  name={
                                    selectedResult.listen_choose_data.is_correct
                                      ? "checkmark"
                                      : "refresh"
                                  }
                                  size={14}
                                  color={
                                    selectedResult.listen_choose_data.is_correct
                                      ? Colors.status.success
                                      : Colors.status.warning
                                  }
                                />
                                <Text
                                  style={[
                                    styles.listenChooseStatusText,
                                    {
                                      color: selectedResult.listen_choose_data.is_correct
                                        ? Colors.status.success
                                        : Colors.status.warning,
                                    },
                                  ]}
                                >
                                  {selectedResult.listen_choose_data.is_correct
                                    ? "Correct"
                                    : "Review"}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.listenChooseStats}>
                              <Text style={styles.listenChooseStatText}>
                                Attempts: {selectedResult.listen_choose_data.attempts || 1}
                              </Text>
                              <Text style={styles.listenChooseStatText}>
                                Choices: {(selectedResult.listen_choose_data.choice_ids || []).join(", ")}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.breakdownTitle}>Sound Breakdown</Text>
                  {(selectedResult.phoneme_scores || []).map((item, index) => (
                    <PhonemeRow key={`${item?.text}-${index}`} item={item} />
                  ))}

                  {!!selectedResult.recommendation_message && (
                    <View style={styles.recommendationBox}>
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color={Colors.primary}
                      />
                      <Text style={styles.recommendationText}>
                        {selectedResult.recommendation_message}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Layout.spacing.lg,
  },
  eyebrow: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    fontWeight: Layout.fontWeight.semibold,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 4,
    fontSize: Layout.fontSize.xl,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
  },
  countBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.bold,
  },
  sectionTitle: {
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
  },
  detailSectionTitle: {
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
    marginBottom: Layout.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.md,
    marginBottom: Layout.spacing.sm,
  },
  sectionHint: {
    flexShrink: 1,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    textAlign: "right",
  },
  emptyCard: {
    minHeight: 180,
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
    fontWeight: Layout.fontWeight.bold,
  },
  emptyCopy: {
    marginTop: 4,
    textAlign: "center",
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.sm,
  },
  sessionTabs: {
    gap: Layout.spacing.sm,
    paddingBottom: Layout.spacing.lg,
  },
  sessionTab: {
    width: 188,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    padding: Layout.spacing.md,
  },
  sessionTabActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.status.infoLight,
  },
  sessionTabTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.sm,
  },
  sessionTitle: {
    flex: 1,
    fontSize: Layout.fontSize.sm,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
  },
  sessionTitleActive: { color: Colors.primary },
  sessionWord: {
    marginTop: Layout.spacing.sm,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "capitalize",
  },
  sessionMeta: {
    marginTop: 3,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
  },
  completedPill: {
    alignSelf: "flex-start",
    marginTop: Layout.spacing.xs,
    minHeight: 24,
    borderRadius: 12,
    backgroundColor: Colors.status.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  completedPillText: {
    color: Colors.status.success,
    fontSize: 11,
    fontWeight: Layout.fontWeight.bold,
  },
  scorePill: {
    minWidth: 50,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Layout.spacing.sm,
  },
  scorePillText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    padding: Layout.spacing.lg,
  },
  detailTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.md,
  },
  detailLabel: {
    fontSize: Layout.fontSize.xs,
    color: Colors.text.secondary,
    fontWeight: Layout.fontWeight.semibold,
  },
  wordText: {
    marginTop: 4,
    fontSize: 34,
    color: Colors.text.primary,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "capitalize",
  },
  scoreCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleText: {
    fontSize: Layout.fontSize.xl,
    fontWeight: Layout.fontWeight.bold,
  },
  metricsGrid: {
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.sm,
  },
  metricBox: {
    width: "48%",
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.background,
    padding: Layout.spacing.md,
  },
  metricLabel: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  metricValue: {
    marginTop: 4,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "capitalize",
  },
  activitiesSection: {
    marginTop: Layout.spacing.lg,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceAlt,
    overflow: "hidden",
  },
  activitiesToggle: {
    minHeight: 64,
    padding: Layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.md,
  },
  activitiesToggleLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  activitiesIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  activitiesTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
  },
  activitiesSubtitle: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  activitiesBody: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    padding: Layout.spacing.md,
  },
  audioCard: {
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Layout.spacing.md,
    gap: Layout.spacing.md,
  },
  listenChooseCard: {
    marginTop: Layout.spacing.lg,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.status.infoLight,
    borderWidth: 1,
    borderColor: "#D8E2FF",
    padding: Layout.spacing.md,
  },
  listenChooseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  listenChooseIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  listenChooseTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  listenChooseMeta: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 17,
  },
  listenChooseStatus: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  listenChooseStatusCorrect: {
    backgroundColor: Colors.status.successLight,
    borderColor: "#BBF7D0",
  },
  listenChooseStatusReview: {
    backgroundColor: Colors.status.warningLight,
    borderColor: "#FDE68A",
  },
  listenChooseStatusText: {
    fontSize: 11,
    fontWeight: Layout.fontWeight.bold,
  },
  listenChooseStats: {
    marginTop: Layout.spacing.sm,
    gap: 3,
  },
  listenChooseStatText: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  audioInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  audioIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.status.infoLight,
    alignItems: "center",
    justifyContent: "center",
  },
  audioTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  audioMeta: {
    marginTop: 3,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
  },
  playButton: {
    alignSelf: "flex-start",
    minWidth: 104,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Layout.spacing.xs,
    paddingHorizontal: Layout.spacing.md,
  },
  playButtonDisabled: {
    backgroundColor: Colors.icon.muted,
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  breakdownTitle: {
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
  },
  phonemeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  phonemeTag: {
    width: 44,
    height: 34,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  phonemeText: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 6 },
  phonemeScore: {
    width: 44,
    textAlign: "right",
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  recommendationBox: {
    marginTop: Layout.spacing.md,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.status.infoLight,
    padding: Layout.spacing.md,
    flexDirection: "row",
    gap: Layout.spacing.sm,
  },
  recommendationText: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    lineHeight: 20,
  },
});
