import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_CONFIG_DIR = path.resolve(__dirname, '.data');
const PUBLIC_CONFIG_FILE = path.join(PUBLIC_CONFIG_DIR, 'public-config.json');

function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 1024) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function loadPersistedDefaultApiUrl(): string {
  try {
    if (!fs.existsSync(PUBLIC_CONFIG_FILE)) return '';
    const raw = fs.readFileSync(PUBLIC_CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { defaultApiUrl?: unknown };
    const candidate = String(parsed?.defaultApiUrl ?? '').trim();
    return isValidHttpUrl(candidate) ? candidate : '';
  } catch {
    return '';
  }
}

function persistDefaultApiUrl(url: string): void {
  try {
    fs.mkdirSync(PUBLIC_CONFIG_DIR, { recursive: true });
    fs.writeFileSync(
      PUBLIC_CONFIG_FILE,
      JSON.stringify({ defaultApiUrl: url, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('Could not persist public-config.json:', err);
  }
}

let persistedDefaultApiUrl = loadPersistedDefaultApiUrl();

function getEffectiveDefaultApiUrl(): { url: string; source: 'env' | 'saved' | 'none' } {
  const envUrl = (process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || '').trim();
  if (isValidHttpUrl(envUrl)) {
    return { url: envUrl, source: 'env' };
  }
  if (isValidHttpUrl(persistedDefaultApiUrl)) {
    return { url: persistedDefaultApiUrl, source: 'saved' };
  }
  return { url: '', source: 'none' };
}

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';
const GEMINI_TIMEOUT_MS = 14000;

// --- Server-Side Super Admin Authentication & Session Store ---
const ADMIN_SESSION_SECRET =
  (process.env.ADMIN_SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const SUPER_ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

interface ClaimedAdminCredential {
  salt: string;
  hashHex: string;
}

let claimedAdminCredential: ClaimedAdminCredential | null = null;
const superAdminSessions = new Map<string, { expiresAt: number }>();
const loginFailureMap = new Map<string, { count: number; resetAt: number }>();

function getEnvSuperAdminPasscode(): string {
  return (process.env.SUPER_ADMIN_PASSCODE || '').trim();
}

function getSuperAdminSource(): 'env' | 'claimed' | 'unconfigured' {
  if (getEnvSuperAdminPasscode()) return 'env';
  if (claimedAdminCredential) return 'claimed';
  return 'unconfigured';
}

function hashPasscodeWithScrypt(passcode: string, salt?: string): ClaimedAdminCredential {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, usedSalt, 64).toString('hex');
  return { salt: usedSalt, hashHex: derived };
}

function verifyPasscodeAgainstServer(candidate: string): boolean {
  const cleaned = candidate.trim();
  if (!cleaned) return false;

  const envPasscode = getEnvSuperAdminPasscode();
  if (envPasscode) {
    const a = crypto.createHash('sha256').update(cleaned).digest();
    const b = crypto.createHash('sha256').update(envPasscode).digest();
    return crypto.timingSafeEqual(a, b);
  }

  if (claimedAdminCredential) {
    const candidateDerived = crypto.scryptSync(cleaned, claimedAdminCredential.salt, 64);
    const storedBuf = Buffer.from(claimedAdminCredential.hashHex, 'hex');
    if (candidateDerived.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(candidateDerived, storedBuf);
  }

  return false;
}

function pruneExpiredAdminSessions(): void {
  const now = Date.now();
  for (const [sid, info] of superAdminSessions.entries()) {
    if (info.expiresAt <= now) {
      superAdminSessions.delete(sid);
    }
  }
}

function issueSuperAdminSessionToken(): { token: string; expiresAt: number } {
  pruneExpiredAdminSessions();
  const sid = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + SUPER_ADMIN_SESSION_TTL_MS;
  superAdminSessions.set(sid, { expiresAt });
  const payload = `${sid}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
  return { token: `${payload}.${sig}`, expiresAt };
}

function parseBearerToken(authHeader?: string): string | null {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.trim().match(/^Bearer\s+([A-Za-z0-9._-]+)$/i);
  return match ? match[1] : null;
}

function verifySuperAdminSessionToken(token: string | null): { valid: boolean; sid?: string; expiresAt?: number } {
  if (!token) return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false };
  const [sid, expStr, sig] = parts;
  const expiresAt = Number(expStr);
  if (!sid || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { valid: false };
  }

  const expectedSig = crypto
    .createHmac('sha256', ADMIN_SESSION_SECRET)
    .update(`${sid}.${expStr}`)
    .digest('hex');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false };
  }

  const stored = superAdminSessions.get(sid);
  if (!stored || stored.expiresAt <= Date.now()) {
    superAdminSessions.delete(sid);
    return { valid: false };
  }

  return { valid: true, sid, expiresAt: stored.expiresAt };
}

function getClientRateKey(req: express.Request): string {
  return String(req.ip || req.socket.remoteAddress || 'unknown');
}

function isLoginRateLimited(key: string): boolean {
  const entry = loginFailureMap.get(key);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    loginFailureMap.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailureMap.get(key);
  if (!entry || entry.resetAt <= now) {
    loginFailureMap.set(key, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearLoginFailures(key: string): void {
  loginFailureMap.delete(key);
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractExactErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { code?: number; status?: string; message?: string };
        message?: string;
      };
      if (parsed.error?.message) {
        const prefix = [parsed.error.code, parsed.error.status].filter(Boolean).join(' ');
        return prefix ? `${prefix}: ${parsed.error.message}` : parsed.error.message;
      }
      if (parsed.message) return parsed.message;
    } catch {
      // fall through to raw message
    }
  }
  return trimmed || 'Unable to generate Bengali disease guide.';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini API request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface DiseaseGuideRequestBody {
  indicationName?: unknown;
  category?: unknown;
  specialists?: unknown;
  keyGenerics?: unknown;
  therapeuticClasses?: unknown;
  matchedBrands?: unknown;
}

interface GeneratedDiseaseGuidePayload {
  titleBn: string;
  overview: string;
  causesAndRiskFactors: string[];
  keySymptoms: string[];
  managementAndPrevention: string[];
  specialistWarning?: string;
  mpoDetailingFocus: string[];
}

function sanitizeStringArray(val: unknown, maxItems = 12): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function isTransientServerError(err: unknown): boolean {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: number }).status)
      : 0;
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand');
}

function stripMarkdownCodeFences(raw: string): string {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  // Match fenced block anywhere in the text (e.g. prose + ```json ... ```)
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function safeParseModelJson<T extends Record<string, unknown>>(rawText: string): T {
  const cleaned = stripMarkdownCodeFences(rawText || '');
  if (!cleaned) {
    throw new Error('Empty JSON response received from Gemini model.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const extracted = extractBalancedJsonObject(cleaned);
    if (!extracted) {
      throw new Error('Model returned non-JSON output that could not be parsed.');
    }
    parsed = JSON.parse(extracted);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Model response was not a valid JSON object.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.ok === false || obj.status === 'error' || obj.error) {
    const errVal = obj.error;
    const errMsg =
      typeof errVal === 'string'
        ? errVal
        : errVal && typeof errVal === 'object' && 'message' in errVal
          ? String((errVal as { message?: unknown }).message ?? '')
          : typeof obj.message === 'string'
            ? obj.message
            : 'Model reported an error while generating structured output.';
    throw new Error(errMsg.trim() || 'Model reported an error.');
  }

  return obj as T;
}

async function generateStructuredJsonWithRetry(
  ai: GoogleGenAI,
  params: {
    contents: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
    primaryTimeoutMs?: number;
    fallbackTimeoutMs?: number;
  }
) {
  const primaryMs = params.primaryTimeoutMs ?? 11000;
  const fallbackMs = params.fallbackTimeoutMs ?? 11000;
  try {
    return await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      }),
      primaryMs
    );
  } catch (err) {
    if (!isTransientServerError(err)) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      }),
      fallbackMs
    );
  }
}

async function generateBengaliDiseaseGuide(params: {
  indicationName: string;
  category: string;
  specialists: string[];
  keyGenerics: string[];
  therapeuticClasses: string[];
  matchedBrands: string[];
}): Promise<GeneratedDiseaseGuidePayload> {
  const ai = createGeminiClient();

  const contextLines: string[] = [
    `Clinical Indication: ${params.indicationName}`,
    params.category ? `Category / Specialty Area: ${params.category}` : '',
    params.specialists.length > 0
      ? `Relevant Specialists: ${params.specialists.join(', ')}`
      : '',
    params.keyGenerics.length > 0
      ? `Key Generics: ${params.keyGenerics.join(', ')}`
      : '',
    params.therapeuticClasses.length > 0
      ? `Matched Therapeutic Classes (Drug International Limited): ${params.therapeuticClasses.join(', ')}`
      : '',
    params.matchedBrands.length > 0
      ? `Sample Matched DIL Brands: ${params.matchedBrands.join(', ')}`
      : '',
  ].filter(Boolean);

  const systemInstruction = [
    'আপনি বাংলাদেশের একজন অভিজ্ঞ ক্লিনিক্যাল মেডিকেল এডুকেটর এবং ফার্মাকোলজি বিশেষজ্ঞ।',
    'আপনি Drug International Limited (Bangladesh)-এর Medical Promotion Officers (MPO)-দের জন্য একটি নির্ভুল, আধুনিক ও সহজে বোধগম্য ক্লিনিক্যাল রোগ নির্দেশিকা (Disease Guide) তৈরি করছেন।',
    'কঠোর নির্দেশনা:',
    '১. সম্পূর্ণ উত্তরটি বিশুদ্ধ, প্রাঞ্জল ও স্বাভাবিক বাংলায় (Pure Bengali) লিখুন।',
    '২. রোগ, জেনেরিক বা থেরাপিউটিক ক্লাসের প্রচলিত ক্লিনিক্যাল নাম প্রয়োজনবোধে বাংলা উচ্চারণের পাশাপাশি বন্ধনীতে ইংরেজিতে উল্লেখ করা যাবে, তবে প্রতিটি বাক্য ও ব্যাখ্যা অবশ্যই বিশুদ্ধ বাংলায় হতে হবে।',
    '৩. তথ্যগুলো চিকিৎসাবিজ্ঞানসম্মত, বাস্তবমুখী এবং বাংলাদেশের ক্লিনিক্যাল প্র্যাকটিসের সাথে সামঞ্জস্যপূর্ণ হতে হবে।',
    '৪. প্রতিটি অংশ সংক্ষিপ্ত, স্পষ্ট ও পয়েন্ট-আকারে সাজিয়ে লিখুন যাতে একজন MPO ডাক্তারের চেম্বারে ঢোকার আগে ৩০–৬০ সেকেন্ডে চোখ বুলিয়ে নিতে পারেন।',
    '৫. "mpoDetailingFocus" অংশে অবশ্যই ২ থেকে ৩টি প্রফেশনাল ক্লিনিক্যাল ডিটেইলিং পয়েন্ট দিন, যেখানে প্রদত্ত থেরাপিউটিক ক্লাস বা জেনেরিকগুলোর ক্লিনিক্যাল গুরুত্ব তুলে ধরা হয়েছে।',
    '৬. কোনো অপ্রয়োজনীয় ভূমিকা বা মার্কডাউন চিহ্ন (যেমন ** বা #) ব্যবহার করবেন না; শুধু পরিষ্কার স্ট্রাকচার্ড JSON আউটপুট দিন।',
  ].join('\n');

  const prompt = [
    'নিম্নোক্ত ক্লিনিক্যাল ইন্ডিকেশনটির জন্য ৫টি নির্দিষ্ট অংশে একটি সম্পূর্ণ বাংলা Disease Guide তৈরি করুন:',
    '',
    ...contextLines,
    '',
    'অবশ্যই প্রতিটি ফিল্ড বিশুদ্ধ বাংলায় পূরণ করুন:',
    '- titleBn: রোগটির বাংলা ও পরিচিত ক্লিনিক্যাল শিরোনাম',
    '- overview: "রোগটি কী?" — ২ থেকে ৪ বাক্যে সহজ ও নির্ভুল সংজ্ঞা',
    '- causesAndRiskFactors: "প্রধান কারণ ও ঝুঁকির দিক" — ৪ থেকে ৬টি স্পষ্ট পয়েন্ট',
    '- keySymptoms: "মূল লক্ষণসমূহ" — ৪ থেকে ৬টি শনাক্তকারী লক্ষণ',
    '- managementAndPrevention: "প্রাথমিক করণীয়, প্রতিকার ও চিকিৎসা নীতি" — ৪ থেকে ৬টি বাস্তবসম্মত প্রতিরোধমূলক পরামর্শ, জীবনযাত্রার পরিবর্তন ও সাধারণ ক্লিনিক্যাল চিকিৎসা নীতি',
    '- specialistWarning: কখন দ্রুত বিশেষজ্ঞ চিকিৎসকের পরামর্শ নেওয়া অপরিহার্য সে সম্পর্কে ১–২ বাক্যের সতর্কতামূলক নোট',
    '- mpoDetailingFocus: "MPO ডিটেইলিং ফোকাস" — ডাক্তারের সাথে আলোচনার জন্য ২ থেকে ৩টি শক্তিশালী ক্লিনিক্যাল টকিং পয়েন্ট (প্রদত্ত থেরাপিউটিক ক্লাস/জেনেরিক উল্লেখসহ)',
  ].join('\n');

  const response = await generateStructuredJsonWithRetry(ai, {
    contents: prompt,
    systemInstruction,
    responseSchema: {
          type: Type.OBJECT,
          properties: {
            titleBn: {
              type: Type.STRING,
              description: 'Clear Bengali clinical title of the condition',
            },
            overview: {
              type: Type.STRING,
              description:
                'Clear medical definition and clinical overview in simple Bengali (2-4 sentences)',
            },
            causesAndRiskFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '4 to 6 concise causes and risk factors in pure Bengali',
            },
            keySymptoms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '4 to 6 key identifying symptoms in pure Bengali',
            },
            managementAndPrevention: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                '4 to 6 prevention tips, lifestyle advice, and clinical management principles in pure Bengali',
            },
            specialistWarning: {
              type: Type.STRING,
              description:
                'Concise red-flag note explaining when specialist consultation is essential in pure Bengali',
            },
            mpoDetailingFocus: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                '2 to 3 concise MPO detailing talking points referencing matched therapeutic classes/generics in pure Bengali',
            },
          },
          required: [
            'titleBn',
            'overview',
            'causesAndRiskFactors',
            'keySymptoms',
            'managementAndPrevention',
            'specialistWarning',
            'mpoDetailingFocus',
          ],
        },
  });

  const parsed = safeParseModelJson<Partial<GeneratedDiseaseGuidePayload> & Record<string, unknown>>(
    response.text ?? ''
  );
  const result: GeneratedDiseaseGuidePayload = {
    titleBn: String(parsed.titleBn || params.indicationName).trim(),
    overview: String(parsed.overview || '').trim(),
    causesAndRiskFactors: sanitizeStringArray(parsed.causesAndRiskFactors, 8),
    keySymptoms: sanitizeStringArray(parsed.keySymptoms, 8),
    managementAndPrevention: sanitizeStringArray(parsed.managementAndPrevention, 8),
    specialistWarning: String(parsed.specialistWarning || '').trim(),
    mpoDetailingFocus: sanitizeStringArray(parsed.mpoDetailingFocus, 5),
  };

  if (!result.overview && result.keySymptoms.length === 0) {
    throw new Error('Gemini returned an incomplete Bengali disease guide.');
  }

  return result;
}

interface DoseCalculatorRequestBody {
  genericName?: unknown;
  brandName?: unknown;
  strength?: unknown;
  dosageForm?: unknown;
  approvedIndications?: unknown;
  indication?: unknown;
  patientMode?: unknown;
  weightKg?: unknown;
  ageText?: unknown;
  renalElderlyCaution?: unknown;
}

interface GeneratedDosePayload {
  therapeuticClass: string;
  pediatric: {
    applicable: boolean;
    contraindicationBadge: string;
    mgPerKgPerDayMin: number | null;
    mgPerKgPerDayMax: number | null;
    standardRangeLabel: string;
    dosesPerDay: number;
    frequencyLabel: string;
    maxDailyDoseMg: number | null;
    maxSingleDoseMg: number | null;
    maxDailyLimitLabel: string;
    pediatricNotes: string;
  };
  adult: {
    standardDose: string;
    frequency: string;
    maxDailyLimit: string;
    indicationVariations: string[];
    renalElderlyNote: string;
  };
  duration: {
    summary: string;
    byIndication: string[];
  };
  administration: {
    mealGuidance: string;
    reconstitutionNote: string;
    keyTips: string[];
  };
  safety: {
    contraindications: string[];
    pregnancyLactation: string;
    renalHepaticCaution: string;
  };
}

function toFinitePositiveNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function generateDoseCalculation(params: {
  genericName: string;
  brandName: string;
  strength: string;
  dosageForm: string;
  approvedIndications: string;
  indication: string;
  patientMode: string;
  weightKg: number | null;
  ageText: string;
  renalElderlyCaution: boolean;
}): Promise<GeneratedDosePayload> {
  const ai = createGeminiClient();

  const contextLines: string[] = [
    `Generic Name: ${params.genericName}`,
    params.brandName ? `Brand Name (Drug International Limited): ${params.brandName}` : '',
    params.strength ? `Strength: ${params.strength}` : '',
    params.dosageForm ? `Dosage Form: ${params.dosageForm}` : '',
    params.approvedIndications ? `Approved Indications: ${params.approvedIndications}` : '',
    params.indication ? `Target Clinical Indication: ${params.indication}` : '',
    params.weightKg ? `Pediatric Body Weight: ${params.weightKg} kg` : '',
    params.ageText ? `Pediatric Age: ${params.ageText}` : '',
    `Patient Focus Mode: ${params.patientMode}`,
    `Renal / Elderly Caution Flag: ${params.renalElderlyCaution ? 'YES — provide specific renal/elderly dose adjustment guidance' : 'Standard'}`,
  ].filter(Boolean);

  const systemInstruction = [
    'You are a senior clinical pharmacologist preparing an accurate, BNF/BNFC/BDNF-aligned dosing reference for Medical Promotion Officers (MPOs) of Drug International Limited (Bangladesh).',
    'STRICT CLINICAL & OUTPUT RULES:',
    '1. Provide medically accurate, conservative, standard clinical dosing parameters for BOTH Pediatric and Adult patients.',
    '2. CRITICAL FOR NUMERIC FIELDS (used by exact frontend arithmetic):',
    '   - If the drug is NOT recommended or contraindicated in children (e.g., adult-only fluoroquinolones, tetracyclines <8 yrs, statins, adult-only antihypertensives, etc.), set pediatric.applicable = false, set mgPerKgPerDayMin = 0, mgPerKgPerDayMax = 0, maxDailyDoseMg = 0, maxSingleDoseMg = 0, and provide a clear bilingual safety badge in contraindicationBadge.',
    '   - If pediatric dosing IS standard by weight (mg/kg/day), provide accurate numeric mgPerKgPerDayMin and mgPerKgPerDayMax (for fixed mg/kg/day like Cefixime 8 mg/kg/day, set min=8, max=8; for Amoxicillin 25–45 mg/kg/day, set min=25, max=45; for combination products like Co-amoxiclav, state clearly in pediatricNotes that the mg/kg/day is based on the Amoxicillin component).',
    '   - Always set dosesPerDay as a positive integer (1 for OD, 2 for BD, 3 for TDS, 4 for QID).',
    '   - Always set maxDailyDoseMg (e.g., 400 for Cefixime, 500 for Azithromycin, 4000 for Paracetamol, etc.) so the frontend strictly enforces the daily cap. Set 0 only if mg-based weight dosing does not apply (e.g., fixed-dose drops/topical/inhaler/mcg drug).',
    '   - For microgram (mcg) drugs or non-weight-based fixed pediatric doses (e.g., Montelukast 4mg/5mg by age, Cetirizine 2.5–5mg by age, Levocetirizine, topical/inhaler), set mgPerKgPerDayMin = 0 and mgPerKgPerDayMax = 0, keep applicable = true, and write the exact age-based pediatric dose clearly in standardRangeLabel and pediatricNotes.',
    '3. Keep every string crisp, scannable, and concise (1 short sentence or bullet max) in clean English paired with brief natural Bengali where helpful (e.g., "BD (প্রতি ১২ ঘণ্টা পরপর)", "After meal (খাবার পর)").',
    '4. No markdown syntax (** or #) inside JSON strings; return clean structured JSON only.',
  ].join('\n');

  const prompt = [
    'Generate a concise, structured Pediatric + Adult Dose Calculation Reference for:',
    '',
    ...contextLines,
    '',
    'Populate all required fields accurately for the 5 reference cards: Pediatric Dose, Adult Dose, Duration of Therapy, Administration & Key Notes, and Safety & Renal/Pregnancy Note.',
  ].join('\n');

  const response = await generateStructuredJsonWithRetry(ai, {
    contents: prompt,
    systemInstruction,
    primaryTimeoutMs: 22000,
    fallbackTimeoutMs: 15000,
    responseSchema: {
          type: Type.OBJECT,
          properties: {
            therapeuticClass: {
              type: Type.STRING,
              description: 'Concise pharmacological / therapeutic class of the generic',
            },
            pediatric: {
              type: Type.OBJECT,
              properties: {
                applicable: {
                  type: Type.BOOLEAN,
                  description: 'true if used in pediatric patients; false if contraindicated or not routinely recommended in children',
                },
                contraindicationBadge: {
                  type: Type.STRING,
                  description: 'Short bilingual safety badge if applicable is false; empty string if applicable is true',
                },
                mgPerKgPerDayMin: {
                  type: Type.NUMBER,
                  description: 'Minimum standard daily pediatric dose in mg/kg/day (0 if fixed age-based dose, mcg drug, or not applicable)',
                },
                mgPerKgPerDayMax: {
                  type: Type.NUMBER,
                  description: 'Maximum standard daily pediatric dose in mg/kg/day (equal to min if fixed mg/kg/day; 0 if not weight-based)',
                },
                standardRangeLabel: {
                  type: Type.STRING,
                  description: 'Readable standard pediatric dosing rule (e.g., "8 mg/kg/day (or 4 mg/kg every 12h)" or age-based dose)',
                },
                dosesPerDay: {
                  type: Type.INTEGER,
                  description: 'Number of divided doses per day (1=OD, 2=BD, 3=TDS, 4=QID)',
                },
                frequencyLabel: {
                  type: Type.STRING,
                  description: 'Dosing frequency in English + Bengali (e.g., "BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)")',
                },
                maxDailyDoseMg: {
                  type: Type.NUMBER,
                  description: 'Maximum pediatric daily dose cap in mg (0 if not applicable)',
                },
                maxSingleDoseMg: {
                  type: Type.NUMBER,
                  description: 'Maximum pediatric single dose cap in mg (0 if not applicable)',
                },
                maxDailyLimitLabel: {
                  type: Type.STRING,
                  description: 'Human-readable max daily limit (e.g., "Max 400 mg/day")',
                },
                pediatricNotes: {
                  type: Type.STRING,
                  description: 'Concise clinical pediatric dosing guidance including age thresholds or active component notes (English + concise Bengali)',
                },
              },
              required: [
                'applicable',
                'contraindicationBadge',
                'mgPerKgPerDayMin',
                'mgPerKgPerDayMax',
                'standardRangeLabel',
                'dosesPerDay',
                'frequencyLabel',
                'maxDailyDoseMg',
                'maxSingleDoseMg',
                'maxDailyLimitLabel',
                'pediatricNotes',
              ],
            },
            adult: {
              type: Type.OBJECT,
              properties: {
                standardDose: {
                  type: Type.STRING,
                  description: 'Standard adult single or daily dose (e.g., "200–400 mg")',
                },
                frequency: {
                  type: Type.STRING,
                  description: 'Standard adult dosing frequency in English + Bengali',
                },
                maxDailyLimit: {
                  type: Type.STRING,
                  description: 'Maximum adult daily dose limit',
                },
                indicationVariations: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 4 indication-specific adult dosing variations',
                },
                renalElderlyNote: {
                  type: Type.STRING,
                  description: 'Specific dose adjustment or precaution for renal impairment / elderly patients (English + Bengali)',
                },
              },
              required: [
                'standardDose',
                'frequency',
                'maxDailyLimit',
                'indicationVariations',
                'renalElderlyNote',
              ],
            },
            duration: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: 'Primary recommended treatment duration in English + Bengali (e.g., "7–10 days (সাধারণত ৭–১০ দিন)")',
                },
                byIndication: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 5 duration recommendations tailored to common approved indications',
                },
              },
              required: ['summary', 'byIndication'],
            },
            administration: {
              type: Type.OBJECT,
              properties: {
                mealGuidance: {
                  type: Type.STRING,
                  description: 'Before/after meal guidance in English + Bengali',
                },
                reconstitutionNote: {
                  type: Type.STRING,
                  description: 'PFS reconstitution, shake-well, storage stability note (or practical form guidance if tablet/capsule/injection)',
                },
                keyTips: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 4 concise practical administration tips',
                },
              },
              required: ['mealGuidance', 'reconstitutionNote', 'keyTips'],
            },
            safety: {
              type: Type.OBJECT,
              properties: {
                contraindications: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '2 to 4 key contraindications or critical warnings',
                },
                pregnancyLactation: {
                  type: Type.STRING,
                  description: 'Concise pregnancy and breastfeeding safety note',
                },
                renalHepaticCaution: {
                  type: Type.STRING,
                  description: 'Concise renal and hepatic caution note',
                },
              },
              required: ['contraindications', 'pregnancyLactation', 'renalHepaticCaution'],
            },
          },
          required: [
            'therapeuticClass',
            'pediatric',
            'adult',
            'duration',
            'administration',
            'safety',
          ],
        },
  });

  const parsed = safeParseModelJson<Partial<GeneratedDosePayload> & Record<string, unknown>>(
    response.text ?? ''
  );
  const ped = parsed.pediatric;
  const adult = parsed.adult;
  const duration = parsed.duration;
  const admin = parsed.administration;
  const safety = parsed.safety;

  if (!ped || !adult || !duration || !admin || !safety) {
    throw new Error('Incomplete dose calculation returned by Gemini.');
  }

  const rawDoses = Number(ped.dosesPerDay);
  const dosesPerDay =
    Number.isFinite(rawDoses) && rawDoses >= 1 && rawDoses <= 6 ? Math.round(rawDoses) : 2;

  return {
    therapeuticClass: String(parsed.therapeuticClass ?? '').trim(),
    pediatric: {
      applicable: Boolean(ped.applicable),
      contraindicationBadge: String(ped.contraindicationBadge ?? '').trim(),
      mgPerKgPerDayMin: toFinitePositiveNumber(ped.mgPerKgPerDayMin),
      mgPerKgPerDayMax: toFinitePositiveNumber(ped.mgPerKgPerDayMax),
      standardRangeLabel: String(ped.standardRangeLabel ?? '').trim(),
      dosesPerDay,
      frequencyLabel: String(ped.frequencyLabel ?? '').trim(),
      maxDailyDoseMg: toFinitePositiveNumber(ped.maxDailyDoseMg),
      maxSingleDoseMg: toFinitePositiveNumber(ped.maxSingleDoseMg),
      maxDailyLimitLabel: String(ped.maxDailyLimitLabel ?? '').trim(),
      pediatricNotes: String(ped.pediatricNotes ?? '').trim(),
    },
    adult: {
      standardDose: String(adult.standardDose ?? '').trim(),
      frequency: String(adult.frequency ?? '').trim(),
      maxDailyLimit: String(adult.maxDailyLimit ?? '').trim(),
      indicationVariations: sanitizeStringArray(adult.indicationVariations, 6),
      renalElderlyNote: String(adult.renalElderlyNote ?? '').trim(),
    },
    duration: {
      summary: String(duration.summary ?? '').trim(),
      byIndication: sanitizeStringArray(duration.byIndication, 6),
    },
    administration: {
      mealGuidance: String(admin.mealGuidance ?? '').trim(),
      reconstitutionNote: String(admin.reconstitutionNote ?? '').trim(),
      keyTips: sanitizeStringArray(admin.keyTips, 6),
    },
    safety: {
      contraindications: sanitizeStringArray(safety.contraindications, 6),
      pregnancyLactation: String(safety.pregnancyLactation ?? '').trim(),
      renalHepaticCaution: String(safety.renalHepaticCaution ?? '').trim(),
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/disease-guide', async (req, res) => {
    try {
      const body = (req.body || {}) as DiseaseGuideRequestBody;
      const indicationName = String(body.indicationName ?? '').trim().slice(0, 200);
      if (!indicationName) {
        res.status(400).json({
          status: 'error',
          message: 'indicationName is required.',
        });
        return;
      }

      const category = String(body.category ?? '').trim().slice(0, 120);
      const specialists = sanitizeStringArray(body.specialists, 10);
      const keyGenerics = sanitizeStringArray(body.keyGenerics, 15);
      const therapeuticClasses = sanitizeStringArray(body.therapeuticClasses, 10);
      const matchedBrands = sanitizeStringArray(body.matchedBrands, 8);

      const guide = await generateBengaliDiseaseGuide({
        indicationName,
        category,
        specialists,
        keyGenerics,
        therapeuticClasses,
        matchedBrands,
      });

      res.json({
        status: 'success',
        guide,
      });
    } catch (err) {
      const message = extractExactErrorMessage(err);
      const isTimeout = message.toLowerCase().includes('timed out');
      const statusCode = isTimeout
        ? 504
        : typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status?: number }).status === 'number' &&
            (err as { status: number }).status >= 400 &&
            (err as { status: number }).status < 600
          ? (err as { status: number }).status
          : 500;

      res.status(statusCode).json({
        status: 'error',
        message,
      });
    }
  });

  app.post('/api/dose-calculator', async (req, res) => {
    try {
      const body = (req.body || {}) as DoseCalculatorRequestBody;
      const genericName = String(body.genericName ?? '').trim().slice(0, 180);
      if (!genericName) {
        res.status(400).json({
          status: 'error',
          message: 'genericName is required.',
        });
        return;
      }

      const brandName = String(body.brandName ?? '').trim().slice(0, 140);
      const strength = String(body.strength ?? '').trim().slice(0, 100);
      const dosageForm = String(body.dosageForm ?? '').trim().slice(0, 80);
      const approvedIndications = String(body.approvedIndications ?? '').trim().slice(0, 350);
      const indication = String(body.indication ?? '').trim().slice(0, 160);
      const patientMode = String(body.patientMode ?? 'both').trim().slice(0, 20);
      const weightKg = toFinitePositiveNumber(body.weightKg);
      const ageText = String(body.ageText ?? '').trim().slice(0, 60);
      const renalElderlyCaution = Boolean(body.renalElderlyCaution);

      const calculation = await generateDoseCalculation({
        genericName,
        brandName,
        strength,
        dosageForm,
        approvedIndications,
        indication,
        patientMode,
        weightKg,
        ageText,
        renalElderlyCaution,
      });

      res.json({
        status: 'success',
        calculation,
      });
    } catch (err) {
      const message = extractExactErrorMessage(err);
      const isTimeout = message.toLowerCase().includes('timed out');
      const statusCode = isTimeout
        ? 504
        : typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status?: number }).status === 'number' &&
            (err as { status: number }).status >= 400 &&
            (err as { status: number }).status < 600
          ? (err as { status: number }).status
          : 500;

      res.status(statusCode).json({
        status: 'error',
        ok: false,
        error: message,
        message,
      });
    }
  });

  // --- Super Admin Access Endpoints (Server-Verified Passcode & Bearer Session) ---
  app.get('/api/super-admin/status', (req, res) => {
    const source = getSuperAdminSource();
    const token = parseBearerToken(req.headers.authorization);
    const session = verifySuperAdminSessionToken(token);
    res.json({
      ok: true,
      configured: source !== 'unconfigured',
      source,
      authenticated: session.valid,
      expiresAt: session.valid ? session.expiresAt : null,
    });
  });

  app.post('/api/super-admin/setup', (req, res) => {
    const source = getSuperAdminSource();
    if (source !== 'unconfigured') {
      res.status(409).json({
        ok: false,
        error:
          source === 'env'
            ? 'Super Admin passcode is already configured in server secrets.'
            : 'Super Admin passcode has already been set. Sign in with your existing passcode.',
      });
      return;
    }

    const passcode = String((req.body as { passcode?: unknown })?.passcode ?? '').trim();
    if (passcode.length < 6 || passcode.length > 128) {
      res.status(400).json({
        ok: false,
        error: 'Passcode must be between 6 and 128 characters.',
      });
      return;
    }

    claimedAdminCredential = hashPasscodeWithScrypt(passcode);
    const { token, expiresAt } = issueSuperAdminSessionToken();
    res.status(201).json({
      ok: true,
      source: 'claimed',
      token,
      expiresAt,
    });
  });

  app.post('/api/super-admin/login', (req, res) => {
    const source = getSuperAdminSource();
    if (source === 'unconfigured') {
      res.status(400).json({
        ok: false,
        error: 'No Super Admin passcode configured yet. Set up your initial passcode first.',
      });
      return;
    }

    const rateKey = getClientRateKey(req);
    if (isLoginRateLimited(rateKey)) {
      res.status(429).json({
        ok: false,
        error: 'Too many failed passcode attempts. Please wait 15 minutes and try again.',
      });
      return;
    }

    const passcode = String((req.body as { passcode?: unknown })?.passcode ?? '').trim();
    if (!passcode || !verifyPasscodeAgainstServer(passcode)) {
      recordLoginFailure(rateKey);
      res.status(401).json({
        ok: false,
        error: 'Invalid Super Admin passcode.',
      });
      return;
    }

    clearLoginFailures(rateKey);
    const { token, expiresAt } = issueSuperAdminSessionToken();
    res.json({
      ok: true,
      source,
      token,
      expiresAt,
    });
  });

  app.post('/api/super-admin/change-passcode', (req, res) => {
    const token = parseBearerToken(req.headers.authorization);
    const session = verifySuperAdminSessionToken(token);
    if (!session.valid) {
      res.status(401).json({
        ok: false,
        error: 'Super Admin sign-in required.',
      });
      return;
    }

    if (getEnvSuperAdminPasscode()) {
      res.status(403).json({
        ok: false,
        error: 'Passcode is managed via server Secrets (SUPER_ADMIN_PASSCODE). Update it in Settings > Secrets.',
      });
      return;
    }

    const body = (req.body || {}) as { currentPasscode?: unknown; newPasscode?: unknown };
    const currentPasscode = String(body.currentPasscode ?? '').trim();
    const newPasscode = String(body.newPasscode ?? '').trim();

    if (!verifyPasscodeAgainstServer(currentPasscode)) {
      res.status(401).json({
        ok: false,
        error: 'Current passcode is incorrect.',
      });
      return;
    }

    if (newPasscode.length < 6 || newPasscode.length > 128) {
      res.status(400).json({
        ok: false,
        error: 'New passcode must be between 6 and 128 characters.',
      });
      return;
    }

    claimedAdminCredential = hashPasscodeWithScrypt(newPasscode);
    res.json({ ok: true });
  });

  app.post('/api/super-admin/logout', (req, res) => {
    const token = parseBearerToken(req.headers.authorization);
    const session = verifySuperAdminSessionToken(token);
    if (session.valid && session.sid) {
      superAdminSessions.delete(session.sid);
    }
    res.json({ ok: true });
  });

  app.get('/api/public-config', (_req, res) => {
    const resolved = getEffectiveDefaultApiUrl();
    res.json({
      ok: true,
      defaultApiUrl: resolved.url,
      source: resolved.source,
    });
  });

  app.post('/api/super-admin/default-api-url', (req, res) => {
    const token = parseBearerToken(req.headers.authorization);
    const session = verifySuperAdminSessionToken(token);
    if (!session.valid) {
      res.status(401).json({
        ok: false,
        error: 'Super Admin sign-in required.',
      });
      return;
    }

    const rawUrl = String((req.body as { apiUrl?: unknown })?.apiUrl ?? '').trim();
    if (rawUrl && !isValidHttpUrl(rawUrl)) {
      res.status(400).json({
        ok: false,
        error: 'Enter a valid http:// or https:// Google Apps Script Web App URL.',
      });
      return;
    }

    persistedDefaultApiUrl = rawUrl;
    persistDefaultApiUrl(rawUrl);
    const resolved = getEffectiveDefaultApiUrl();
    res.json({
      ok: true,
      defaultApiUrl: resolved.url,
      source: resolved.source,
    });
  });

  // Never let unknown /api/* routes fall through to SPA HTML (which causes HTTP 200 JSON parse errors)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      status: 'error',
      ok: false,
      error: `API route not found: ${req.method} ${req.path}`,
      message: `API route not found: ${req.method} ${req.path}`,
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Medical Field Assistant – DI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
