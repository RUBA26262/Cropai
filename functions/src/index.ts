import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import { CloudTasksClient } from "@google-cloud/tasks";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";
import { buildScoutingMission, calculateCropRisk } from "./riskEngine";
import { MAHARASHTRA_DISTRICTS } from "./locationFallback";

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();
const tasks = new CloudTasksClient();
const REGION = process.env.FUNCTION_REGION || "asia-south1";
// App Check must only be enforced after a web provider is configured and valid
// traffic has been observed. Defaulting it on makes every callable unusable in
// a new Firebase project whose frontend has no App Check site key yet.
const APP_CHECK = process.env.FUNCTIONS_EMULATOR !== "true" && process.env.ENFORCE_APP_CHECK === "true";

type Role = "farmer" | "expert" | "admin";

const callableOptions = { region: REGION, enforceAppCheck: APP_CHECK, consumeAppCheckToken: APP_CHECK } as const;
const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().regex(/^[A-Za-z0-9:_-]{10,256}$/);
const language = z.enum(["en", "mr", "hi"]);
const severity = z.enum(["low", "medium", "high"]);

function uidOf(request: { auth?: { uid: string; token: Record<string, unknown> } }): string {
  if (!request.auth?.uid || request.auth.token.active === false) {
    throw new HttpsError("unauthenticated", "AUTH_REQUIRED");
  }
  return request.auth.uid;
}

function requireRole(request: { auth?: { uid: string; token: Record<string, unknown> } }, roles: Role[]): string {
  const uid = uidOf(request);
  if (!roles.includes(request.auth?.token.role as Role)) throw new HttpsError("permission-denied", "ROLE_REQUIRED");
  if (roles.includes("expert") && request.auth?.token.role === "expert" && request.auth.token.expertVerified !== true) {
    throw new HttpsError("permission-denied", "EXPERT_NOT_VERIFIED");
  }
  return uid;
}

