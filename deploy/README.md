# Secure deployment runbook

Use three independent projects (`cropai-dev`, `cropai-staging`, `cropai-production`) and never copy production data into development.

## Required services

Enable Identity Platform/Firebase Authentication, Firestore, Cloud Storage, Cloud Functions v2, Cloud Run, Cloud Tasks, Artifact Registry, Secret Manager, Cloud Scheduler, FCM, App Check, Cloud Logging and billing budgets.

Use `asia-south1` consistently to reduce latency and avoid unnecessary cross-region data movement.

## Identity and Cloud Run

Create dedicated service accounts:

- `cropai-functions`: Firebase Functions runtime; only required Firestore, Storage, FCM and task-enqueue permissions.
- `cropai-inference-caller`: signs Cloud Tasks OIDC requests and has only `roles/run.invoker` on the inference service.
- `cropai-inference`: Cloud Run runtime; reads the model bucket/quarantine objects and writes scans/alerts. Do not grant Owner or Editor.

Deploy `inference/` with authentication required and no public invoker. Set `STORAGE_BUCKET` and mount/copy only a model package that passes `ml_pipeline/validate_release.py`. Set Functions environment variables `INFERENCE_URL`, `INFERENCE_QUEUE`, and `INFERENCE_CALLER_SERVICE_ACCOUNT`.

Create the `cropai-inference` Cloud Tasks queue in `asia-south1`, set bounded retries/backoff, and grant only the Functions runtime permission to enqueue.

Do not download service-account JSON keys. Deploy through user credentials, Workload Identity Federation, or a trusted CI identity.

## Firebase

1. Copy `.firebaserc.example` to `.firebaserc` and replace project IDs.
2. Copy `frontend/.env.example` to environment-specific uncommitted files.
3. Enable Email/Password authentication for farmers and privileged accounts. Farmer accounts require email verification. Keep phone/SMS configuration only if the existing privileged-account MFA flow is used; it is no longer used for farmer sign-in.
4. Upgrade Authentication with Identity Platform. Provision expert applicants with verified email accounts; they enroll MFA in Settings before approval. Phone-primary farmer accounts cannot be promoted until they use a separate verified-email privileged identity.
5. Build and run emulator rules tests before deployment.
6. Deploy indexes/rules first, then Functions, Hosting, and finally enable App Check enforcement after staging metrics show legitimate requests are attested.
7. Bootstrap the first administrator with Application Default Credentials and `node functions/scripts/set-admin.mjs <uid> I_UNDERSTAND_THIS_GRANTS_ADMIN`.

## Production controls

- Configure a custom domain, authorized authentication domains, reCAPTCHA Enterprise App Check and FCM web credentials.
- Enable Firestore PITR/backups, log-based alerts, error reporting, uptime checks, billing budgets and quota alerts.
- Keep exact coordinates and image objects out of logs. Set log retention according to the privacy policy.
- Run IAM review, rules tests, dependency/container scans and staging OWASP ZAP checks on every release.
- Roll back with the previous Firebase Hosting release and previous Cloud Run revision/model package.
