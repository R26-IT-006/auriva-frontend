# Auriva — Adaptive Learning Platform for Autistic Children

Auriva is a tablet-based English language learning platform designed for autistic children in Sri Lanka (Grades 1–3). It delivers personalised, evidence-based instruction across four integrated learning modules: concept vocabulary, dialogue, handwriting, and pronunciation. Each module applies Graph Neural Network inference, structured ABA (Applied Behaviour Analysis) mastery criteria, and adaptive sequencing to meet the distinct sensory and motor profiles of each learner.

---

## Modules

### Module 1 — GNN-Enhanced Adaptive Concept Learning
Introduces English vocabulary through a structured three-tier framework aligned with ABA principles:

| Tier | Name | Goal |
|------|------|------|
| 1 | Visual Familiarisation | Associate word with image |
| 2 | Single-Word Recognition | Identify target word among distractors |
| 3 | Attribute Introduction | Understand colour, size, and contextual attributes |

A **Graph Knowledge Base (GKB)** maintains two layers — a static curriculum graph (categories → concepts) and a dynamic interaction graph (student engagement, confusion signals, scores). A GNN trained over this graph drives:
- Confusion detection
- Adaptive learning-path recommendation
- Difficulty prediction
- Student clustering for group-level insights

A Gemini LLM integration generates vocabulary-constrained teacher feedback reports.

### Module 2 — Adaptive Dialogue Learning
Three-phase word acquisition (Familiarisation → Production → Contextual Understanding) using:
- Vocabulary-constrained sentence generation via the Gemini API with a validation layer
- spaCy NLP microservice (Python Flask) for sentence structure analysis
- Google Cloud Speech-to-Text + fuzzball fuzzy matching for spoken response evaluation
- Non-verbal fallback pathway for students who cannot yet produce speech

### Module 3 — Motor-Informed Handwriting
Tablet stroke capture (X-Y coordinate streams) fed into:
- Rule-based motor scoring (accuracy, smoothness, consistency)
- K-means clustering to group students by motor ability
- Adaptive letter sequencing ordered by stroke complexity
- XAI-based teacher feedback panels with Chart.js progress visualisations

### Module 4 — Adaptive Pronunciation Support
Audio-based word learning driven by:
- MFCC feature extraction + DTW similarity scoring against UK-accent reference recordings
- Adaptive next-word selection based on phoneme pattern analysis
- Multimodal support (flashcards, lip-sync video guidance)
- Teacher dashboard with audio playback and category-wise performance tracking

---

## Architecture

```
┌─────────────────────────────────────────┐
│         React Native / Expo App         │
│  (iOS · Android · tablet-first layout)  │
└───────────────────┬─────────────────────┘
                    │ REST (JWT)
┌───────────────────▼─────────────────────┐
│       Node.js / Express 5 API           │
│  auth · teachers · principal · concepts │
│  Sequelize ORM · Winston logging        │
│  Swagger docs · Azure Blob Storage      │
└──────┬──────────────────────┬───────────┘
       │ PostgreSQL            │ HTTP
       │ (Azure)               ▼
       │            ┌──────────────────────┐
       │            │  Python FastAPI GNN  │
       │            │  service             │
       │            │  Neo4j Graph KB      │
       │            └──────────────────────┘
```

**Role hierarchy:** Principal → Teacher → Student (avatar-based child profile)

---

## Repository Structure

