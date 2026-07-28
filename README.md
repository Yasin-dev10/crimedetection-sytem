# BAREAI — Crime Detection System

BAREAI is an AI-powered crime detection and investigation platform focused on Somali-language text. It classifies content as crime-related or not, extracts locations and crime keywords, supports case workflows for investigators, and monitors Facebook posts and websites for blacklisted or suspicious activity.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [User roles](#user-roles)
- [API overview](#api-overview)
- [Useful scripts](#useful-scripts)
- [Default ports](#default-ports)
- [Troubleshooting](#troubleshooting)

---

## Features

### Crime analysis

- Classify text as **crime-related** or **not crime-related** (ML model + Somali keyword rules)
- Analyze pasted text, URLs, uploaded files (PDF / Word), and batch content
- Detect Somali locations (e.g. districts in Muqdisho, Kismaayo, Hargeysa, and more)
- Highlight matched crime keywords (dil, tuugo, afduub, qarax, etc.)
- Public guest analysis with usage limits; registered users get full history

### Investigation workflow

- Create and assign investigation cases
- Auto-generated investigation reports
- Notifications (in-app; optional email / SMS)
- Export reports (PDF / Excel)

### Admin & security

- Role-based access: **admin**, **investigator**, **user**
- User management and investigator onboarding (email verification + generated password)
- Blacklist management with alerts
- Audit logs and activity history
- Phone verification and SMS alerts via Twilio (optional)
- Facebook post monitoring and website page monitoring

### Dashboard

- Admin analytics (detections, cases, trends)
- Case management for admins and investigators
- Reports and audit log views

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Frontend       │────▶│  Backend (Express)   │────▶│  AI Model       │
│  React + Vite   │     │  REST API + MongoDB │     │  Flask + sklearn│
│  :5173          │     │  :5000               │     │  :5001          │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                  │
                                  ▼
                           MongoDB database
```

1. **Frontend** — React SPA for public analysis, auth, dashboards, and case tools
2. **Backend** — Express API: auth, analysis orchestration, cases, blacklist, reports, monitors
3. **AI model** — Flask service loads `crime_model.pkl` + `vectorizer.pkl` and returns predictions

---

## Tech stack

| Layer    | Technologies                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router, Recharts, Framer Motion, SweetAlert2, jsPDF                  |
| Backend  | Node.js, Express 5, MongoDB (Mongoose), JWT, bcrypt, Multer, Cheerio, Puppeteer, Nodemailer, Twilio, ExcelJS |
| AI       | Python, Flask, scikit-learn, joblib                                                                          |
| Data     | MongoDB                                                                                                      |

---

## Project structure

```
crimedetection-sytem/
├── frontend/          # React + Vite UI
├── backend/           # Express API, services, models
├── ai-model/          # Flask ML inference service
├── model/             # Training notebook / dataset (optional)
└── README.md
```

---

## Prerequisites

- **Node.js** 18+ (recommended LTS)
- **Python** 3.10+
- **MongoDB** running locally or a cloud URI (Atlas)
- Optional: Gmail app password (email), Twilio account (SMS / Verify), Facebook Graph API token (post monitoring)

---

## Getting started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd crimedetection-sytem
```

### 2. Start MongoDB

Ensure MongoDB is running and reachable at the URI you will put in `backend/.env`.

### 3. AI model service

```bash
cd ai-model
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Place these files in `ai-model/` (required for inference):

- `crime_model.pkl`
- `vectorizer.pkl`

Then start the service:

```bash
python app.py
```

Health check: [http://localhost:5001/health](http://localhost:5001/health)

### 4. Backend API

```bash
cd backend
npm install
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
```

Edit `backend/.env` (at least `MONGO_URI` and `JWT_SECRET`). Then:

```bash
npm run seed:admin
npm run dev
```

API root: [http://localhost:5000](http://localhost:5000)

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

> Run **AI model → backend → frontend** in that order so analysis calls succeed.

---

## Environment variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable                         | Description                                                 |
| -------------------------------- | ----------------------------------------------------------- |
| `PORT`                         | Backend port (default`5000`)                              |
| `MONGO_URI`                    | MongoDB connection string                                   |
| `JWT_SECRET`                   | Secret for signing auth tokens                              |
| `FRONTEND_URL`                 | Frontend origin (e.g.`http://localhost:5173`)             |
| `AI_MODEL_URL`                 | Predict endpoint (default`http://localhost:5001/predict`) |
| `AI_MODEL_HEALTH_URL`          | Optional health URL for the AI service                      |
| `AI_MODEL_TIMEOUT_MS`          | AI request timeout (default`30000`)                       |
| `EMAIL_USER` / `EMAIL_PASS`  | SMTP credentials for verification & alerts                  |
| `FACEBOOK_ACCESS_TOKEN`        | Graph API token for Facebook monitoring                     |
| `FACEBOOK_MONITOR_INTERVAL_MS` | Poll interval (default`60000`)                            |
| `TWILIO_ACCOUNT_SID`           | Twilio account SID (optional)                               |
| `TWILIO_AUTH_TOKEN`            | Twilio auth token (optional)                                |
| `TWILIO_VERIFY_SERVICE_SID`    | Twilio Verify service (phone verification)                  |
| `TWILIO_PHONE_NUMBER`          | Sender number for assignment SMS                            |
| `TWILIO_MESSAGING_SERVICE_SID` | Alternative to`TWILIO_PHONE_NUMBER`                       |

The frontend API base URL defaults to `http://localhost:5000/api` in `frontend/src/api.js`. Update it if the backend host/port changes.

---

## User roles

| Role                   | Home route     | Capabilities                                                      |
| ---------------------- | -------------- | ----------------------------------------------------------------- |
| **admin**        | `/dashboard` | Dashboard, users, blacklist, cases, reports, audit logs, settings |
| **investigator** | `/cases`     | Cases, blacklist, reports, profile, settings                      |
| **user**         | `/analysis`  | Crime analysis, profile                                           |

Public guests can use the landing analysis flow with limited usage.

Seed an admin after configuring MongoDB:

```bash
cd backend
npm run seed:admin
```

Credentials are printed in the terminal (defined in `backend/seedAdmin.js`). Change the password after first login in production.

---

## API overview

Base path: `http://localhost:5000/api`

| Prefix             | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `/auth`          | Register, login, logout, email verify, password flows, create investigator |
| `/analysis`      | Text / URL / file / batch crime analysis                                   |
| `/model`         | AI model info / status                                                     |
| `/history`       | Analysis history                                                           |
| `/dashboard`     | Admin dashboard stats                                                      |
| `/investigation` | Cases and investigation reports                                            |
| `/notifications` | In-app notifications                                                       |
| `/blacklist`     | Blacklist items and alerts                                                 |
| `/users`         | User management                                                            |
| `/reports`       | Reporting endpoints                                                        |
| `/audit-logs`    | Audit trail                                                                |

AI model endpoints (`:5001`):

| Method   | Path                   | Description                           |
| -------- | ---------------------- | ------------------------------------- |
| `GET`  | `/health`            | Service health                        |
| `GET`  | `/api/model/info`    | Model metadata                        |
| `POST` | `/predict`           | Classify text (`{ "text": "..." }`) |
| `POST` | `/api/classify/text` | Alias of`/predict`                  |

---

## Useful scripts

### Backend (`backend/`)

```bash
npm run dev                 # Start API server
npm run seed:admin          # Upsert default admin user
npm run twilio:setup        # Configure Twilio Verify
npm run twilio:test         # Test phone verification
npm run twilio:test-assignment  # Test assignment SMS
```

### Frontend (`frontend/`)

```bash
npm run dev       # Vite development server
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint
```

### AI model (`ai-model/`)

```bash
python app.py
```

---

## Default ports

| Service  | Port                      |
| -------- | ------------------------- |
| Frontend | `5173`                  |
| Backend  | `5000`                  |
| AI model | `5001`                  |
| MongoDB  | `27017` (local default) |

---

## Troubleshooting

**Analysis fails / timeout**

- Confirm the AI service is running on `:5001` and `crime_model.pkl` / `vectorizer.pkl` exist in `ai-model/`.
- Check `AI_MODEL_URL` in `backend/.env`.

**Cannot connect to MongoDB**

- Verify `MONGO_URI` and that MongoDB is running.

**Login / JWT errors**

- Set a strong `JWT_SECRET` and re-seed or re-register if needed.

**Emails not sending**

- Use a valid `EMAIL_USER` and app password in `EMAIL_PASS`. Set `FRONTEND_URL` so verification links point to the correct origin.

**Facebook monitor silent**

- Provide `FACEBOOK_ACCESS_TOKEN`. The monitor starts with the backend; check backend logs for startup errors.

**SMS / phone verification**

- Configure Twilio vars, then run `npm run twilio:setup` and the test scripts as needed.

---

## License

Private / academic project — update this section if you publish under a specific license.

---

## Acknowledgments

Built as the **BAREAI** crime detection and investigation system for Somali-language content analysis, case management, and monitoring workflows.
