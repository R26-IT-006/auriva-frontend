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
import { useFocusEffect } from "@react-navigation/native";
import { teacherApi } from "../../../../../api/teacher";
import { API_BASE_URL, ENDPOINTS } from "../../../../../constants/api";
import { Colors } from "../../../../../constants/colors";
import { Layout } from "../../../../../constants/layout";
import { storage } from "../../../../../utils/storage";
import { getStudentIdentifier } from "./studentIdentity.js";

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

function getAverageScore(items) {
  if (!items.length) return 0;
  return Math.round(
    items.reduce((total, item) => total + Number(item.overall_score || 0), 0) /
      items.length,
  );
}

function getTrendText(results) {
  if (results.length < 2) return "Need more sessions";

  const chronological = [...results].reverse();
  const firstScore = Number(chronological[0]?.overall_score || 0);
  const latestScore = Number(chronological[chronological.length - 1]?.overall_score || 0);
  const difference = latestScore - firstScore;

  if (difference > 0) return `+${difference}% from first`;
  if (difference < 0) return `${difference}% from first`;
  return "No score change";
}

function buildSummary(results) {
  const phonemeMap = new Map();

  results.forEach((result) => {
    (result.phoneme_scores || []).forEach((entry) => {
      if (!entry?.text || Number(entry.score) >= 65) return;

      const current = phonemeMap.get(entry.text) || {
        text: entry.text,
        count: 0,
        totalScore: 0,
        positions: new Set(),
      };
      current.count += 1;
      current.totalScore += Number(entry.score || 0);
      if (entry.position) current.positions.add(entry.position);
      phonemeMap.set(entry.text, current);
    });
  });

  const weakPhonemes = [...phonemeMap.values()]
    .map((item) => ({
      text: item.text,
      count: item.count,
      averageScore: Math.round(item.totalScore / item.count),
      positions: [...item.positions],
    }))
    .sort((a, b) => b.count - a.count || a.averageScore - b.averageScore)
    .slice(0, 4);

  return {
    averageScore: getAverageScore(results),
    trendText: getTrendText(results),
    masteredCount: results.filter((result) => Number(result.overall_score) >= 80).length,
    audioCount: results.filter((result) => result.has_raw_audio).length,
    weakPhonemes,
    latestRecommendation:
      results.find((result) => result.recommendation_message)?.recommendation_message ||
      "No recommendation saved yet.",
  };
}