```
Auriva/
├── frontend/                   # React Native / Expo client
│   ├── assets/
│   │   ├── avatars/            # Avatar images and idle videos
│   │   └── concepts/
│   │       └── category-images/
│   └── src/
│       ├── api/                # Axios instance and endpoint helpers
│       ├── components/
│       │   └── common/         # ParentGateModal, shared UI
│       ├── constants/
│       │   ├── avatarThemes.js # Per-avatar colour themes
│       │   ├── conceptData.js  # Frontend concept catalogue
│       │   └── layout.js       # Spacing and breakpoint constants
│       ├── navigation/         # React Navigation stacks and tabs
│       ├── screens/
│       │   ├── auth/           # Login, forgot-password
│       │   ├── principal/      # School management screens
│       │   └── teacher/
│       │       └── concept/    # ConceptCategoriesScreen, ConceptItemsScreen, tiers
│       ├── store/              # Zustand state slices
│       └── utils/              # Token helpers, validators
│
├── backend/                    # Node.js / Express API
│   ├── index.js
│   └── src/
│       ├── config/             # DB connection, Azure Blob config
│       ├── controllers/        # Route handler logic
│       ├── middleware/         # Auth (JWT verify), error handler, rate limit
│       ├── models/             # Sequelize models (see Database Models section)
│       ├── routes/             # auth, principal, teacher, concept
│       ├── services/           # Business logic (conceptService, etc.)
│       ├── utils/              # ApiError, logger (Winston)
│       └── validations/        # express-validator schemas
│
└── gnn-service/                # Python FastAPI — Graph Knowledge Base
    ├── main.py
    ├── requirements.txt
    ├── routers/
    │   └── gkb.py              # REST endpoints for GKB operations
    └── services/
        └── gkb_service.py      # Neo4j CRUD and GNN inference logic
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile client | React Native 0.81.5, Expo 54, React 19.1.0 |
| State management | Zustand 5.0.3 |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| Fonts | Nunito (via @expo-google-fonts) |
| Audio / Video | expo-av, expo-audio |
| Secure storage | expo-secure-store |
| API layer | Axios 1.7.9 |
| Backend runtime | Node.js, Express 5.2.1 |
| ORM | Sequelize 6.37.8 |
| Database | PostgreSQL (Azure Database for PostgreSQL) |
| File storage | Azure Blob Storage (@azure/storage-blob 12) |
| Auth | JWT (jsonwebtoken 9), bcryptjs 3 |
| Validation | express-validator 7 |
| Security | Helmet 8, express-rate-limit 8 |
| Logging | Winston 3, Morgan |
| API docs | Swagger / OpenAPI (swagger-jsdoc + swagger-ui-express) |
| GNN service | Python 3, FastAPI, Uvicorn |
| Graph database | Neo4j |
| GNN service env | python-dotenv |

---

## Prerequisites

- **Node.js** ≥ 20 LTS
- **npm** ≥ 10
- **Expo CLI** — `npm install -g expo-cli` (or use `npx expo`)
- **Python** ≥ 3.10
- **PostgreSQL** instance (local or Azure)
- **Neo4j** instance (local Desktop or AuraDB)
- **Azure Blob Storage** account (for concept assets)
- iOS Simulator / Android Emulator **or** a physical tablet with the Expo Go app

---

## Setup and Installation

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=<your-pg-host>
DB_PORT=5432
DB_NAME=auriva
DB_USER=<your-pg-user>
DB_PASSWORD=<your-pg-password>
DB_SSL=true                     # set false for local dev without SSL

# JWT
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>
AZURE_STORAGE_CONTAINER_NAME=concepts

# Email (Nodemailer — for OTP password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<your-email>
EMAIL_PASS=<your-app-password>

# GNN Service
GNN_SERVICE_URL=http://localhost:8000
```

Run database migrations (Sequelize sync):

```bash
npm run dev       # development — uses node --watch
npm start         # production
```

Swagger UI is available at `http://localhost:3000/api-docs` once the server is running.

### 2. GNN Service

```bash
cd gnn-service
python -m venv venv
venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS / Linux

pip install -r requirements.txt
```

Create `gnn-service/.env`:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<your-neo4j-password>
```

Start the service:

```bash
uvicorn main:app --reload --port 8000
```

GNN service API docs are available at `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (or configure in `src/api/`):

```env
EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:3000/api
```

> Use your machine's LAN IP address (not `localhost`) so physical devices and emulators can reach the backend.

Start the Expo dev server:

```bash
npx expo start
```

Press `a` for Android emulator, `i` for iOS simulator, or scan the QR code with Expo Go on a tablet.

