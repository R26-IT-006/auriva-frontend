# AURIVA — Frontend (React Native / Expo)

AURIVA is a tablet-based English learning platform for autistic children in Grades 1–3, developed as a final-year research project at SLIIT. This repository contains the shared mobile app used by teachers and children.

The platform has four learning modules, each developed by a different team member:

| Module | Focus |
|---|---|
| Concept learning | Vocabulary through visual categories |
| Dialogue learning | Word use in short conversations |
| **Handwriting and Motor Skill Analysis** | Letter writing practice and motor-skill reporting (this README's focus) |
| Pronunciation | Spoken word practice |

User roles: **Principal → Teacher → Student**. Children use the app under teacher supervision; handwriting data is only sent to the backend through authenticated teacher sessions.

---

## Technology stack

Versions are taken from `package.json`.

| Area | Technology |
|---|---|
| App framework | Expo ~54, React Native 0.81.5, React 19.1.0 |
| Navigation | React Navigation 7 (native-stack, bottom-tabs) |
| State | Zustand 5, React Context |
| Drawing | react-native-svg, React Native `PanResponder` |
| HTTP | Axios |
| Local storage | AsyncStorage, expo-secure-store |
| Audio / speech | expo-av, expo-audio, expo-speech |
| Reports | expo-print, expo-sharing (PDF export) |
| Tests | Jest 29 with babel-jest |

---

## Handwriting and Motor Skill Analysis component

The child flow is:

1. **Six-shape initial assessment** — horizontal line, vertical line, full circle, half circle, zigzag, curve wave.
2. **Adaptive letter practice** — lowercase and uppercase letters, three attempts per cycle with decreasing on-screen support.
3. **Word writing** — whole words, unlocked progressively as letters are completed (`src/utils/wordLetterUnlockPolicy.js`).
4. **Teacher reporting** — progress, motor-skill summaries and Writing Check results.

### Stroke capture and preprocessing

- Each canvas uses `PanResponder`. Every point is stored as `{ x, y, t, tAbs, stroke_id }`, where `t` is milliseconds since the stroke started and `tAbs` is an absolute timestamp. Multi-stroke attempts keep their stroke boundaries.
- Touches are mapped from page coordinates to canvas coordinates using the canvas origin from `View.measure()` (`src/utils/touchPointSanitize.js`). Points are clamped to the canvas, implausible single-event jumps are dropped, and points closer than 1.5 px are skipped. A stroke is kept only if it has more than two points.
- Before DTW, each path is translated to its own bounding-box origin and scaled **uniformly** so its larger side is 100 units (`dtw_norm_v1`, `src/utils/dtwNormalization.js`). This removes device size, position and overall letter size, while still penalising shape distortion.

### DTW comparison

`src/utils/dtw.js`:

- `computeDTW` — classic dynamic-programming DTW, O(n × m). The result is the accumulated cost divided by the warping-path length.
- Letter templates are resampled into 60 evenly spaced points along a Catmull-Rom/Bézier curve, the same curve used by the on-screen guide.
- `computeMultiStrokeDTW` — for multi-stroke letters, each child stroke is compared with each template stroke, and the best stroke assignment is chosen. Geometry is compared regardless of drawing order, but a small **stroke-order penalty (+5)** is added when the order differs from the template, and a penalty is added for each missing or extra stroke.
- **Letter DTW is direction-sensitive**: a letter drawn in reverse scores worse than the same path drawn forwards. Only the shape assessment uses direction-invariant DTW (forward and reversed, plus a rotation search for the full circle) in `src/utils/unifiedShapeScoreMirror.js`.

### Trajectory feature extraction

`src/utils/trajectoryFeatures.js` and the screens' `calculateDrawingFeatures()`:

| Feature | Definition |
|---|---|
| Smoothness | Mean turning angle between consecutive segments, in radians (lower is smoother) |
| Pauses | Gaps over 300 ms between consecutive points within a stroke |
| Distance | Sum of point-to-point distances within each stroke (never across a pen lift) |
| Speed mean / std / CV | Per-segment speeds within strokes |
| Attempt duration | From `tAbs`, covering the whole multi-stroke attempt |

### Scoring and adaptive practice

- **Shape assessment score** — `unifiedShapeScoreMirror.js`: 0.8 × direction-invariant DTW score + 0.2 × smoothness score. It mirrors the backend's canonical formula; a backend parity test checks they agree.
- **On-device attempt feedback** — `featuresToScore()` in `src/utils/adaptiveSequencing.js` (0.7 DTW + 0.3 smoothness) and the screen's pass check (smoothness, minimum size and DTW < 22). These drive the instant feedback only. **Mastery is decided by the backend** from the attempt-3 Motor Score.
- **Rule-based adaptive sequencing** — `calculateMotorProfile()` / `generateAdaptiveSequence()` compare the straight and curved shape-family scores with a 10-point buffer and put the stronger category first; mixed letters come last. This is deterministic and **does not use machine learning**.
- **Support levels** — attempt 1 high support, attempt 2 reduced support, attempt 3 independent (`src/constants/handwritingSupportLevels.js`).
- **Practice cycles** — up to three 3-attempt cycles per letter per day (`src/utils/letterCycleGuard.js`). After a second failed cycle the child is given a short motor warm-up before cycle 3 (when warm-up activities exist for that letter). A device capture fault does not use up a cycle; a failed network submission keeps the child on attempt 3 so it can be resent.

### Teacher-facing reporting

- **Teacher report** (`src/screens/handwriting/reports/TeacherReportScreen.js`) — Initial Handwriting Skills Summary, letter progress, Letter Motor Development and Writing Check history.
- **Periodic report** (`src/components/handwriting/reports/PeriodicReportSection.js`, `src/utils/periodicReportPdf.js`) — a date-range report with PDF export.
- **Writing Check** (`src/screens/handwriting/WritingCheckScreen.js`) — a teacher-started check of 20 reference letters whose result comes from the backend's Letter V1 model. Pattern labels are neutral descriptions, not ability levels or diagnoses (`src/utils/letterMotorPatternLabels.js`).

---

## Main source locations

```
src/
├── api/                    # Axios client and endpoint helpers (client.js is shared team code)
├── components/handwriting/ # Writing stages, demo animation, report sections
├── constants/              # api.js (endpoints), support levels, letter categories
├── navigation/             # App navigators, incl. HandwritingNavigator.js
├── research/               # Experimental scoring candidate (not used by the app)
├── screens/
│   └── handwriting/        # Assessment, letter, uppercase/, words/, WritingCheck, reports/
├── store/                  # Zustand auth store
└── utils/                  # DTW, normalization, features, sequencing, reports, tests
```

| Topic | File |
|---|---|
| Letter capture and attempt flow | `src/screens/handwriting/LetterWritingScreen.js` |
| Shape assessment | `src/screens/handwriting/ShapeAssessmentScreen.js` |
| DTW and multi-stroke matching | `src/utils/dtw.js` |
| Normalization | `src/utils/dtwNormalization.js` |
| Touch sanitization | `src/utils/touchPointSanitize.js` |
| Trajectory features | `src/utils/trajectoryFeatures.js` |
| Shape score (mirror) | `src/utils/unifiedShapeScoreMirror.js` |
| Adaptive sequencing | `src/utils/adaptiveSequencing.js` |
| Cycle limit | `src/utils/letterCycleGuard.js` |
| Word scoring | `src/utils/wordScoring.js` |

---

## Installation and running

Prerequisites: Node.js and npm, the Expo tooling (`npx expo`), and an Android emulator or a tablet with Expo Go. The AURIVA backend (separate `auriva-backend` repository) must be running and reachable.

```bash
npm install
```

Set the backend address in `src/constants/api.js`:

```js
export const API_BASE_URL = "http://<your-lan-ip>:<port>/api";
```

Use your machine's LAN address rather than `localhost` when running on a physical device. (The `API_BASE_URL` entry in `.env.example` is not currently read by the code.)

```bash
npm start            # expo start
npm run android      # build and run on Android
```

---

## Testing

```bash
npm test                              # all Jest tests
npx jest src/utils/dtw.test.js        # a single file
```

Jest runs in a Node environment over `src/utils/**/*.test.js` and `src/research/**/*.test.js` (about 140 files). The tests cover pure logic — DTW, normalization, features, sequencing, cycle rules, report building — and do not run on a device. There are no end-to-end UI tests.


---

## Individual contribution — Handwriting and Motor Skill Analysis

**Liluksha (IT22216700)** designed and implemented the handwriting component in this repository: the handwriting screens and navigator, stroke capture and touch sanitization, DTW and normalization, trajectory features, shape scoring, rule-based adaptive sequencing, practice-cycle handling, word writing, Writing Check and the handwriting teacher reports.

Selected commits (author `Liluksha`):

| Commit | Date | Added |
|---|---|---|
| `6262afd` | 2026-04-10 | First handwriting module, on branch `feature/handwriting-IT22216700` |
| `e7e5d93` | 2026-05-08 | `adaptiveSequencing.js`, `LetterWritingScreen.js`, `TeacherReportScreen.js` |
| `ea00bd0` | 2026-07-01 | `dtw.js` |
| `ec83149` | 2026-08-04 | `dtwNormalization.js`, `dtw.test.js` |
| `4d35339` | 2026-08-13 | `trajectoryFeatures.js` |
| `aab3251` | 2026-08-18 | `unifiedShapeScoreMirror.js` |
| `2f339a9` | 2026-08-19 | `touchPointSanitize.js` |

Personal-branch work was merged into the team branch through pull request #16 and integration merges by the team integrator.

**Team-level code used by this component** (not part of the individual contribution): the app shell and `AppNavigator.js`, `ParentGateModal.js`, the auth store, and most of the shared Axios client `src/api/client.js`.

---

Developed as part of a final-year research project at SLIIT. All rights reserved by the respective authors.