function SummaryMetric({ icon, label, value, color = Colors.primary }) {
  return (
    <View style={styles.summaryMetric}>
      <View style={[styles.summaryMetricIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryMetricLabel}>{label}</Text>
        <Text style={styles.summaryMetricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
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
  const studentId = getStudentIdentifier(student);
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
  const summary = useMemo(() => buildSummary(results), [results]);

  const fetchResults = useCallback(async () => {
    if (!studentId) return;

    try {
      const data = await teacherApi.getPronunciationResults(studentId);
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
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      fetchResults();
      const refreshTimer = setInterval(fetchResults, 5000);

      return () => clearInterval(refreshTimer);
    }, [fetchResults]),
  );

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
      const token = await storage.getToken();
      const audioUrl = `${API_BASE_URL}${ENDPOINTS.TEACHER_PRONUNCIATION_RESULT_AUDIO(result.id)}?stream=1`;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        {
          uri: audioUrl,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
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
            <View style={styles.summaryPanel}>
              <View style={styles.summaryHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Progress Summary</Text>
                  <Text style={styles.summarySubtitle}>
                    Teacher view of scores, weak sounds, and evidence
                  </Text>
                </View>
                <View
                  style={[
                    styles.summaryScoreBadge,
                    { borderColor: getScoreColor(summary.averageScore) },
                  ]}
                >
                  <Text
                    style={[
                      styles.summaryScoreText,
                      { color: getScoreColor(summary.averageScore) },
                    ]}
                  >
                    {summary.averageScore}%
                  </Text>
                  <Text style={styles.summaryScoreLabel}>avg</Text>
                </View>
              </View>

              <View style={styles.summaryGrid}>
                <SummaryMetric
                  icon="trending-up-outline"
                  label="Trend"
                  value={summary.trendText}
                  color={Colors.status.success}
                />
                <SummaryMetric
                  icon="checkmark-done-outline"
                  label="Mastered"
                  value={`${summary.masteredCount}/${results.length} sessions`}
                  color={Colors.status.success}
                />
                <SummaryMetric
                  icon="volume-high-outline"
                  label="Audio Evidence"
                  value={`${summary.audioCount}/${results.length} captured`}
                  color={Colors.primary}
                />
                <SummaryMetric
                  icon="sparkles-outline"
                  label="Latest Support"
                  value={summary.latestRecommendation}
                  color={Colors.status.warning}
                />
              </View>

              <View style={styles.weakSummary}>
                <Text style={styles.weakSummaryTitle}>Recurring Weak Sounds</Text>
                {summary.weakPhonemes.length ? (
                  <View style={styles.weakChipRow}>
                    {summary.weakPhonemes.map((item) => (
                      <View key={item.text} style={styles.weakChip}>
                        <Text style={styles.weakChipSound}>/{item.text}/</Text>
                        <Text style={styles.weakChipMeta}>
                          {item.count}x, avg {item.averageScore}%
                          {item.positions.length
                            ? `, ${item.positions.join("/")}`
                            : ""}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.weakEmptyText}>
                    No repeated weak phonemes detected yet.
                  </Text>
                )}
              </View>
            </View>

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
                      <View style={styles.recommendationContent}>
                        <Text style={styles.recommendationText}>
                          {selectedResult.recommendation_message}
                        </Text>
                        {(selectedResult.recommendation_details?.evidence || [])
                          .slice(0, 3)
                          .map((item, index) => (
                            <Text
                              key={`${item}-${index}`}
                              style={styles.recommendationEvidence}
                            >
                              {item}
                            </Text>
                          ))}
                        {!!selectedResult.recommendation_details?.selected_candidate && (
                          <View style={styles.candidateBox}>
                            <Text style={styles.candidateLabel}>
                              Recommended Word
                            </Text>
                            <Text style={styles.candidateValue}>
                              {selectedResult.recommendation_details.selected_candidate.word_id}
                            </Text>
                            <Text style={styles.candidateReason}>
                              {selectedResult.recommendation_details.selected_candidate.reason}
                            </Text>
                          </View>
                        )}
                      </View>
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
  summaryPanel: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Layout.radius.lg,
    backgroundColor: Colors.surface,
    padding: Layout.spacing.lg,
    marginBottom: Layout.spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Layout.spacing.md,
  },
  summarySubtitle: {
    marginTop: 4,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  summaryScoreBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryScoreText: {
    fontSize: Layout.fontSize.lg,
    fontWeight: Layout.fontWeight.bold,
  },
  summaryScoreLabel: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "uppercase",
  },
  summaryGrid: {
    marginTop: Layout.spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.sm,
  },
  summaryMetric: {
    width: "48%",
    minHeight: 72,
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.background,
    padding: Layout.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  summaryMetricIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryMetricLabel: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
  },
  summaryMetricValue: {
    marginTop: 3,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  weakSummary: {
    marginTop: Layout.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Layout.spacing.md,
  },
  weakSummaryTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontWeight: Layout.fontWeight.bold,
  },
  weakChipRow: {
    marginTop: Layout.spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.sm,
  },
  weakChip: {
    maxWidth: "48%",
    borderRadius: Layout.radius.md,
    backgroundColor: Colors.status.warningLight,
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
  },
  weakChipSound: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
  },
  weakChipMeta: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
  },
  weakEmptyText: {
    marginTop: Layout.spacing.sm,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.sm,
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
  recommendationContent: {
    flex: 1,
    gap: 6,
  },
  recommendationText: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    lineHeight: 20,
  },
  recommendationEvidence: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 17,
  },
  candidateBox: {
    marginTop: 4,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Layout.spacing.sm,
  },
  candidateLabel: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "uppercase",
  },
  candidateValue: {
    marginTop: 2,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.bold,
    textTransform: "capitalize",
  },
  candidateReason: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 17,
  },
});