---

## Running the Full Stack

Open three terminals:

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — GNN Service
cd gnn-service && uvicorn main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend && npx expo start
```

---

## API Routes

All backend routes are prefixed with `/api`.

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/login` | Principal / Teacher login |
| `POST /api/auth/forgot-password` | Send OTP to registered email |
| `POST /api/auth/reset-password` | Reset password using OTP |
| `GET /api/principal/*` | School, teacher, and student management |
| `GET /api/teacher/*` | Teacher profile, student list |
| `GET /api/teacher/concepts/:category/items` | Fetch concept items for a category |
| `POST /api/teacher/concepts/progress` | Record tier progression |
| `GET /api/concept/*` | Category and item queries |

Full interactive documentation: `http://localhost:3000/api-docs`

---

## Database Models

| Model | Key Fields |
|-------|-----------|
| `Principal` | id, name, email, password_hash, school_name |
| `Teacher` | id, name, email, password_hash, principal_id |
| `Student` | id, name, date_of_birth, avatar_key, teacher_id |
| `StudentAvatar` | student_id, avatar_key, unlocked_at |
| `Session` | id, user_id, role, token, expires_at |
| `PasswordResetOtp` | id, email, otp_hash, expires_at, used |
| `StudentConceptProgress` | student_id, category_key, tier, score, mastered_at |
| `ConceptInteractionLog` | student_id, category_key, concept_key, tier, response, correct, response_time_ms |

Sequelize automatically creates / alters tables on server startup in development mode.

---

## GNN Service — Graph Knowledge Base

**Neo4j node labels:**
- `:Category` — concept category (e.g. `colors`, `shapes`)
- `:Concept` — individual vocabulary item within a category
- `:Student` — mirrors the PostgreSQL student record

**Relationships:**
- `(:Category)-[:HAS_CONCEPT]->(:Concept)`
- `(:Student)-[:T1_ENGAGEMENT {score, timestamp}]->(:Concept)`
- `(:Student)-[:T1_SCORE {value}]->(:Concept)`
- `(:Student)-[:CONFUSION {count}]->(:Concept)`

The GKB service exposes CRUD endpoints for nodes and relationships, and a `/infer` endpoint that runs GNN inference to return recommended next concepts and confusion risk scores for a given student.

---

## Concept Categories

Nine categories are currently supported end-to-end (frontend + backend + assets):

| Key | Label |
|-----|-------|
| `colors` | Colours |
| `shapes` | Shapes |
| `numbers` | Numbers |
| `classroom` | Classroom Objects |
| `household` | Household Items |
| `house` | House Parts |
| `animals` | Animals |
| `fruits` | Fruits |
| `professionals` | Professionals |

---

## Mastery Criteria

Advancement between tiers follows ABA-based mastery criteria: a student must achieve **≥ 90% accuracy** across a minimum number of trials before the system promotes them to the next tier. Progress is logged per concept per student and surfaced on the teacher dashboard.

---

## Security

- All protected routes require a `Bearer <token>` JWT in the `Authorization` header.
- Passwords are hashed with bcryptjs (salt rounds: 12).
- Rate limiting is applied globally via express-rate-limit.
- HTTP security headers are set by Helmet.
- Parent Gate modal (PIN challenge) guards navigation away from child-facing screens.

---

## Team

| Module | Focus | Student ID |
|--------|-------|------------|
| 1 — Concept Learning | GNN · Graph Knowledge Base · LLM feedback | IT22084590 — Jayasundera H.H.A.S. |
| 2 — Dialogue Learning | Vocabulary-constrained LLM · Speech recognition | IT22166838 — Gunawardena |
| 3 — Handwriting | Motor scoring · K-means clustering · XAI | IT22216700 — Liluksha |
| 4 — Pronunciation | MFCC · DTW · Adaptive phoneme sequencing | IT22266378 — Samaranayake |

---

## License

This project was developed as part of a final-year research degree at SLIIT. All rights reserved by the respective authors.
