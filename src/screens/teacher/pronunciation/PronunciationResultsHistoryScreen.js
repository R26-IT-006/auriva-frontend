import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import { teacherApi } from "../../../api/teacher";
import { Colors } from "../../../constants/colors";
import { Layout } from "../../../constants/layout";
import { getAvatarTheme } from "../../../constants/avatarThemes";
import {
  PronunciationAlert,
  usePronunciationAlert,
} from "./PronunciationAlert.js";
import { getStudentIdentifier } from "./studentIdentity.js";
import { AvatarIdentityBadge } from "./pronunciationDesignKit.js";
import {
  buildGopPhonemeComparison,
  buildMfccDtwPhonemeComparison,
  buildPronunciationHistorySummary,
  buildSelectedSessionComparison,
  formatDateTime,
  getScoringEvidence,
  getScoreColor,
  getVerificationSummary,
  HISTORY_REFRESH_INTERVAL_MS,
} from "./pronunciationHistory.js";

function PhonemeRow({ item, realized }) {
  const score = item?.score ?? 0;
  return (
    <View style={styles.phonemeRow}>
      <View style={styles.phonemeTag}>
        <Text style={styles.phonemeText}>{item?.text || "/-/"}</Text>
      </View>
      <View style={styles.phonemeRowMain}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${score}%`, backgroundColor: getScoreColor(score) },
            ]}
          />
        </View>
        {realized ? (
          <Text style={styles.realizedText}>Heard as /{realized}/</Text>
        ) : null}
      </View>
      <Text style={styles.phonemeScore}>{score}%</Text>
    </View>
  );
}

function VerificationPanel({ verification }) {
  if (!verification) return null;

  const { recognizedText, scoringMethodLabel, confidenceLevel, needsReview } = verification;

  return (
    <View style={styles.verificationBox}>
      <View style={styles.verificationHeader}>
        <View style={styles.verificationIcon}>
          <Ionicons
            name={needsReview ? "help-circle-outline" : "checkmark-circle-outline"}
            size={18}
            color={needsReview ? Colors.status.warning : Colors.status.success}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.verificationTitle}>
            {recognizedText ? `Heard "${recognizedText}"` : "Word verification"}
          </Text>
          <Text style={styles.verificationMeta}>{scoringMethodLabel}</Text>
        </View>
        {confidenceLevel ? (
          <View
            style={[
              styles.confidenceChip,
              confidenceLevel === "low" && styles.confidenceChipLow,
            ]}
          >
            <Text
              style={[
                styles.confidenceChipText,
                confidenceLevel === "low" && styles.confidenceChipTextLow,
              ]}
            >
              {confidenceLevel} confidence
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
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

function formatDelta(value) {
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return "0%";
}

function getDeltaColor(value) {
  if (value > 0) return Colors.status.success;
  if (value < 0) return Colors.status.error;
  return Colors.text.secondary;
}

function SessionComparison({ comparison }) {
  if (!comparison) return null;

  const { previousResult, scoreDelta, phonemeDeltas } = comparison;

  return (
    <View style={styles.comparisonBox}>
      <View style={styles.comparisonHeader}>
        <View style={styles.comparisonIcon}>
          <Ionicons name="git-compare-outline" size={18} color={Colors.primary} />
        </View>
        <View style={styles.comparisonTitleWrap}>
          <Text style={styles.comparisonTitle}>Previous Word Attempt</Text>
          <Text style={styles.comparisonMeta}>
            Session {previousResult.session_number}, {formatDateTime(previousResult.created_at)}
          </Text>
        </View>
        <View style={styles.comparisonScores}>
          <Text style={styles.previousScoreText}>{previousResult.overall_score}%</Text>
          <Text
            style={[
              styles.deltaText,
              { color: getDeltaColor(scoreDelta) },
            ]}
          >
            {formatDelta(scoreDelta)}
          </Text>
        </View>
      </View>

      {phonemeDeltas.length ? (
        <View style={styles.deltaChipRow}>
          {phonemeDeltas.slice(0, 4).map((item, index) => (
            <View key={`${item.text}-${index}`} style={styles.deltaChip}>
              <Text style={styles.deltaChipSound}>{item.text}</Text>
              <Text
                style={[
                  styles.deltaChipValue,
                  { color: getDeltaColor(item.delta) },
                ]}
              >
                {formatDelta(item.delta)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function getRecordingQuality(audioQuality) {
  const snr = Number(audioQuality?.snr_db);
  if (!Number.isFinite(snr)) return null;
  if (snr >= 15) {
    return { label: "Clear recording", color: Colors.status.success, icon: "checkmark-circle" };
  }
  if (snr >= 8) {
    return { label: "Some background noise", color: Colors.status.warning, icon: "alert-circle-outline" };
  }
  return { label: "Noisy recording", color: Colors.status.error, icon: "warning-outline" };
}

function getPaceDescription(comparison) {
  const ratios = (comparison?.rows || [])
    .map((row) => Number(row.durationRatio))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!ratios.length) return null;

  const average = ratios.reduce((total, value) => total + value, 0) / ratios.length;
  if (average > 1.3) {
    return "Spoke slower than the example — that's okay, pace never affects the score.";
  }
  if (average < 0.75) {
    return "Spoke faster than the example — that's okay, pace never affects the score.";
  }
  return "Spoke at a similar pace to the example word.";
}

function AudioAnalysisPanel({ comparison }) {
  if (!comparison) return null;

  const quality = getRecordingQuality(comparison.audioQuality);
  const pace = getPaceDescription(comparison);
  if (!quality && !pace) return null;

  return (
    <View style={styles.audioAnalysisBox}>
      <View style={styles.audioAnalysisHeader}>
        <View style={styles.audioAnalysisIcon}>
          <Ionicons name="mic-outline" size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.audioAnalysisTitle}>About This Recording</Text>
          <Text style={styles.audioAnalysisMeta}>
            Compared with the example word recording
          </Text>
        </View>
      </View>

      {quality ? (
        <View style={styles.recordingFactRow}>
          <Ionicons name={quality.icon} size={16} color={quality.color} />
          <Text style={[styles.recordingFactText, { color: quality.color }]}>
            {quality.label}
          </Text>
        </View>
      ) : null}
      {pace ? (
        <View style={styles.recordingFactRow}>
          <Ionicons name="time-outline" size={16} color={Colors.text.secondary} />
          <Text style={styles.recordingFactText}>{pace}</Text>
        </View>
      ) : null}
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
  const theme = getAvatarTheme(student?.avatar_key);
  const { showAlert, alertProps } = usePronunciationAlert();
  const [results, setResults] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  const soundRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedId) || results[0],
    [results, selectedId],
  );
  const selectedActivityCount = useMemo(() => {
    if (!selectedResult) return 0;
    return 1 + (selectedResult.listen_choose_data ? 1 : 0);
  }, [selectedResult]);
  const summary = useMemo(
    () => buildPronunciationHistorySummary(results),
    [results],
  );
  const selectedComparison = useMemo(
    () => buildSelectedSessionComparison(results, selectedResult),
    [results, selectedResult],
  );
  const selectedAudioComparison = useMemo(
    () =>
      buildMfccDtwPhonemeComparison({
        phonemeScores: selectedResult?.phoneme_scores || [],
        evidence: getScoringEvidence(selectedResult),
      }),
    [selectedResult],
  );
  const selectedGopComparison = useMemo(
    () =>
      buildGopPhonemeComparison({
        phonemeScores: selectedResult?.phoneme_scores || [],
        evidence: getScoringEvidence(selectedResult),
      }),
    [selectedResult],
  );
  const selectedVerification = useMemo(
    () => getVerificationSummary(selectedResult),
    [selectedResult],
  );

  const fetchResults = useCallback(async () => {
    if (!studentId) return;
    if (requestInFlightRef.current) return;

    requestInFlightRef.current = true;
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
      requestInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useFocusEffect(
    useCallback(() => {
      fetchResults();
      const refreshTimer = setInterval(
        fetchResults,
        HISTORY_REFRESH_INTERVAL_MS,
      );

      return () => clearInterval(refreshTimer);
    }, [fetchResults]),
  );

  useEffect(() => {
    setActivitiesOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (results.length === 0) {
      stopAudio();
    }
  }, [results.length]);

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
      const audioBase64 = audio?.raw_audio_base64;
      const audioMimeType = audio?.raw_audio_mime_type || "audio/mp4";

      if (!audioBase64) {
        throw new Error("No saved audio was returned for this session.");
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        {
          uri: `data:${audioMimeType};base64,${audioBase64}`,
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
      showAlert(
        "Playback error",
        error.message || "Unable to play this recording right now.",
        { tone: "error" },
      );
    } finally {
      setLoadingAudioId(null);
    }
  }

  if (!student) return null;

  return (
    <LinearGradient colors={theme.backgroundGradient} style={styles.safeOuter}>
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
          <View style={styles.headerIdentity}>
            <AvatarIdentityBadge
              avatarKey={student?.avatar_key}
              theme={theme}
              size={44}
            />
            <Text style={[styles.title, { color: theme.headingText }]}>
              {student.full_name}
            </Text>
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
                      <Text style={styles.metricLabel}>Speaking Time</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.response_duration != null
                          ? `${selectedResult.response_duration} s`
                          : "-"}
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Thinking Time</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.hesitation_time != null
                          ? `${selectedResult.hesitation_time} s`
                          : "-"}
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Attempt</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.attempt_number}
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricLabel}>Speech Type</Text>
                      <Text style={styles.metricValue}>
                        {selectedResult.heard_reference_audio
                          ? "Imitated"
                          : "Independent"}
                      </Text>
                    </View>
                    {!!selectedResult.recommendation_details?.needs_teacher_review && (
                      <View style={[styles.metricBox, styles.reviewMetricBox]}>
                        <Text style={[styles.metricLabel, styles.reviewMetricLabel]}>Review</Text>
                        <Text style={[styles.metricValue, styles.reviewMetricValue]}>
                          Please listen
                        </Text>
                      </View>
                    )}
                  </View>

                  <VerificationPanel verification={selectedVerification} />
                  <SessionComparison comparison={selectedComparison} />
                  <AudioAnalysisPanel comparison={selectedAudioComparison} />

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
                                  {selectedResult.listen_choose_data.activity_type === "sound_focus_listen_choose"
                                    ? `Sound Focus: /${selectedResult.listen_choose_data.target_phoneme}/`
                                    : "Listen and Choose"}
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
                            </View>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.breakdownTitle}>Sound Breakdown</Text>
                  {(selectedResult.phoneme_scores || []).map((item, index) => {
                    const gopRow = selectedGopComparison?.rows?.[index];
                    return (
                      <PhonemeRow
                        key={`${item?.text}-${index}`}
                        item={item}
                        realized={gopRow?.mismatchedRealization ? gopRow.realized : null}
                      />
                    );
                  })}

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
                        {!!selectedResult.recommendation_details?.needs_teacher_review && (
                          <View style={styles.candidateBox}>
                            <Text style={styles.candidateLabel}>
                              Please Double-Check
                            </Text>
                            <Text style={styles.candidateReason}>
                              The system was not fully confident about this score.
                              Listen to the recording before deciding the next step.
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

      <PronunciationAlert {...alertProps} theme={theme} />
    </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1 },
  safe: { flex: 1 },
  scroll: { padding: Layout.spacing.lg, paddingBottom: Layout.spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Layout.spacing.lg,
  },
  headerIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  title: {
    fontSize: Layout.fontSize.xl,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.semibold,
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
    fontFamily: Layout.fonts.bold,
  },
  summaryScoreLabel: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.semibold,
  },
  summaryMetricValue: {
    marginTop: 3,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
  },
  detailSectionTitle: {
    fontSize: Layout.fontSize.md,
    color: Colors.text.primary,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.semibold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
  },
  sessionTitleActive: { color: Colors.primary },
  sessionWord: {
    marginTop: Layout.spacing.sm,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.semibold,
  },
  wordText: {
    marginTop: 4,
    fontSize: 34,
    color: Colors.text.primary,
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.semibold,
  },
  metricValue: {
    marginTop: 4,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
    textTransform: "capitalize",
  },
  reviewMetricBox: {
    backgroundColor: Colors.status.reviewLight,
    borderWidth: 1,
    borderColor: Colors.status.reviewBorder,
  },
  reviewMetricLabel: {
    color: Colors.status.review,
  },
  reviewMetricValue: {
    color: Colors.status.review,
  },
  verificationBox: {
    marginTop: Layout.spacing.lg,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceAlt,
    padding: Layout.spacing.md,
  },
  verificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  verificationIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  verificationTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
    textTransform: "capitalize",
  },
  verificationMeta: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
  },
  confidenceChip: {
    minHeight: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.status.successLight,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  confidenceChipLow: {
    backgroundColor: Colors.status.warningLight,
    borderColor: "#FDE68A",
  },
  confidenceChipText: {
    fontSize: 11,
    fontFamily: Layout.fonts.bold,
    color: Colors.status.success,
    textTransform: "capitalize",
  },
  confidenceChipTextLow: {
    color: Colors.status.review,
  },
  comparisonBox: {
    marginTop: Layout.spacing.lg,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: "#D8E2FF",
    backgroundColor: Colors.status.infoLight,
    padding: Layout.spacing.md,
  },
  comparisonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  comparisonIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonTitleWrap: {
    flex: 1,
  },
  comparisonTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
  },
  comparisonMeta: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
  },
  comparisonScores: {
    alignItems: "flex-end",
  },
  previousScoreText: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
  },
  deltaText: {
    marginTop: 2,
    fontSize: Layout.fontSize.lg,
    fontFamily: Layout.fonts.bold,
  },
  deltaChipRow: {
    marginTop: Layout.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Layout.spacing.sm,
  },
  deltaChip: {
    minHeight: 34,
    borderRadius: Layout.radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Layout.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.xs,
  },
  deltaChipSound: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
  },
  deltaChipValue: {
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
  },
  audioAnalysisBox: {
    marginTop: Layout.spacing.lg,
    borderRadius: Layout.radius.md,
    borderWidth: 1,
    borderColor: "#D8E2FF",
    backgroundColor: Colors.surface,
    padding: Layout.spacing.md,
  },
  audioAnalysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  audioAnalysisIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.status.infoLight,
    alignItems: "center",
    justifyContent: "center",
  },
  audioAnalysisTitle: {
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.bold,
  },
  audioAnalysisMeta: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 16,
  },
  recordingFactRow: {
    marginTop: Layout.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
  },
  recordingFactText: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.sm,
    fontFamily: Layout.fonts.semibold,
    lineHeight: 19,
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
    fontFamily: Layout.fonts.bold,
  },
  activitiesSubtitle: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
  },
  listenChooseStats: {
    marginTop: Layout.spacing.sm,
    gap: 3,
  },
  listenChooseStatText: {
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
  },
  breakdownTitle: {
    marginTop: Layout.spacing.lg,
    marginBottom: Layout.spacing.sm,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
  },
  phonemeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  phonemeRowMain: {
    flex: 1,
    gap: 3,
  },
  realizedText: {
    color: Colors.status.warning,
    fontSize: Layout.fontSize.xs,
    fontFamily: Layout.fonts.semibold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
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
    fontFamily: Layout.fonts.bold,
    textTransform: "uppercase",
  },
  candidateValue: {
    marginTop: 2,
    color: Colors.text.primary,
    fontSize: Layout.fontSize.md,
    fontFamily: Layout.fonts.bold,
    textTransform: "capitalize",
  },
  candidateReason: {
    marginTop: 2,
    color: Colors.text.secondary,
    fontSize: Layout.fontSize.xs,
    lineHeight: 17,
  },
});
