# CropAI Maharashtra

CropAI is a secure, Firebase-based crop disease and pest decision-support PWA for Maharashtra farmers, agricultural experts and extension administrators.

The application does **not** fall back to random predictions. Until independently evaluated ONNX model packages meet the release gates, scans fail safely with `VALIDATED_MODEL_UNAVAILABLE`.

## Implemented architecture

- React/Vite installable PWA with light, dark and system themes.
- English, Marathi and Hindi navigation and safety messaging.
- Firebase email/password farmer onboarding with mandatory email verification; privileged email sign-in and MFA for experts/admins.
- Custom-claim roles assigned only by trusted backend code.
- Firestore data model, indexes and deny-by-default tenant-isolation rules.
- Private Cloud Storage quarantine and scan paths with type/size/path validation.
- TypeScript Cloud Functions v2 callables for scan lifecycle, quotas, expert review, role approval, alerts, weather risk, export and deletion.
- Private Cloud Run Python inference service with EXIF stripping, image re-encoding, decompression limits, quality checks, model checksum verification and fail-closed release gates.
- On-device pre-upload photo checks for minimum resolution, blur, lighting and visible detail, with guided retake instructions suitable for low-cost phones; the server independently repeats the safety check.
- Guided close-up/whole-plant/context capture and symptom questionnaire.
- Early-warning farm-health intelligence with disease, pest, weather, water-stress and overall scores; ranked contributing factors; 24/48/72-hour forecasted crop-health risk; and crop-specific scouting missions. These are decision-support estimates, not confirmed probabilities or occurrence predictions.
- Crop growth-stage and sowing-date context, with cached last-known risk results when live weather is temporarily unavailable.
- Complete Maharashtra location entry generated from the Common Village Master directory: 36 districts, 358 talukas and 44,911 villages, split into per-district assets for fast loading. Run `npm run locations:sync` from `frontend/` to refresh the bundled snapshot. Client-created Spark-plan records remain explicitly unverified until trusted server validation is available.
- Offline private scan drafts that expire after 24 hours and synchronize when connectivity returns.
- FCM push registration/delivery, private in-app alerts and scheduled quarantine cleanup.
- Verified expert queue, admin approval workflow and privacy-thresholded district outbreak aggregates.
- Dataset provenance and ML release-gate contracts for six Maharashtra-priority crops.
- Emulator attack tests and CI build/security workflow.

## Supported MVP label contract

| Crop | Diseases | Pest |
|---|---|---|
| Cotton | Bacterial blight, leaf curl | Pink bollworm |
| Soybean | Rust, yellow mosaic | Girdle beetle |
| Sugarcane | Red rot, smut | Early shoot borer |
| Onion | Purple blotch, downy mildew | Thrips |
| Tomato | Early blight, late blight | Fruit borer |
| Pomegranate | Bacterial blight, anthracnose | Fruit borer |

Every crop model also includes healthy and unknown/out-of-scope behavior. This is a release contract, not a claim that trained weights are committed.

## Repository layout

```text
frontend/       React PWA and Firebase web client
functions/      Trusted Firebase Functions and Security Rules tests
inference/      Private Cloud Run inference container
ml_pipeline/    Dataset, label and model release-gate contracts
deploy/         IAM, App Check and production deployment runbook
firestore.rules
storage.rules
firebase.json
firebase.test.json
```

The legacy `backend/` FastAPI prototype remains only for parity reference. It must not be deployed; it contains the retired mock model and SQLite API.

## Run locally with Firebase online

The frontend is cloud-first. Copy `frontend/.env.example` to `frontend/.env`, paste the Firebase Web app configuration, and keep `VITE_USE_FIREBASE_EMULATORS=false`. Then:

```powershell
Set-Location frontend
npm install
npm run firebase:check
npm run dev
```

This serves the UI at `http://localhost:5173`, while Auth, Firestore, Storage and Functions use the online Firebase project. See [FIREBASE_ONLINE_SETUP.md](FIREBASE_ONLINE_SETUP.md) for project creation, service enablement, rules, Functions, Hosting deployment, App Check, FCM and troubleshooting.

## Optional emulator development

Prerequisites: Node 22, Java 21+, Python 3.12 and Firebase CLI dependencies installed through the Functions package.

```powershell
Copy-Item .firebaserc.example .firebaserc
Copy-Item frontend/.env.emulator.example frontend/.env

Set-Location functions
npm install
npm run build
npm run test:rules

Set-Location ../frontend
npm install
npm run dev
```

The emulator-specific file sets `VITE_USE_FIREBASE_EMULATORS=true`. Emulator connections are ignored by production bundles as an additional safety guard. Use Firebase Auth emulator test phone numbers; do not send real OTPs from automated tests.

Online frontend build (includes configuration validation):

```powershell
Set-Location frontend
npm run build:online
```

Inference syntax/container checks:

```powershell
python -m compileall -q inference ml_pipeline
docker build -t cropai-inference:test inference
```

## Model release requirements

A crop model cannot load unless its manifest proves:

- held-out macro F1 ≥ 0.85;
- independent Maharashtra field-set macro F1 ≥ 0.75;
- every class recall ≥ 0.75;
- classifier and dataset-manifest checksums match;
- every training source has documented license evidence and approval.

See [ml_pipeline/README.md](ml_pipeline/README.md). Images from the same plant/capture group must never cross data splits. Field validation data is never used for training or hyperparameter selection.

## Security model

- UI role checks are convenience only; Firestore/Storage Rules and callable functions enforce authorization.
- Farmer, expert and administrator roles cannot be selected during registration.
- Experts see only assigned cases and approximate location. Aggregates suppress groups below five validated signals.
- Model output, severity, review state, audit events and alert creation are server-write-only.
- App Check is required outside emulators and should be enforced after staging observation.
- Scan images are sanitized, stripped of EXIF and never assigned permanent public download URLs.
- Per-user quotas, idempotency keys, task authentication, bounded input sizes and safe error codes reduce abuse.
- Account export and deletion are trusted callable operations; scan images default to a 90-day production retention policy.
- Secrets belong in Secret Manager or environment configuration, never source control.

Run `npm run test:rules` in `functions/` after every rules change. See [deploy/README.md](deploy/README.md) for IAM and rollout controls.

## Required external setup

Code alone cannot enable cloud-side controls. Before production, an authorized project owner must provision the Firebase/GCP projects, enable billing and Identity Platform MFA, create least-privilege service accounts and Cloud Tasks, deploy private Cloud Run, provide validated model artifacts, configure App Check/FCM, enable backups/monitoring, and complete human review of Marathi/Hindi agricultural guidance.

No security claim should say the platform is impossible to hack. The defensible claim is that access is deny-by-default, privilege is server-controlled, isolation is continuously tested, sensitive data is minimized, and incidents are observable and recoverable.