async function enforceQuota(uid: string, action: string, maximum: number, seconds: number): Promise<void> {
  const window = Math.floor(Date.now() / (seconds * 1000));
  const ref = db.doc(`rateLimits/${uid}_${action}_${window}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0;
    if (count >= maximum) throw new HttpsError("resource-exhausted", "RATE_LIMITED");
    transaction.set(ref, { uid, action, window, count: count + 1, expiresAt: Timestamp.fromMillis((window + 2) * seconds * 1000) });
  });
}

async function audit(actorUid: string, action: string, targetId: string, metadata: Record<string, unknown> = {}) {
  await db.collection("auditEvents").add({ actorUid, action, targetId, metadata, createdAt: FieldValue.serverTimestamp() });
}

const DIRECTORY_BASE = "http://115.124.105.220/API";
type DirectoryOption = { code: string; name: string; localName: string; lgdCode?: string };
const directoryCache = new Map<string, { expires: number; values: DirectoryOption[] }>();

async function directoryOptions(level: "districts" | "talukas" | "villages", districtCode?: string, talukaCode?: string): Promise<DirectoryOption[]> {
  const key = `${level}:${districtCode || ""}:${talukaCode || ""}`;
  const cached = directoryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.values;
  let endpoint = "/GetAllDistricts";
  if (level === "talukas") endpoint = `/GetTalukasOfDistrict?distcode=${encodeURIComponent(districtCode || "")}`;
  if (level === "villages") endpoint = `/GetVillagesOfDistrictAndTaluka?distcode=${encodeURIComponent(districtCode || "")}&talukacode=${encodeURIComponent(talukaCode || "")}`;
  let response: Response;
  try { response = await fetch(`${DIRECTORY_BASE}${endpoint}`, { method: "POST", signal: AbortSignal.timeout(10000) }); }
  catch {
    if (level === "districts") return MAHARASHTRA_DISTRICTS;
    throw new HttpsError("unavailable", "LOCATION_DIRECTORY_UNAVAILABLE");
  }
  if (!response.ok) {
    if (level === "districts") return MAHARASHTRA_DISTRICTS;
    throw new HttpsError("unavailable", "LOCATION_DIRECTORY_UNAVAILABLE");
  }
  let rows: Array<Record<string, unknown>>;
  try {
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) throw new Error("INVALID_DIRECTORY_RESPONSE");
    rows = payload as Array<Record<string, unknown>>;
  }
  catch {
    if (level === "districts") return MAHARASHTRA_DISTRICTS;
    throw new HttpsError("unavailable", "LOCATION_DIRECTORY_UNAVAILABLE");
  }
  const values = rows.map((row) => ({
    code: String(level === "districts" ? row.districtcode : level === "talukas" ? row.subdistrictcode : row.villagecode).trim(),
    name: String(level === "districts" ? row.districtnameenglish : level === "talukas" ? row.subdistrictnameenglish : row.villagenameenglish).trim(),
    localName: String(level === "districts" ? row.districtlocalname : level === "talukas" ? row.subdistrictlocalname : row.villagelocalname).trim(),
    ...(row.lgd_code ? { lgdCode: String(row.lgd_code).trim() } : {}),
  })).filter((item) => item.code && item.name);
  const resolved = values.length || level !== "districts" ? values : MAHARASHTRA_DISTRICTS;
  directoryCache.set(key, { expires: Date.now() + 6 * 3600 * 1000, values: resolved });
  return resolved;
}

export const getLocationOptions = onCall(callableOptions, async (request) => {
  uidOf(request);
  const input = z.object({ level: z.enum(["districts", "talukas", "villages"]), districtCode: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/).optional(), talukaCode: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/).optional() }).superRefine((value, context) => {
    if (value.level !== "districts" && !value.districtCode) context.addIssue({ code: z.ZodIssueCode.custom, message: "DISTRICT_REQUIRED" });
    if (value.level === "villages" && !value.talukaCode) context.addIssue({ code: z.ZodIssueCode.custom, message: "TALUKA_REQUIRED" });
  }).parse(request.data);
  return { options: await directoryOptions(input.level, input.districtCode, input.talukaCode) };
});

export const createFarm = onCall(callableOptions, async (request) => {
  const uid = requireRole(request, ["farmer"]);
  await enforceQuota(uid, "farm-create", 20, 86400);
  const input = z.object({ name: text(120), districtCode: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/), talukaCode: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/), villageCode: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/), districtName: z.string().trim().max(120).optional(), talukaName: z.string().trim().max(120).optional(), villageName: z.string().trim().max(120).optional(), latitude: z.number().min(15.5).max(22.1), longitude: z.number().min(72.5).max(80.9), areaAcres: z.number().positive().max(100000).nullable().default(null), soilType: z.string().trim().max(120).default(""), irrigationType: z.string().trim().max(120).default("") }).parse(request.data);
  const fallbackMode = input.districtCode.startsWith("fallback-") || input.talukaCode === "manual" || input.villageCode === "manual";
  const district = (await directoryOptions("districts")).find((item) => item.code === input.districtCode)
    || (input.districtName ? { code: input.districtCode, name: input.districtName, localName: input.districtName } : undefined);
  if (!district) throw new HttpsError("failed-precondition", "INVALID_DISTRICT");
  const taluka = fallbackMode
    ? (input.talukaName ? { code: "manual", name: input.talukaName, localName: input.talukaName } : undefined)
    : (await directoryOptions("talukas", input.districtCode)).find((item) => item.code === input.talukaCode);
  if (!taluka) throw new HttpsError("failed-precondition", "TALUKA_NOT_IN_DISTRICT");
  const village = fallbackMode
    ? (input.villageName ? { code: "manual", name: input.villageName, localName: input.villageName } : undefined)
    : (await directoryOptions("villages", input.districtCode, input.talukaCode)).find((item) => item.code === input.villageCode);
  if (!village) throw new HttpsError("failed-precondition", "VILLAGE_NOT_IN_TALUKA");
  const ref = db.collection("farms").doc();
  const location = `${village.name}, ${taluka.name}, ${district.name}`;
  await ref.create({ ownerUid: uid, name: input.name, district: district.name, districtCode: district.code, taluka: taluka.name, talukaCode: taluka.code, village: village.name, villageCode: village.code, villageLgdCode: "lgdCode" in village ? village.lgdCode || null : null, location, latitude: input.latitude, longitude: input.longitude, locationSource: "device_gps", locationHierarchyVerified: !fallbackMode, locationHierarchySource: fallbackMode ? "user_entered_fallback" : "official_directory", locationVerifiedAt: FieldValue.serverTimestamp(), areaAcres: input.areaAcres, soilType: input.soilType, irrigationType: input.irrigationType, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return { id: ref.id, district: district.name, taluka: taluka.name, village: village.name, location, latitude: input.latitude, longitude: input.longitude, locationSource: "device_gps", locationHierarchyVerified: !fallbackMode, locationHierarchySource: fallbackMode ? "user_entered_fallback" : "official_directory" };
});

export const setDefaultClaims = beforeUserCreated({ region: REGION }, () => ({
  customClaims: { role: "farmer", active: true, expertVerified: false },
}));

export const createScanSession = onCall(callableOptions, async (request) => {
  const uid = requireRole(request, ["farmer"]);
  await enforceQuota(uid, "scan-create", 10, 3600);
  const input = z.object({ farmCropId: id, language: language.default("en") }).parse(request.data);
  const cropSnapshot = await db.doc(`farmCrops/${input.farmCropId}`).get();
  if (!cropSnapshot.exists) throw new HttpsError("not-found", "FARM_CROP_NOT_FOUND");
  const crop = cropSnapshot.data()!;
  if (crop.ownerUid !== uid || crop.status !== "active") throw new HttpsError("permission-denied", "FARM_CROP_NOT_AVAILABLE");
  const farmSnapshot = await db.doc(`farms/${crop.farmId}`).get();
  if (!farmSnapshot.exists || farmSnapshot.data()?.ownerUid !== uid) throw new HttpsError("permission-denied", "FARM_NOT_AVAILABLE");
  const farm = farmSnapshot.data()!;

  const scanRef = db.collection("scans").doc();
  await scanRef.create({
    ownerUid: uid,
    farmId: crop.farmId,
    farmCropId: input.farmCropId,
    cropKey: crop.cropKey,
    district: farm.district,
    taluka: farm.taluka || null,
    locationHierarchyVerified: farm.locationHierarchyVerified === true,
    language: input.language,
    status: "uploading",
    expectedSlots: ["closeup", "plant"],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
    imagesRetained: true,
  });
  return { scanId: scanRef.id, requiredSlots: ["closeup", "plant"], optionalSlots: ["context"], maxBytesPerImage: 5 * 1024 * 1024 };
});

const symptomSchema = z.object({
  affectedArea: z.enum(["few_leaves", "many_leaves", "whole_plant", "unknown"]),
  spreadSpeed: z.enum(["slow", "fast", "unknown"]),
  visiblePests: z.enum(["none", "few", "many", "unknown"]),
  notes: z.string().trim().max(500).default(""),
});

export const submitScan = onCall(callableOptions, async (request) => {
  const uid = requireRole(request, ["farmer"]);
  await enforceQuota(uid, "scan-submit", 10, 3600);
  const input = z.object({ scanId: id, symptoms: symptomSchema, idempotencyKey: z.string().uuid() }).parse(request.data);
  const ref = db.doc(`scans/${input.scanId}`);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.data()?.ownerUid !== uid) throw new HttpsError("not-found", "SCAN_NOT_FOUND");
    const scan = snapshot.data()!;
    if (scan.idempotencyKey === input.idempotencyKey) return { duplicate: true, status: scan.status };
    if (scan.status !== "uploading") throw new HttpsError("failed-precondition", "INVALID_SCAN_STATE");
    transaction.update(ref, {
      status: "queued",
      symptoms: input.symptoms,
      idempotencyKey: input.idempotencyKey,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { duplicate: false, status: "queued" };
  });
  if (result.duplicate) return result;

  const [files] = await bucket.getFiles({ prefix: `quarantine/${uid}/${input.scanId}/` });
  const slots = new Set(files.map((file) => file.name.split("/").pop()?.split(".")[0]));
  if (!slots.has("closeup") || !slots.has("plant") || files.length > 3) {
    await ref.update({ status: "rejected", failureCode: "REQUIRED_IMAGES_MISSING", updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("failed-precondition", "REQUIRED_IMAGES_MISSING");
  }

  const inferenceUrl = process.env.INFERENCE_URL;
  const project = process.env.GCLOUD_PROJECT;
  const serviceAccountEmail = process.env.INFERENCE_CALLER_SERVICE_ACCOUNT;
  if (!inferenceUrl || !project || !serviceAccountEmail) {
    await ref.update({ status: "failed", failureCode: "MODEL_SERVICE_NOT_CONFIGURED", updatedAt: FieldValue.serverTimestamp() });
    return { status: "failed", code: "MODEL_SERVICE_NOT_CONFIGURED" };
  }
  const parent = tasks.queuePath(project, REGION, process.env.INFERENCE_QUEUE || "cropai-inference");
  try {
    await tasks.createTask({ parent, task: {
      httpRequest: {
        httpMethod: "POST",
        url: `${inferenceUrl.replace(/\/$/, "")}/v1/infer`,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify({ scanId: input.scanId })).toString("base64"),
        oidcToken: { serviceAccountEmail, audience: inferenceUrl },
      },
    }});
  } catch (error) {
    console.error("submitScan: inference queue handoff failed", {
      scanId: input.scanId,
      queue: process.env.INFERENCE_QUEUE || "cropai-inference",
      error: error instanceof Error ? error.message : String(error),
    });
    await ref.update({ status: "failed", failureCode: "INFERENCE_QUEUE_UNAVAILABLE", updatedAt: FieldValue.serverTimestamp() });
    return { status: "failed", code: "INFERENCE_QUEUE_UNAVAILABLE", scanId: input.scanId };
  }
  return { status: "queued", scanId: input.scanId };
});

export const cancelScan = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  const { scanId } = z.object({ scanId: id }).parse(request.data);
  const ref = db.doc(`scans/${scanId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.ownerUid !== uid) throw new HttpsError("not-found", "SCAN_NOT_FOUND");
  if (!["uploading", "queued"].includes(snapshot.data()?.status)) throw new HttpsError("failed-precondition", "SCAN_CANNOT_BE_CANCELLED");
  await ref.update({ status: "cancelled", updatedAt: FieldValue.serverTimestamp() });
  await bucket.deleteFiles({ prefix: `quarantine/${uid}/${scanId}/`, force: true });
  return { status: "cancelled" };
});

