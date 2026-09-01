# Firebase online setup and run guide

This project uses Firebase Authentication, Firestore, Cloud Storage, Cloud Functions and Hosting. The old FastAPI `backend/` is a retired prototype and is not needed to run the current app.

## 1. Install prerequisites

- Node.js 22 LTS
- Java 21+ (only needed for emulator security-rule tests)
- A Firebase project on the Blaze plan (Cloud Functions v2 and Cloud Tasks require billing)
- Firebase CLI login with access to that project

From the repository root (`D:\cropai`):

```powershell
Set-Location D:\cropai\functions
npm install

Set-Location D:\cropai\frontend
npm install
```

## 2. Create and configure the Firebase project

1. Open Firebase Console and create or select a project.
2. In **Project settings > Your apps**, add a Web app.
3. In **Build > Authentication > Sign-in method**, enable Email/Password. Farmer registration no longer uses Phone sign-in. Keep phone/SMS configuration only if the existing expert/admin MFA flow is required.
4. Add `localhost` and the deployed Hosting/custom domains under **Authentication > Settings > Authorized domains**.
5. Create a Firestore database in production mode. Choose a region compatible with the Functions region used by this app.
6. Enable Cloud Storage. Note the exact bucket name shown by Firebase.
7. Upgrade Authentication with Identity Platform before using privileged-account SMS MFA or the `beforeUserCreated` blocking function.

## 3. Connect this checkout to the online project

Log in and select the project:

```powershell
Set-Location D:\cropai
.\functions\node_modules\.bin\firebase.cmd login
Copy-Item .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `your-firebase-project-id` with the real project ID (not the display name). Confirm access:

```powershell
.\functions\node_modules\.bin\firebase.cmd use
```

Create the frontend environment file if it does not exist:

```powershell
Copy-Item frontend\.env.example frontend\.env
```

In Firebase Console, copy the values from **Project settings > Your apps > SDK setup and configuration > Config** into `frontend/.env`:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
VITE_FIREBASE_REGION=asia-south1
VITE_FIREBASE_APPCHECK_KEY=
VITE_FIREBASE_VAPID_KEY=
VITE_USE_FIREBASE_EMULATORS=false
```

The web API key is an app identifier and is expected in the browser bundle; authorization is enforced by Auth, App Check and Security Rules. Do not place service-account private keys in this file.

Check the configuration before running or deploying:

```powershell
Set-Location D:\cropai\frontend
npm run firebase:check
```

## 4. Run locally against Firebase online

`localhost` here is only the Vite web server. Authentication, Firestore, Storage and Functions requests go to Firebase online because `VITE_USE_FIREBASE_EMULATORS=false`.

On a Spark-plan prototype where Cloud Functions cannot be deployed, set `VITE_USE_DIRECT_FARM_WRITES=true`. The bundled official location snapshot and strict Firestore create rule then allow farm registration without callable Functions. Keep the resulting hierarchy explicitly client-validated/unverified, and switch the flag back to `false` after deploying trusted Functions.

```powershell
Set-Location D:\cropai\frontend
npm run dev
```

Open `http://localhost:5173`. Restart Vite after changing `.env`.

The complete scan flow calls deployed Cloud Functions. Deploy the backend resources in the next section before testing scans. Basic client-side Auth/Firestore operations also require the online rules to be deployed.

## 5. Verify and deploy Firebase resources

Build and run the rule tests first:

```powershell
Set-Location D:\cropai\functions
npm run build
npm run test:rules
```

Deploy Firestore rules/indexes and Storage rules:

```powershell
Set-Location D:\cropai
.\functions\node_modules\.bin\firebase.cmd deploy --only firestore,storage
```

For the full scan pipeline, first deploy the private inference service and configure the function environment described in `deploy/README.md`. Then deploy Functions:

```powershell
.\functions\node_modules\.bin\firebase.cmd deploy --only functions
```

Build the frontend with the online-config preflight and deploy Hosting:

```powershell
Set-Location D:\cropai\frontend
npm run build:online

Set-Location D:\cropai
.\functions\node_modules\.bin\firebase.cmd deploy --only hosting
```

Firebase prints the public `web.app` URL after deployment.

## 6. Optional production services

- **App Check:** Create a reCAPTCHA Enterprise web provider, put its site key in `VITE_FIREBASE_APPCHECK_KEY`, deploy again, observe valid traffic, and only then set the Functions environment variable `ENFORCE_APP_CHECK=true` and enable Firebase product enforcement. Callable enforcement defaults off so a blank frontend key cannot lock out every request.
- **Push notifications:** Generate a Web Push certificate in Firebase Cloud Messaging and put the public VAPID key in `VITE_FIREBASE_VAPID_KEY`.
- **Administrator:** After deployment and after the user exists, run `node functions/scripts/set-admin.mjs <uid> I_UNDERSTAND_THIS_GRANTS_ADMIN` using Application Default Credentials with appropriate access.
- **Inference:** The UI and data management can run without a model, but scan submission intentionally fails closed until `INFERENCE_URL`, `INFERENCE_QUEUE`, `INFERENCE_CALLER_SERVICE_ACCOUNT` and validated model artifacts are configured.

## Troubleshooting

- **`auth/unauthorized-domain`:** Add the exact host under Authentication authorized domains.
- **`permission-denied`:** Deploy `firestore.rules`/`storage.rules`, sign in again, and check that the document belongs to the signed-in UID.
- **Function `not-found`:** Deploy Functions and make sure `VITE_FIREBASE_REGION` matches the Functions region.
- **CORS or App Check rejection:** Do not enforce App Check until the reCAPTCHA Enterprise key is configured and verified.
- **Online preflight rejects the file:** Replace every demo/blank value and keep `VITE_USE_FIREBASE_EMULATORS=false`.
- **Changed `.env` has no effect:** Stop and restart `npm run dev`; Vite reads environment variables at startup.