export const requestExpertReview = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  const { scanId } = z.object({ scanId: id }).parse(request.data);
  const scanRef = db.doc(`scans/${scanId}`);
  const scan = await scanRef.get();
  if (!scan.exists || scan.data()?.ownerUid !== uid) throw new HttpsError("not-found", "SCAN_NOT_FOUND");
  const expertQuery = await db.collection("users").where("expertVerificationStatus", "==", "approved").limit(20).get();
  const expert = expertQuery.docs.sort((a, b) => Number(a.data().openCases || 0) - Number(b.data().openCases || 0))[0];
  if (!expert) throw new HttpsError("unavailable", "NO_EXPERT_AVAILABLE");
  const reviewId = `${scanId}_${expert.id}`;
  await db.doc(`expertReviews/${reviewId}`).create({
    scanId, ownerUid: uid, assignedExpertUid: expert.id, status: "assigned",
    district: scan.data()?.district || null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  await scanRef.update({ expertReviewStatus: "assigned", updatedAt: FieldValue.serverTimestamp() });
  return { reviewId, status: "assigned" };
});

export const submitExpertReview = onCall(callableOptions, async (request) => {
  const expertUid = requireRole(request, ["expert"]);
  const input = z.object({ reviewId: id, verdict: z.enum(["confirmed", "corrected", "inconclusive"]), correctedConditionId: z.string().max(100).nullable(), severity: severity.nullable(), notes: text(2000) }).parse(request.data);
  const reviewRef = db.doc(`expertReviews/${input.reviewId}`);
  const review = await reviewRef.get();
  if (!review.exists || review.data()?.assignedExpertUid !== expertUid || review.data()?.status !== "assigned") throw new HttpsError("permission-denied", "REVIEW_NOT_AVAILABLE");
  await db.runTransaction(async (transaction) => {
    transaction.update(reviewRef, { ...input, status: "completed", reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.update(db.doc(`scans/${review.data()?.scanId}`), { expertReviewStatus: "completed", expertVerdict: input.verdict, updatedAt: FieldValue.serverTimestamp() });
    transaction.create(db.collection("alerts").doc(), { recipientUid: review.data()?.ownerUid, type: "expert_review", severity: "info", sourceId: review.data()?.scanId, title: "Expert review completed", message: "An agricultural expert has reviewed your scan.", read: false, deliveryState: "pending", createdAt: FieldValue.serverTimestamp() });
  });
  await audit(expertUid, "expert_review_completed", input.reviewId);
  return { status: "completed" };
});

export const requestExpertVerification = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  await enforceQuota(uid, "expert-request", 2, 86400);
  const input = z.object({ qualification: text(250), registrationNumber: text(100), organization: text(250) }).parse(request.data);
  await db.doc(`expertVerificationRequests/${uid}`).set({ uid, ...input, status: "pending", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: false });
  await db.doc(`users/${uid}`).set({ expertVerificationStatus: "pending", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { status: "pending" };
});

export const approveExpert = onCall(callableOptions, async (request) => {
  const adminUid = requireRole(request, ["admin"]);
  const input = z.object({ uid: id, approved: z.boolean(), reason: z.string().trim().max(500).default("") }).parse(request.data);
  const user = await getAuth().getUser(input.uid);
  if (input.approved && !user.emailVerified) throw new HttpsError("failed-precondition", "VERIFIED_EMAIL_REQUIRED");
  if (input.approved && !user.multiFactor?.enrolledFactors?.length) throw new HttpsError("failed-precondition", "MFA_ENROLLMENT_REQUIRED");
  await getAuth().setCustomUserClaims(input.uid, { ...user.customClaims, role: input.approved ? "expert" : "farmer", expertVerified: input.approved, active: true });
  const status = input.approved ? "approved" : "rejected";
  await db.doc(`expertVerificationRequests/${input.uid}`).set({ status, reason: input.reason, reviewedBy: adminUid, reviewedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.doc(`users/${input.uid}`).set({ expertVerificationStatus: status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(adminUid, `expert_${status}`, input.uid, { reason: input.reason });
  return { status };
});

export const suspendUser = onCall(callableOptions, async (request) => {
  const adminUid = requireRole(request, ["admin"]);
  const input = z.object({ uid: id, suspended: z.boolean(), reason: text(500) }).parse(request.data);
  if (input.uid === adminUid) throw new HttpsError("failed-precondition", "CANNOT_SUSPEND_SELF");
  const user = await getAuth().getUser(input.uid);
  await getAuth().updateUser(input.uid, { disabled: input.suspended });
  await getAuth().setCustomUserClaims(input.uid, { ...user.customClaims, active: !input.suspended });
  await db.doc(`users/${input.uid}`).set({ accountStatus: input.suspended ? "suspended" : "active", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(adminUid, input.suspended ? "user_suspended" : "user_reactivated", input.uid, { reason: input.reason });
  return { status: input.suspended ? "suspended" : "active" };
});

export const registerPushToken = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  const input = z.object({ token: text(4096), locale: language, enabled: z.boolean() }).parse(request.data);
  const tokenId = Buffer.from(input.token).toString("base64url").slice(0, 120);
  await db.doc(`pushTokens/${tokenId}`).set({ uid, token: input.token, locale: input.locale, enabled: input.enabled, updatedAt: FieldValue.serverTimestamp() });
  return { status: "registered" };
});

export const markAlertRead = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  const { alertId } = z.object({ alertId: id }).parse(request.data);
  const ref = db.doc(`alerts/${alertId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.recipientUid !== uid) throw new HttpsError("not-found", "ALERT_NOT_FOUND");
  await ref.update({ read: true, readAt: FieldValue.serverTimestamp() });
  return { status: "read" };
});

async function deleteCollectionForUser(collection: string, field: string, uid: string) {
  const writer = db.bulkWriter();
  const snapshots = await db.collection(collection).where(field, "==", uid).get();
  snapshots.docs.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
}

export const exportMyData = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  await enforceQuota(uid, "export", 2, 86400);
  const collections = ["farms", "farmCrops", "scans", "expertReviews", "alerts"];
  const output: Record<string, unknown[]> = {};
  for (const name of collections) {
    const field = name === "alerts" ? "recipientUid" : "ownerUid";
    const snapshots = await db.collection(name).where(field, "==", uid).get();
    output[name] = snapshots.docs.map((document) => ({ id: document.id, ...document.data() }));
  }
  return { exportedAt: new Date().toISOString(), data: output };
});

export const deleteMyAccount = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  const { confirmation } = z.object({ confirmation: z.literal("DELETE") }).parse(request.data);
  void confirmation;
  for (const name of ["farms", "farmCrops", "scans", "expertReviews"]) await deleteCollectionForUser(name, "ownerUid", uid);
  await deleteCollectionForUser("alerts", "recipientUid", uid);
  await deleteCollectionForUser("pushTokens", "uid", uid);
  await bucket.deleteFiles({ prefix: `scans/${uid}/`, force: true });
  await bucket.deleteFiles({ prefix: `quarantine/${uid}/`, force: true });
  await db.doc(`users/${uid}`).delete();
  await audit(uid, "account_deleted", uid);
  await getAuth().deleteUser(uid);
  return { status: "deleted" };
});

export const refreshFarmRisk = onCall(callableOptions, async (request) => {
  const uid = uidOf(request);
  await enforceQuota(uid, "risk", 20, 3600);
  const { farmCropId } = z.object({ farmCropId: id }).parse(request.data);
  const farmCrop = await db.doc(`farmCrops/${farmCropId}`).get();
  if (!farmCrop.exists || farmCrop.data()?.ownerUid !== uid) throw new HttpsError("not-found", "FARM_CROP_NOT_FOUND");
  const farm = await db.doc(`farms/${farmCrop.data()?.farmId}`).get();
  const latitude = farm.data()?.latitude;
  const longitude = farm.data()?.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") throw new HttpsError("failed-precondition", "FARM_LOCATION_REQUIRED");
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new HttpsError("unavailable", "WEATHER_UNAVAILABLE");
  const payload = await response.json() as { latitude?: number; longitude?: number; timezone?: string; current?: Record<string, number>; daily?: Record<string, Array<number | string>> };
  const current = payload.current || {};
  const daily = payload.daily || {};
  const forecast = (daily.time || []).slice(0, 7).map((date, index) => ({ date, weatherCode: daily.weather_code?.[index], maxTemperature: daily.temperature_2m_max?.[index], minTemperature: daily.temperature_2m_min?.[index], precipitation: daily.precipitation_sum?.[index], rainProbability: daily.precipitation_probability_max?.[index], maxWindSpeed: daily.wind_speed_10m_max?.[index] }));
  const context = { cropKey: farmCrop.data()?.cropKey, growthStage: farmCrop.data()?.growthStage, irrigationType: farm.data()?.irrigationType };
  const risk = calculateCropRisk({ temperature: current.temperature_2m, humidity: current.relative_humidity_2m, precipitation: current.precipitation, rainProbability: daily.precipitation_probability_max?.[0] as number | undefined, windSpeed: current.wind_speed_10m }, context);
  const forecastRisk = (daily.time || []).slice(0, 4).map((date, index) => {
    const max = Number(daily.temperature_2m_max?.[index]);
    const min = Number(daily.temperature_2m_min?.[index]);
    const dayRisk = calculateCropRisk({
      temperature: Number.isFinite(max) && Number.isFinite(min) ? (max + min) / 2 : current.temperature_2m,
      humidity: daily.relative_humidity_2m_max?.[index] as number | undefined,
      precipitation: daily.precipitation_sum?.[index] as number | undefined,
      rainProbability: daily.precipitation_probability_max?.[index] as number | undefined,
      windSpeed: daily.wind_speed_10m_max?.[index] as number | undefined,
    }, context);
    return { date, offsetHours: index * 24, score: dayRisk.score, level: dayRisk.level, drivers: dayRisk.factors.slice(0, 3) };
  });
  const result = { ...risk, forecastRisk, scouting: buildScoutingMission(risk, context), crop: context, location: { name: farm.data()?.location, village: farm.data()?.village, taluka: farm.data()?.taluka, district: farm.data()?.district, latitude, longitude, source: farm.data()?.locationSource || "device_gps", weatherGridLatitude: payload.latitude, weatherGridLongitude: payload.longitude }, current: { temperature: current.temperature_2m, feelsLike: current.apparent_temperature, humidity: current.relative_humidity_2m, precipitation: current.precipitation, windSpeed: current.wind_speed_10m, weatherCode: current.weather_code }, forecast, timezone: payload.timezone, source: "open-meteo", generatedAt: new Date().toISOString(), disclaimer: "Forecasted crop-health risk is a decision-support estimate from weather and saved farm context, not a prediction that disease or pests will occur. Field sensors and observations may differ." };
  await db.doc(`weatherRisk/${farmCropId}`).set({ ownerUid: uid, farmCropId, cropKey: farmCrop.data()?.cropKey, ...result, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 6 * 3600 * 1000) });
  return result;
});

export const publishManagementCatalog = onCall(callableOptions, async (request) => {
  const adminUid = requireRole(request, ["admin"]);
  const input = z.object({ conditionId: z.string().regex(/^[a-z0-9_-]{3,100}$/), cropKey: z.string().max(60), type: z.enum(["disease", "pest"]), names: z.record(language, text(120)), symptoms: z.record(language, z.array(text(300)).max(12)), prevention: z.record(language, z.array(text(500)).max(12)), ipm: z.record(language, z.array(text(500)).max(12)), escalation: z.record(language, text(800)), references: z.array(z.string().url()).max(10), version: z.number().int().positive() }).parse(request.data);
  await db.doc(`conditionCatalog/${input.conditionId}`).set({ ...input, published: true, updatedBy: adminUid, updatedAt: FieldValue.serverTimestamp() });
  await audit(adminUid, "catalog_published", input.conditionId, { version: input.version });
  return { status: "published", conditionId: input.conditionId };
});

export const sendPushForAlert = onDocumentCreated({ document: "alerts/{alertId}", region: REGION }, async (event) => {
  const alert = event.data?.data();
  if (!alert?.recipientUid) return;
  const tokens = await db.collection("pushTokens").where("uid", "==", alert.recipientUid).where("enabled", "==", true).get();
  if (tokens.empty) return;
  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.docs.map((doc) => doc.data().token),
    notification: { title: String(alert.title || "CropAI"), body: String(alert.message || "You have a new alert") },
    data: { alertId: event.params.alertId, sourceId: String(alert.sourceId || "") },
    webpush: { fcmOptions: { link: "/alerts" } },
  });
  await event.data?.ref.update({ deliveryState: response.failureCount ? "partial" : "sent", deliveredAt: FieldValue.serverTimestamp() });
});

export const cleanupExpiredUploads = onSchedule({ schedule: "every 6 hours", timeZone: "Asia/Kolkata", region: REGION }, async () => {
  const expired = await db.collection("scans").where("status", "==", "uploading").where("expiresAt", "<", Timestamp.now()).limit(200).get();
  for (const scan of expired.docs) {
    await bucket.deleteFiles({ prefix: `quarantine/${scan.data().ownerUid}/${scan.id}/`, force: true });
    await scan.ref.update({ status: "expired", updatedAt: FieldValue.serverTimestamp() });
  }
});

export const enforceImageRetention = onSchedule({ schedule: "every day 03:00", timeZone: "Asia/Kolkata", region: REGION }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - 90 * 86400 * 1000);
  const expired = await db.collection("scans").where("createdAt", "<", cutoff).where("imagesRetained", "==", true).limit(200).get();
  for (const scan of expired.docs) {
    await bucket.deleteFiles({ prefix: `scans/${scan.data().ownerUid}/${scan.id}/`, force: true });
    await scan.ref.update({ imagesRetained: false, imagesDeletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
});

export const generateScheduledRisks = onSchedule({ schedule: "every 6 hours", timeZone: "Asia/Kolkata", region: REGION }, async () => {
  // Risk refreshes are intentionally delegated per farm in the MVP to keep API usage bounded.
  await db.collection("auditEvents").add({ actorUid: "system", action: "scheduled_risk_window", targetId: randomUUID(), createdAt: FieldValue.serverTimestamp() });
});

export const generateOutbreakAggregates = onSchedule({ schedule: "every day 02:00", timeZone: "Asia/Kolkata", region: REGION }, async () => {
  const period = new Date().toISOString().slice(0, 10);
  const cutoff = Date.now() - 7 * 86400 * 1000;
  const snapshots = await db.collection("scans").where("status", "==", "completed").limit(1000).get();
  const groups = new Map<string, { district: string; total: number; conditions: Record<string, number> }>();
  for (const scan of snapshots.docs) {
    const data = scan.data();
    if ((data.createdAt?.toMillis?.() || 0) < cutoff || data.locationHierarchyVerified !== true || !data.district || !data.result?.conditionId) continue;
    const key = String(data.district).trim().toLowerCase();
    const group = groups.get(key) || { district: String(data.district), total: 0, conditions: {} };
    group.total += 1;
    group.conditions[data.result.conditionId] = (group.conditions[data.result.conditionId] || 0) + 1;
    groups.set(key, group);
  }
  const batch = db.batch();
  for (const [key, group] of groups) {
    if (group.total < 5) continue;
    batch.set(db.doc(`outbreakAggregates/${key.replace(/[^a-z0-9]+/g, "-")}_${period}`), { ...group, period, windowDays: 7, privacyThreshold: 5, generatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
});
