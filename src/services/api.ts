import {
  ApiGetResponse,
  ApiPostPayload,
  Chamber,
  ComputedPediatricDose,
  Department,
  DiseaseGuideBN,
  Doctor,
  DoctorType,
  DoseCalculationResult,
  DosePatientMode,
  FieldDataset,
  Indication,
  KnowledgeChapter,
  ParsedLiquidStrength,
  Product,
  ProductGroupCode,
  QueuedMutation,
  SheetName,
  TeamSession,
  VISITING_DAYS_LIST,
} from '../types';
import { createStarterDataset } from '../data/seedData';

const ENV_DEFAULT_API_URL =
  typeof import.meta !== 'undefined' &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_APPS_SCRIPT_URL
    ? String(
        (import.meta as unknown as { env?: Record<string, string | undefined> }).env
          ?.VITE_APPS_SCRIPT_URL
      ).trim()
    : '';

export const DEFAULT_API_URL = ENV_DEFAULT_API_URL || 'YOUR_WEB_APP_URL';

const PLACEHOLDER_API_URLS = new Set([
  'PASTE_YOUR_WEB_APP_URL_HERE',
  'YOUR_WEB_APP_URL',
]);

const STORAGE_KEYS = {
  API_URL: 'mfa_di_api_url',
  DATA_CACHE: 'mfa_di_cached_dataset',
  SYNC_QUEUE: 'mfa_di_sync_queue',
  PENDING_GROUP_UPDATES: 'mfa_di_pending_product_groups',
  LAST_SYNC: 'mfa_di_last_sync',
  ACTIVE_MPO: 'mfa_di_active_mpo',
  THEME: 'mfa_di_theme',
  ADMIN_PIN: 'mfa_di_admin_pin',
  ADMIN_PIN_LOCK: 'mfa_di_admin_pin_lock',
  TEAM_SESSION: 'mfa_di_team_session',
  TEAM_PIN: 'mfa_di_team_pin',
} as const;

export const DEFAULT_ADMIN_PIN = '1234';

export function isConfiguredApiUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  return (
    trimmed.length > 0 &&
    !PLACEHOLDER_API_URLS.has(trimmed) &&
    (trimmed.startsWith('https://') || trimmed.startsWith('http://'))
  );
}

export function getSavedApiUrl(): string {
  try {
    const saved = (localStorage.getItem(STORAGE_KEYS.API_URL) || '').trim();
    if (saved && !PLACEHOLDER_API_URLS.has(saved)) {
      return saved;
    }
    return DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export function saveApiUrl(url: string): void {
  try {
    const cleaned = url.trim() || DEFAULT_API_URL;
    localStorage.setItem(STORAGE_KEYS.API_URL, cleaned);
  } catch {
    // Ignore storage quota errors
  }
}

export function getSavedActiveMpoId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_MPO) || 'MPO-101';
  } catch {
    return 'MPO-101';
  }
}

export function saveActiveMpoId(mpoId: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MPO, mpoId);
  } catch {
    // Ignore
  }
}

export function getSavedTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {
    // Ignore
  }
}

export function getLastSyncTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

export function saveLastSyncTime(isoString: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, isoString);
  } catch {
    // Ignore
  }
}

export function getSavedAdminPin(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_ADMIN_PIN;
  } catch {
    return DEFAULT_ADMIN_PIN;
  }
}

export function saveAdminPin(pin: string): void {
  try {
    const cleaned = pin.trim();
    localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, cleaned || DEFAULT_ADMIN_PIN);
  } catch {
    // Ignore
  }
}

export function getSavedAdminPinLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PIN_LOCK) === 'true';
  } catch {
    return false;
  }
}

export function saveAdminPinLockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PIN_LOCK, enabled ? 'true' : 'false');
  } catch {
    // Ignore
  }
}

export function isAdminOrManagerRole(role?: string | null): boolean {
  const norm = String(role ?? '').trim().toLowerCase();
  return norm === 'admin' || norm === 'area manager';
}

export function getSavedTeamPin(): string {
  try {
    return (localStorage.getItem(STORAGE_KEYS.TEAM_PIN) || '').trim();
  } catch {
    return '';
  }
}

export function saveTeamPin(pin: string): void {
  try {
    const cleaned = pin.trim();
    if (!cleaned) {
      localStorage.removeItem(STORAGE_KEYS.TEAM_PIN);
    } else {
      localStorage.setItem(STORAGE_KEYS.TEAM_PIN, cleaned);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getSavedTeamSession(): TeamSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAM_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TeamSession>;
    if (!parsed || typeof parsed !== 'object' || !parsed.areaId || !parsed.areaName) {
      return null;
    }
    return {
      loginMode:
        parsed.loginMode === 'firebase'
          ? 'firebase'
          : parsed.loginMode === 'mpo'
            ? 'mpo'
            : 'area',
      uid: parsed.uid ? String(parsed.uid) : undefined,
      email: parsed.email ? String(parsed.email) : undefined,
      areaId: String(parsed.areaId),
      areaName: String(parsed.areaName),
      district: String(parsed.district || ''),
      upazila: parsed.upazila ? String(parsed.upazila) : undefined,
      zone: String(parsed.zone || ''),
      mpoId: parsed.mpoId ? String(parsed.mpoId) : undefined,
      mpoName: parsed.mpoName ? String(parsed.mpoName) : undefined,
      role: parsed.role ? String(parsed.role) : undefined,
      employeeCode: parsed.employeeCode ? String(parsed.employeeCode) : undefined,
      canSwitchAreas: Boolean(parsed.canSwitchAreas),
      loggedInAt: String(parsed.loggedInAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function saveTeamSession(session: TeamSession): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAM_SESSION, JSON.stringify(session));
  } catch {
    // Ignore storage errors
  }
}

export function clearTeamSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TEAM_SESSION);
  } catch {
    // Ignore storage errors
  }
}

function normalizePhoneDigits(phone?: string | null): string {
  return String(phone ?? '').replace(/\D/g, '');
}

/**
 * Verifies Area/District + Team PIN login against synced Areas & MPO_Users sheets
 * (works online and offline using cached localStorage sheet data).
 */
export function authenticateAreaTeam(
  dataset: FieldDataset,
  areaId: string,
  pinInput: string
): { ok: true; session: TeamSession } | { ok: false; error: string } {
  const cleanedPin = pinInput.trim();
  if (!areaId.trim()) {
    return { ok: false, error: 'Please select an Area / District first.' };
  }
  if (!cleanedPin) {
    return { ok: false, error: 'Please enter your Team PIN or Area code.' };
  }

  const area = dataset.Areas.find((a) => a.Area_ID === areaId);
  if (!area) {
    return { ok: false, error: 'Selected area was not found in the synced dataset.' };
  }

  const assignedMpo = dataset.MPO_Users.find(
    (m) =>
      (area.Assigned_MPO_ID && m.MPO_ID === area.Assigned_MPO_ID) || m.Area_ID === area.Area_ID
  );

  const pinLower = cleanedPin.toLowerCase();
  const explicitAreaPin = String(area.Team_PIN ?? '').trim();
  const deviceTeamPin = getSavedTeamPin();

  let matched = false;
  if (explicitAreaPin) {
    matched = explicitAreaPin.toLowerCase() === pinLower;
  } else {
    // Sheet doesn't have an Area Team_PIN column populated yet:
    // Accept Area_ID (e.g., AREA-01), assigned MPO's PIN/Employee_ID/MPO_ID, or user-configured device Team PIN
    const candidates = [
      area.Area_ID,
      area.Area_ID.replace(/^AREA[-_]?/i, ''),
      assignedMpo?.PIN,
      assignedMpo?.Employee_ID,
      assignedMpo?.Employee_Code,
      assignedMpo?.MPO_ID,
      deviceTeamPin,
    ]
      .map((v) => String(v ?? '').trim().toLowerCase())
      .filter(Boolean);

    matched = candidates.includes(pinLower);
  }

  if (!matched) {
    return {
      ok: false,
      error: explicitAreaPin
        ? 'Incorrect Team PIN for this area. Check with your Area Manager or try MPO User Login.'
        : `Incorrect PIN. Use the area Team PIN (if configured in Settings or Google Sheet), Area ID (${area.Area_ID}), or switch to MPO User Login.`,
    };
  }

  return {
    ok: true,
    session: {
      loginMode: 'area',
      areaId: area.Area_ID,
      areaName: area.Area_Name,
      district: area.District || '',
      zone: area.Zone || area.Territory || '',
      mpoId: assignedMpo?.MPO_ID,
      mpoName: assignedMpo?.MPO_Name,
      role: 'Area Team',
      canSwitchAreas: false,
      loggedInAt: new Date().toISOString(),
    },
  };
}

/**
 * Verifies MPO User credentials against the synced MPO_Users sheet
 * (works online and offline using cached localStorage sheet data).
 */
export function authenticateMpoUser(
  dataset: FieldDataset,
  identifierInput: string,
  pinInput: string
): { ok: true; session: TeamSession } | { ok: false; error: string } {
  const idClean = identifierInput.trim().toLowerCase();
  const idDigits = normalizePhoneDigits(identifierInput);
  const pinClean = pinInput.trim();
  const pinLower = pinClean.toLowerCase();

  if (!idClean) {
    return { ok: false, error: 'Enter your MPO ID, Employee ID, Email, or Phone.' };
  }
  if (!pinClean) {
    return { ok: false, error: 'Enter your PIN or verification code.' };
  }

  const matchedUser = dataset.MPO_Users.find((u) => {
    const status = String(u.Status ?? 'Active').trim().toLowerCase();
    if (status === 'inactive' || status === 'disabled') return false;
    const uPhoneDigits = normalizePhoneDigits(u.Phone_Number || u.Phone);
    return (
      String(u.MPO_ID ?? '').trim().toLowerCase() === idClean ||
      String(u.Employee_ID ?? '').trim().toLowerCase() === idClean ||
      String(u.Employee_Code ?? '').trim().toLowerCase() === idClean ||
      String(u.Email ?? '').trim().toLowerCase() === idClean ||
      (idDigits.length >= 6 && uPhoneDigits.endsWith(idDigits))
    );
  });

  if (!matchedUser) {
    return {
      ok: false,
      error: 'No active officer matched that MPO ID, Employee ID, Email, or Phone.',
    };
  }

  const linkedArea =
    dataset.Areas.find((a) => a.Area_ID === matchedUser.Area_ID) ||
    dataset.Areas.find(
      (a) =>
        matchedUser.Area &&
        a.Area_Name.toLowerCase() === String(matchedUser.Area).trim().toLowerCase()
    ) ||
    dataset.Areas[0];

  const explicitUserPin = String(matchedUser.PIN ?? '').trim();
  const explicitAreaPin = String(linkedArea?.Team_PIN ?? '').trim();
  const deviceTeamPin = getSavedTeamPin();
  const phoneDigits = normalizePhoneDigits(matchedUser.Phone_Number || matchedUser.Phone);
  const phoneLast4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : '';

  let pinMatched = false;
  if (explicitUserPin) {
    pinMatched = explicitUserPin.toLowerCase() === pinLower;
  } else {
    const candidates = [
      matchedUser.Employee_ID,
      matchedUser.Employee_Code,
      matchedUser.MPO_ID,
      phoneLast4,
      explicitAreaPin,
      deviceTeamPin,
    ]
      .map((v) => String(v ?? '').trim().toLowerCase())
      .filter(Boolean);
    pinMatched = candidates.includes(pinLower);
  }

  if (!pinMatched) {
    return {
      ok: false,
      error: explicitUserPin
        ? 'Incorrect PIN for this MPO account.'
        : 'Verification failed. Use your MPO PIN, Employee Code, MPO ID, or last 4 digits of your registered phone.',
    };
  }

  const canSwitch = isAdminOrManagerRole(matchedUser.Role || matchedUser.Designation);

  return {
    ok: true,
    session: {
      loginMode: 'mpo',
      areaId: linkedArea?.Area_ID || matchedUser.Area_ID || 'ALL',
      areaName: linkedArea?.Area_Name || matchedUser.Area || 'Assigned Territory',
      district: linkedArea?.District || '',
      zone: linkedArea?.Zone || matchedUser.Territory || '',
      mpoId: matchedUser.MPO_ID,
      mpoName: matchedUser.MPO_Name,
      role: matchedUser.Role || matchedUser.Designation || 'MPO',
      employeeCode: matchedUser.Employee_ID || matchedUser.Employee_Code,
      canSwitchAreas: canSwitch,
      loggedInAt: new Date().toISOString(),
    },
  };
}

export function isActiveRecord(row?: Record<string, unknown> | null): boolean {
  if (!row || typeof row !== 'object') return false;
  const raw = String(row.Status ?? row.status ?? '').trim().toLowerCase();
  if (!raw) return true;
  return raw !== 'inactive' && raw !== 'disabled' && raw !== 'archived' && raw !== 'false';
}

export function getFieldValueCI(
  row: Record<string, unknown> | undefined | null,
  candidateKeys: string[]
): string {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  for (const candidate of candidateKeys) {
    const exact = row[candidate];
    if (exact !== undefined && exact !== null && String(exact).trim() !== '') {
      return String(exact).trim();
    }
    const lowerCandidate = candidate.toLowerCase();
    const matched = keys.find((k) => k.trim().toLowerCase() === lowerCandidate);
    if (matched) {
      const val = row[matched];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }
  return '';
}

function isNonEmptyRow(row: unknown): row is Record<string, unknown> {
  if (!row || typeof row !== 'object') return false;
  return Object.values(row as Record<string, unknown>).some(
    (val) => val !== undefined && val !== null && String(val).trim() !== ''
  );
}

/**
 * Counts valid/active rows accurately across live Google Sheets tabs:
 * - Case-insensitive check for Status === "Active"
 * - Or non-empty ID (when Status is absent/empty or not explicitly Inactive)
 */
export function countActiveRecords<T extends object>(rows: T[], idKeys: string[]): number {
  if (!Array.isArray(rows)) return 0;
  return rows.filter((item) => {
    const row = item as unknown as Record<string, unknown>;
    if (!isNonEmptyRow(row)) return false;

    const status = getFieldValueCI(row, ['Status']).toLowerCase();
    const idValue = getFieldValueCI(row, [...idKeys, 'ID']);

    if (status === 'active') return true;
    if (status === 'inactive' || status === 'deleted' || status === 'archived') return false;
    return idValue.length > 0 || isNonEmptyRow(row);
  }).length;
}

export function formatMpoSubtitle(
  mpo: Record<string, unknown> | undefined | null,
  areaLookup?: Map<string, { Area_Name: string; Zone?: string; District?: string }>
): string {
  if (!mpo) return 'MPO Management System';

  const name = getFieldValueCI(mpo, ['MPO_Name', 'Name', 'Full_Name']);
  const role = getFieldValueCI(mpo, ['Role', 'Designation', 'Position', 'Employee_Code']);
  const territory = getFieldValueCI(mpo, ['Territory', 'Zone']);
  const areaDirect = getFieldValueCI(mpo, ['Area', 'Area_Name']);
  const areaId = getFieldValueCI(mpo, ['Area_ID']);
  const areaFromMap = areaId && areaLookup ? areaLookup.get(areaId)?.Area_Name || '' : '';
  const zoneFromMap = areaId && areaLookup ? areaLookup.get(areaId)?.Zone || '' : '';

  const resolvedArea = areaDirect || areaFromMap || areaId;
  const resolvedTerritory = territory || (zoneFromMap && zoneFromMap !== resolvedArea ? zoneFromMap : '');

  const locationParts = [resolvedTerritory, resolvedArea].filter(
    (val, idx, arr) => val.length > 0 && arr.indexOf(val) === idx
  );
  const locationText = locationParts.join(' / ');

  const identityPart = name ? (role ? `${name} (${role})` : name) : role;

  if (identityPart && locationText) {
    return `${identityPart} · ${locationText}`;
  }
  return identityPart || locationText || 'MPO Management System';
}

export function normalizeDataset(raw?: Partial<FieldDataset> | null): FieldDataset {
  const fallback = createStarterDataset();
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const cleanList = (list: unknown): Record<string, unknown>[] =>
    Array.isArray(list) ? list.filter(isNonEmptyRow) : [];

  const rawRecord = raw as Record<string, unknown>;
  const getRawSheetRows = (candidates: string[]): Record<string, unknown>[] => {
    for (const key of candidates) {
      if (Array.isArray(rawRecord[key])) {
        return cleanList(rawRecord[key]);
      }
    }
    const lowerMap = new Map<string, unknown>();
    Object.entries(rawRecord).forEach(([k, v]) => {
      lowerMap.set(k.trim().toLowerCase().replace(/[\s-]+/g, '_'), v);
    });
    for (const key of candidates) {
      const found = lowerMap.get(key.trim().toLowerCase().replace(/[\s-]+/g, '_'));
      if (Array.isArray(found)) {
        return cleanList(found);
      }
    }
    return [];
  };

  const normalizeKnowledgeChapters = (rows: Record<string, unknown>[]): KnowledgeChapter[] =>
    rows
      .map((row) => ({
        Chapter_No: getFieldValueCI(row, ['Chapter_No', 'Chapter', 'Chapter_ID', 'ID', 'No']),
        Title_BN: getFieldValueCI(row, ['Title_BN', 'Title', 'Chapter_Title', 'Heading_BN']),
        Category: getFieldValueCI(row, ['Category', 'Topic', 'Section', 'Module']),
        Read_Time: getFieldValueCI(row, ['Read_Time', 'Read Time', 'Duration', 'Reading_Time']),
        Short_Summary_BN: getFieldValueCI(row, [
          'Short_Summary_BN',
          'Short_Summary',
          'Summary_BN',
          'Summary',
          'Excerpt_BN',
        ]),
        Full_Content_BN: getFieldValueCI(row, [
          'Full_Content_BN',
          'Full_Content',
          'Content_BN',
          'Content',
          'Body_BN',
          'Body',
        ]),
        Key_Takeaway_BN: getFieldValueCI(row, [
          'Key_Takeaway_BN',
          'Key_Takeaway',
          'Takeaway_BN',
          'Takeaway',
          'Key_Message_BN',
        ]),
        Video_URL: getFieldValueCI(row, [
          'Video_URL',
          'YouTube_URL',
          'Youtube_URL',
          'Video_Link',
          'YouTube_Link',
          'Video',
        ]),
        Status: getFieldValueCI(row, ['Status']),
      }))
      .filter(
        (ch) =>
          String(ch.Status ?? '').trim().toLowerCase() === 'active' &&
          (ch.Title_BN.length > 0 || ch.Chapter_No.length > 0)
      );

  return {
    Hospitals: cleanList(raw.Hospitals).map((row) => ({
      ...row,
      Hospital_ID: getFieldValueCI(row, ['Hospital_ID', 'ID']),
      Hospital_Name: getFieldValueCI(row, ['Hospital_Name', 'Name']),
      Area_ID: getFieldValueCI(row, ['Area_ID', 'Area']),
      Hospital_Type: getFieldValueCI(row, ['Hospital_Type', 'Type']),
      Address: getFieldValueCI(row, ['Address']),
      Phone: getFieldValueCI(row, ['Phone', 'Contact']),
      Status: getFieldValueCI(row, ['Status']),
    })),
    Doctors: cleanList(raw.Doctors).map((row) => ({
      ...row,
      Doctor_ID: getFieldValueCI(row, ['Doctor_ID', 'ID']),
      Doctor_Name: getFieldValueCI(row, ['Doctor_Name', 'Name']),
      Degree: getFieldValueCI(row, ['Degree', 'Qualification']),
      Specialty: getFieldValueCI(row, ['Specialty', 'Speciality', 'Specialist']),
      Department_ID: getFieldValueCI(row, ['Department_ID', 'Department']),
      Primary_Hospital_ID: getFieldValueCI(row, ['Primary_Hospital_ID', 'Hospital_ID']),
      Area_ID: getFieldValueCI(row, ['Area_ID', 'Area']),
      Phone: getFieldValueCI(row, ['Phone', 'Mobile']),
      Email: getFieldValueCI(row, ['Email']),
      Category: getFieldValueCI(row, ['Category', 'Tier']),
      Doctor_Type: getFieldValueCI(row, ['Doctor_Type', 'Type']),
      Visiting_Days: getFieldValueCI(row, ['Visiting_Days', 'Days']),
      Visiting_Hours: getFieldValueCI(row, ['Visiting_Hours', 'Visiting_Time', 'Hours', 'Time']),
      Remarks: getFieldValueCI(row, ['Remarks', 'Notes']),
      Status: getFieldValueCI(row, ['Status']),
    })),
    Chambers: cleanList(raw.Chambers).map((row) => ({
      ...row,
      Chamber_ID: getFieldValueCI(row, ['Chamber_ID', 'ID']),
      Doctor_ID: getFieldValueCI(row, ['Doctor_ID']),
      Chamber_Name: getFieldValueCI(row, ['Chamber_Name', 'Name']),
      Address: getFieldValueCI(row, ['Address']),
      Area_ID: getFieldValueCI(row, ['Area_ID', 'Area']),
      Visiting_Days: getFieldValueCI(row, ['Visiting_Days', 'Days']),
      Visiting_Hours: getFieldValueCI(row, ['Visiting_Hours', 'Hours', 'Time']),
      Assistant_Phone: getFieldValueCI(row, ['Assistant_Phone', 'Phone']),
      Status: getFieldValueCI(row, ['Status']),
    })),
    Departments: cleanList(raw.Departments).map((row) => ({
      ...row,
      Department_ID: getFieldValueCI(row, ['Department_ID', 'ID']),
      Department_Name: getFieldValueCI(row, ['Department_Name', 'Name']),
      Preferred_Generics: getFieldValueCI(row, [
        'Preferred_Generics',
        'Preferred Generics',
        'Generics',
        'Mapped_Generics',
      ]),
      Clinical_Indications: getFieldValueCI(row, [
        'Clinical_Indications',
        'Clinical Indications',
        'Indications',
        'Common_Indications',
        'Mapped_Indications',
      ]),
      Status: getFieldValueCI(row, ['Status']),
    })),
    Indications: cleanList(raw.Indications).map((row) => ({
      ...row,
      Indication_ID: getFieldValueCI(row, ['Indication_ID', 'ID']),
      Indication_Name: getFieldValueCI(row, ['Indication_Name', 'Name', 'Indication']),
      Category: getFieldValueCI(row, [
        'Category',
        'Therapeutic_Category',
        'Specialty_Category',
        'Therapeutic_Class',
        'Group',
      ]),
      Relevant_Specialists: getFieldValueCI(row, [
        'Relevant_Specialists',
        'Relevant Specialists',
        'Specialists',
        'Departments',
      ]),
      Key_Generics: getFieldValueCI(row, [
        'Key_Generics',
        'Key Generics',
        'Generics',
        'Preferred_Generics',
      ]),
      Description_BN: getFieldValueCI(row, [
        'Description_BN',
        'Bengali_Description',
        'Guide_BN',
        'Disease_Guide_BN',
        'Details_BN',
      ]),
      Video_URL: getFieldValueCI(row, [
        'Video_URL',
        'YouTube_URL',
        'Youtube_URL',
        'Video_Link',
        'YouTube_Link',
        'Video',
      ]),
      Status: getFieldValueCI(row, ['Status']) || 'Active',
      Created_At: getFieldValueCI(row, ['Created_At']),
      Updated_At: getFieldValueCI(row, ['Updated_At']),
      Created_By: getFieldValueCI(row, ['Created_By']),
    })),
    Products: cleanList(raw.Products).map((row) => {
      const brandName = getFieldValueCI(row, ['Brand_Name', 'Product_Name', 'Name']);
      const packSize = getFieldValueCI(row, ['Pack_Size']);
      const singlePriceRaw =
        row.Single_Price !== undefined && String(row.Single_Price).trim() !== ''
          ? (row.Single_Price as number | string)
          : getFieldValueCI(row, ['Single_Price', 'Unit_Price', 'Strip_Price']);
      const explicitBoxPrice =
        row.Box_Price !== undefined && String(row.Box_Price).trim() !== ''
          ? (row.Box_Price as number | string)
          : getFieldValueCI(row, ['Box_Price', 'MRP_BDT', 'MRP', 'Price']);
      const computedBoxPrice =
        explicitBoxPrice !== '' && explicitBoxPrice !== undefined
          ? explicitBoxPrice
          : calculateBoxPrice(singlePriceRaw, packSize);

      return {
        ...row,
        Product_ID: getFieldValueCI(row, ['Product_ID', 'ID']),
        Product_Name: brandName,
        Brand_Name: brandName,
        Generic_Name: getFieldValueCI(row, ['Generic_Name', 'Generic']),
        Strength: getFieldValueCI(row, ['Strength', 'Dosage']),
        Dosage_Form: getFieldValueCI(row, ['Dosage_Form', 'Form']),
        Therapeutic_Class: getFieldValueCI(row, ['Therapeutic_Class', 'Category', 'Class']),
        Pack_Size: packSize,
        Approved_Indications: getFieldValueCI(row, [
          'Approved_Indications',
          'Indications',
          'Indication',
          'Key_Message',
          'Description',
        ]),
        Single_Price: singlePriceRaw,
        Box_Price: computedBoxPrice,
        MRP_BDT: computedBoxPrice,
        Product_Group: formatProductGroupValue(
          normalizeProductGroup(
            getFieldValueCI(row, ['Product_Group', 'Group', 'ProductGroup', 'Sales_Group'])
          )
        ),
        Video_URL: getFieldValueCI(row, [
          'Video_URL',
          'YouTube_URL',
          'Youtube_URL',
          'Video_Link',
          'YouTube_Link',
          'Video',
        ]),
        Status: getFieldValueCI(row, ['Status']),
      };
    }),
    Doctor_Product_Detailing: cleanList(raw.Doctor_Product_Detailing).map((row) => ({
      ...row,
      Detailing_ID: getFieldValueCI(row, ['Detailing_ID', 'ID']),
      Product_ID: getFieldValueCI(row, ['Product_ID']),
      Generic_Name: getFieldValueCI(row, ['Generic_Name', 'Generic']) || undefined,
      Specialist: getFieldValueCI(row, ['Specialist', 'Specialty', 'Speciality', 'Department']),
      Detailing_BN: getFieldValueCI(row, [
        'Detailing_BN',
        'Bengali_Detailing',
        'Short_Detailing_BN',
        'BN_Script',
      ]),
      Detailing_EN: getFieldValueCI(row, [
        'Detailing_EN',
        'English_Detailing',
        'Short_Detailing_EN',
        'EN_Script',
        'Remarks',
      ]),
      Status: getFieldValueCI(row, ['Status']),
      Doctor_ID: getFieldValueCI(row, ['Doctor_ID']),
      MPO_ID: getFieldValueCI(row, ['MPO_ID']),
      Detailing_Date: getFieldValueCI(row, ['Detailing_Date', 'Date']),
      Response_Level: getFieldValueCI(row, ['Response_Level', 'Response']),
      Samples_Given: row.Samples_Given !== undefined ? Number(row.Samples_Given) || 0 : undefined,
      Literature_Shared: getFieldValueCI(row, ['Literature_Shared']),
      Remarks: getFieldValueCI(row, ['Remarks', 'Notes']),
    })),
    Doctor_Visits: cleanList(raw.Doctor_Visits).map((row) => ({
      ...row,
      Visit_ID: getFieldValueCI(row, ['Visit_ID', 'ID']),
      Doctor_ID: getFieldValueCI(row, ['Doctor_ID']),
      Primary_Hospital_ID: getFieldValueCI(row, ['Primary_Hospital_ID', 'Hospital_ID']),
      MPO_ID: getFieldValueCI(row, ['MPO_ID']),
      Visit_Date: getFieldValueCI(row, ['Visit_Date', 'Date']),
      Visit_Time: getFieldValueCI(row, ['Visit_Time', 'Time']),
      Products_Discussed: Array.isArray(row.Products_Discussed)
        ? (row.Products_Discussed as unknown as string[]).join(', ')
        : getFieldValueCI(row, ['Products_Discussed', 'Products']),
      Discussion_Summary: getFieldValueCI(row, ['Discussion_Summary', 'Summary', 'Notes']),
      Next_Follow_Up: getFieldValueCI(row, ['Next_Follow_Up', 'Follow_Up_Date']),
      Visit_Type: getFieldValueCI(row, ['Visit_Type']),
    })),
    MPO_Users: cleanList(raw.MPO_Users).map((row) => {
      const empId = getFieldValueCI(row, ['Employee_ID', 'Employee_Code', 'Emp_Code', 'Emp_ID']);
      const phone = getFieldValueCI(row, ['Phone_Number', 'Phone', 'Mobile', 'Contact']);
      const role = getFieldValueCI(row, ['Role', 'Designation']) || 'MPO';
      return {
        ...row,
        MPO_ID: getFieldValueCI(row, ['MPO_ID', 'ID']),
        MPO_Name: getFieldValueCI(row, ['MPO_Name', 'Name']),
        Role: role,
        Employee_ID: empId,
        Employee_Code: empId,
        Territory: getFieldValueCI(row, ['Territory', 'Zone']),
        Area: getFieldValueCI(row, ['Area', 'Area_Name']),
        Designation: getFieldValueCI(row, ['Designation', 'Role']) || role,
        Area_ID: getFieldValueCI(row, ['Area_ID']),
        Phone_Number: phone,
        Phone: phone,
        Email: getFieldValueCI(row, ['Email', 'Email_Address']),
        PIN: getFieldValueCI(row, ['PIN', 'Team_PIN', 'Passcode', 'Password', 'Access_Code']),
        Monthly_Visit_Target: Number(row.Monthly_Visit_Target) || 50,
        Status: getFieldValueCI(row, ['Status']) || 'Active',
      };
    }),
    Areas: cleanList(raw.Areas).map((row) => {
      const territory = getFieldValueCI(row, ['Territory', 'Zone']);
      return {
        ...row,
        Area_ID: getFieldValueCI(row, ['Area_ID', 'ID']),
        Area_Name: getFieldValueCI(row, ['Area_Name', 'Area', 'Name']),
        Zone: territory,
        Territory: territory,
        District: getFieldValueCI(row, ['District']),
        Assigned_MPO_ID: getFieldValueCI(row, ['Assigned_MPO_ID', 'MPO_ID']),
        Team_PIN: getFieldValueCI(row, ['Team_PIN', 'Area_PIN', 'PIN', 'Passcode', 'Access_Code']),
        Status: getFieldValueCI(row, ['Status']) || 'Active',
      };
    }),
    Daily_Activities: cleanList(raw.Daily_Activities).map((row) => ({
      ...row,
      Activity_ID: getFieldValueCI(row, ['Activity_ID', 'ID']),
      MPO_ID: getFieldValueCI(row, ['MPO_ID']),
      Activity_Date: getFieldValueCI(row, ['Activity_Date', 'Date']),
      Activity_Time: getFieldValueCI(row, ['Activity_Time', 'Time']),
      Area_ID: getFieldValueCI(row, ['Area_ID', 'Area']),
      Activity_Type: getFieldValueCI(row, ['Activity_Type', 'Type']),
      Location: getFieldValueCI(row, ['Location']),
      Doctors_Met: Number(row.Doctors_Met) || 0,
      Summary: getFieldValueCI(row, ['Summary', 'Description']),
      Outcome: getFieldValueCI(row, ['Outcome']),
      Status: getFieldValueCI(row, ['Status', 'Activity_Status']) || 'Completed',
    })),
    MPO_Desk: normalizeKnowledgeChapters(getRawSheetRows(['MPO_Desk', 'MPO Desk'])),
    Medical_Knowledge: normalizeKnowledgeChapters(
      getRawSheetRows(['Medical_Knowledge', 'Medical Knowledge'])
    ),
  };
}

export function loadCachedDataset(): FieldDataset {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DATA_CACHE);
    if (!raw) {
      const starter = createStarterDataset();
      saveCachedDataset(starter);
      return starter;
    }
    const parsed = JSON.parse(raw) as Partial<FieldDataset>;
    const normalized = normalizeDataset(parsed);

    // Non-destructively hydrate updated starter Products & Specialist Detailing scripts in local mode
    if (!isConfiguredApiUrl(getSavedApiUrl())) {
      const starter = createStarterDataset();
      const starterProductMap = new Map(starter.Products.map((p) => [p.Product_ID, p]));
      let hydrated = false;

      normalized.Products = normalized.Products.map((prod) => {
        const seed = starterProductMap.get(prod.Product_ID);
        if (!seed) return prod;
        const needsFill =
          prod.Single_Price === undefined ||
          String(prod.Single_Price).trim() === '' ||
          !prod.Approved_Indications;
        if (!needsFill) return prod;
        hydrated = true;
        return {
          ...prod,
          Brand_Name: prod.Brand_Name || prod.Product_Name || seed.Brand_Name,
          Approved_Indications: prod.Approved_Indications || seed.Approved_Indications,
          Single_Price:
            prod.Single_Price !== undefined && String(prod.Single_Price).trim() !== ''
              ? prod.Single_Price
              : seed.Single_Price,
          Box_Price:
            prod.Box_Price !== undefined && String(prod.Box_Price).trim() !== ''
              ? prod.Box_Price
              : seed.Box_Price,
        };
      });

      const hasSpecialistScripts = normalized.Doctor_Product_Detailing.some(
        (item) => Boolean(item.Specialist) && (Boolean(item.Detailing_BN) || Boolean(item.Detailing_EN))
      );
      if (!hasSpecialistScripts) {
        normalized.Doctor_Product_Detailing = starter.Doctor_Product_Detailing;
        hydrated = true;
      }

      // Hydrate Admin/Area Manager roles, Assigned_MPO_ID, and Email on local starter cache
      const hasAdminRoleInUsers = normalized.MPO_Users.some((m) => isAdminOrManagerRole(m.Role));
      if (!hasAdminRoleInUsers && normalized.MPO_Users.some((m) => m.MPO_ID === 'MPO-101')) {
        const starterMpoMap = new Map(starter.MPO_Users.map((m) => [m.MPO_ID, m]));
        normalized.MPO_Users = normalized.MPO_Users.map((m) => {
          const seed = starterMpoMap.get(m.MPO_ID);
          if (!seed) return m;
          return {
            ...m,
            Role: seed.Role,
            Employee_ID: m.Employee_ID || seed.Employee_ID,
            Employee_Code: m.Employee_Code || seed.Employee_Code,
            Phone_Number: m.Phone_Number || seed.Phone_Number,
            Phone: m.Phone || seed.Phone,
            Email: m.Email || seed.Email,
          };
        });
        if (!normalized.MPO_Users.some((m) => m.MPO_ID === 'MPO-100')) {
          const adminSeed = starter.MPO_Users.find((m) => m.MPO_ID === 'MPO-100');
          if (adminSeed) normalized.MPO_Users.unshift(adminSeed);
        }
        hydrated = true;
      }

      const starterAreaMap = new Map(starter.Areas.map((a) => [a.Area_ID, a]));
      normalized.Areas = normalized.Areas.map((a) => {
        const seed = starterAreaMap.get(a.Area_ID);
        if (!seed || a.Assigned_MPO_ID) return a;
        hydrated = true;
        return {
          ...a,
          Territory: a.Territory || seed.Territory,
          Assigned_MPO_ID: seed.Assigned_MPO_ID,
          Status: a.Status || 'Active',
        };
      });

      const starterDeptMap = new Map(starter.Departments.map((d) => [d.Department_ID, d]));
      normalized.Departments = normalized.Departments.map((d) => {
        const seed = starterDeptMap.get(d.Department_ID);
        if (!seed || (d.Preferred_Generics && d.Clinical_Indications)) return d;
        hydrated = true;
        return {
          ...d,
          Preferred_Generics: d.Preferred_Generics || seed.Preferred_Generics,
          Clinical_Indications: d.Clinical_Indications || seed.Clinical_Indications,
        };
      });

      if (normalized.Indications.length === 0 && starter.Indications.length > 0) {
        normalized.Indications = starter.Indications;
        hydrated = true;
      }

      if (hydrated) {
        saveCachedDataset(normalized);
      }
    }

    return normalized;
  } catch {
    return createStarterDataset();
  }
}

export function saveCachedDataset(dataset: FieldDataset): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DATA_CACHE, JSON.stringify(dataset));
  } catch {
    // Ignore storage errors
  }
}

export function resetCachedDatasetToStarter(): FieldDataset {
  const starter = createStarterDataset();
  saveCachedDataset(starter);
  return starter;
}

export function loadSyncQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSyncQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  } catch {
    // Ignore
  }
}

export function loadPendingGroupUpdates(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_GROUP_UPDATES);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const clean: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, val]) => {
      const productId = String(id ?? '').trim();
      if (!productId) return;
      clean[productId] = formatProductGroupValue(normalizeProductGroup(val));
    });
    return clean;
  } catch {
    return {};
  }
}

export function savePendingGroupUpdates(pendingMap: Record<string, string>): void {
  try {
    const keys = Object.keys(pendingMap);
    if (keys.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_GROUP_UPDATES);
    } else {
      localStorage.setItem(STORAGE_KEYS.PENDING_GROUP_UPDATES, JSON.stringify(pendingMap));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function clearLegacyPendingGroupUpdates(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_GROUP_UPDATES);
    localStorage.removeItem('pendingGroupUpdates');
  } catch {
    // Ignore storage access errors
  }
}

export function mergePendingGroupUpdatesIntoDataset(
  dataset: FieldDataset,
  pendingMap: Record<string, string>
): FieldDataset {
  const pendingIds = Object.keys(pendingMap);
  if (pendingIds.length === 0) return dataset;

  let changed = false;
  const mergedProducts = dataset.Products.map((prod) => {
    const id = String(prod.Product_ID ?? '').trim();
    if (!id || !Object.prototype.hasOwnProperty.call(pendingMap, id)) {
      return prod;
    }
    const nextGroup = pendingMap[id];
    if (prod.Product_Group === nextGroup) {
      return prod;
    }
    changed = true;
    return {
      ...prod,
      Product_Group: nextGroup,
    };
  });

  if (!changed) return dataset;
  return {
    ...dataset,
    Products: mergedProducts,
  };
}

export async function fetchAllDataFromAppsScript(apiUrl: string): Promise<FieldDataset> {
  if (!isConfiguredApiUrl(apiUrl)) {
    throw new Error('Web App URL is not configured yet.');
  }

  // Append a cache-busting timestamp so startup/reload always fetches fresh Google Sheet rows
  const separator = apiUrl.includes('?') ? '&' : '?';
  const freshUrl = `${apiUrl}${separator}_ts=${Date.now()}`;

  const response = await fetch(freshUrl, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Server responded with HTTP ${response.status}`);
  }

  const json = (await response.json()) as ApiGetResponse;

  if (json.status !== 'success' || !json.data) {
    throw new Error(json.message || 'Unexpected response format from Google Apps Script.');
  }

  return normalizeDataset(json.data);
}

export async function postMutationToAppsScript(
  apiUrl: string,
  payload: ApiPostPayload
): Promise<{ status: string; message?: string }> {
  if (!isConfiguredApiUrl(apiUrl)) {
    throw new Error('Web App URL is not configured.');
  }

  // Strictly uses text/plain;charset=utf-8 to prevent CORS preflight with Google Apps Script Web Apps
  const response = await fetch(apiUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`POST failed with HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed.status && parsed.status !== 'success') {
      throw new Error(parsed.message || 'Apps Script rejected the mutation.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Some Apps Script deployments return plain "OK" text on success
      return { status: 'success', message: text };
    }
    throw err;
  }
}

export interface BatchProductGroupUpdateItem {
  Product_ID: string;
  Product_Group: string;
}

export interface BatchProductGroupSaveResult {
  supported: boolean;
  updatedCount: number;
  usedNoCorsFallback?: boolean;
  message?: string;
}

/**
 * Attempts a single fast batch POST (`action: "batchUpdateProducts"`) to Google Apps Script
 * using `Content-Type: text/plain;charset=utf-8` to avoid CORS preflight.
 * If a CORS error still occurs while online, falls back to `mode: 'no-cors'` so Google Sheets
 * still receives the batch update cleanly.
 */
export async function postBatchProductGroupsToAppsScript(
  apiUrl: string,
  updates: BatchProductGroupUpdateItem[]
): Promise<BatchProductGroupSaveResult> {
  if (!isConfiguredApiUrl(apiUrl)) {
    throw new Error('Web App URL is not configured.');
  }
  if (updates.length === 0) {
    return { supported: true, updatedCount: 0 };
  }

  const bodyStr = JSON.stringify({
    action: 'batchUpdateProducts',
    sheet: 'Products',
    updates,
  });

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyStr,
    });
  } catch (err) {
    // If browser CORS blocks reading the Apps Script redirect response while online,
    // retry with `mode: 'no-cors'` so Google Sheets still receives the batch update cleanly.
    if (typeof navigator !== 'undefined' && navigator.onLine && err instanceof TypeError) {
      await fetch(apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: bodyStr,
      });
      return {
        supported: true,
        updatedCount: updates.length,
        usedNoCorsFallback: true,
        message: 'Batch update sent via CORS-safe no-cors fallback.',
      };
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Batch POST failed with HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const status = String(parsed.status ?? '').toLowerCase();
    const hasBatchConfirmation =
      parsed.batch === true ||
      String(parsed.action ?? '') === 'batchUpdateProducts' ||
      typeof parsed.updatedCount === 'number';

    if (status === 'success' && hasBatchConfirmation) {
      return {
        supported: true,
        updatedCount:
          typeof parsed.updatedCount === 'number' ? parsed.updatedCount : updates.length,
        message: typeof parsed.message === 'string' ? parsed.message : undefined,
      };
    }

    return {
      supported: false,
      updatedCount: 0,
      message:
        typeof parsed.message === 'string'
          ? parsed.message
          : 'Deployed Code.gs does not support batchUpdateProducts yet.',
    };
  } catch {
    // Plain-text or non-JSON response means older Code.gs fell through without confirming batch save
    return {
      supported: false,
      updatedCount: 0,
      message: 'Deployed Code.gs returned a non-batch response.',
    };
  }
}

export const BATCH_UPDATE_CODE_GS_SNIPPET = `// Add inside doPost(e) in your Google Apps Script (Code.gs)
// right after: const payload = JSON.parse(e.postData.contents);
if (payload.action === 'batchUpdateProducts') {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(payload.sheet || 'Products');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'Products sheet not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const updates = Array.isArray(payload.updates) ? payload.updates : [];
    const groupById = {};
    updates.forEach(function (item) {
      const id = String(item.Product_ID || '').trim();
      if (id) {
        groupById[id] = String(item.Product_Group || '').trim();
      }
    });

    const range = sheet.getDataRange();
    const values = range.getValues();
    if (values.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'success',
          action: 'batchUpdateProducts',
          batch: true,
          updatedCount: 0
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = values[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    const idCol = headers.indexOf('product_id');
    let groupCol = headers.indexOf('product_group');
    const updatedAtCol = headers.indexOf('updated_at');

    if (idCol === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'Product_ID column not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Auto-create Product_Group column if missing
    if (groupCol === -1) {
      groupCol = headers.length;
      sheet.getRange(1, groupCol + 1).setValue('Product_Group');
    }

    const numDataRows = values.length - 1;
    const nextGroupCol = [];
    const nextUpdatedAtCol = updatedAtCol !== -1 ? [] : null;
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    for (let r = 1; r < values.length; r++) {
      const rowId = String(values[r][idCol] || '').trim();
      const existingGroup = values[r][groupCol] !== undefined ? values[r][groupCol] : '';
      if (Object.prototype.hasOwnProperty.call(groupById, rowId)) {
        nextGroupCol.push([groupById[rowId]]);
        if (nextUpdatedAtCol) nextUpdatedAtCol.push([nowIso]);
        updatedCount++;
      } else {
        nextGroupCol.push([existingGroup]);
        if (nextUpdatedAtCol) nextUpdatedAtCol.push([values[r][updatedAtCol]]);
      }
    }

    // Write the entire Product_Group column in ONE fast batch call (~1 second)
    sheet.getRange(2, groupCol + 1, numDataRows, 1).setValues(nextGroupCol);
    if (nextUpdatedAtCol && updatedAtCol !== -1) {
      sheet.getRange(2, updatedAtCol + 1, numDataRows, 1).setValues(nextUpdatedAtCol);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        action: 'batchUpdateProducts',
        batch: true,
        updatedCount: updatedCount
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

export const SHEET_PRIMARY_KEY: Record<SheetName, string> = {
  Hospitals: 'Hospital_ID',
  Doctors: 'Doctor_ID',
  Chambers: 'Chamber_ID',
  Departments: 'Department_ID',
  Indications: 'Indication_ID',
  Products: 'Product_ID',
  Doctor_Product_Detailing: 'Detailing_ID',
  Doctor_Visits: 'Visit_ID',
  MPO_Users: 'MPO_ID',
  Areas: 'Area_ID',
  Daily_Activities: 'Activity_ID',
};

export function normalizeProductGroup(value?: unknown): ProductGroupCode | '' {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw || raw === 'NONE' || raw === 'UNASSIGNED' || raw === '-' || raw === 'N/A') {
    return '';
  }
  const cleaned = raw
    .replace(/^GROUP[\s_-]*/i, '')
    .replace(/^GRP[\s_-]*/i, '')
    .replace(/^G[\s_-]+/i, '')
    .trim();
  if (/^[A-O]$/.test(cleaned)) {
    return cleaned as ProductGroupCode;
  }
  return '';
}

export function formatProductGroupValue(code: ProductGroupCode | ''): string {
  return code ? `Group ${code}` : '';
}

export function getValidVideoUrl(rawUrl?: string | null): string | null {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return null;
  const candidate = /^(?:www\.)?(?:youtube\.com|youtu\.be|m\.youtube\.com)\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

const GENERIC_SALT_AND_STD_RE =
  /\b(?:usp|bp|inn|ep|jp|ph\.?\s*eur|trihydrate|dihydrate|monohydrate|hemihydrate|anhydrous|hydrochloride|hcl|sodium|potassium|calcium|magnesium|maleate|besylate|besilate|tartrate|citrate|sulfate|sulphate|phosphate|acetate|succinate|fumarate|mesylate|mesilate|nitrate|dipropionate|propionate|furoate|valerate|palmitate|stearate|axetil|proxetil|pivoxil|medoxomil|esylate|tosylate|lactate|gluconate|bromide|chloride|carbonate|bicarbonate|oxalate|benzoate|salicylate|hydrate|ip)\b/gi;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripGenericSalts(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(GENERIC_SALT_AND_STD_RE, ' ')
    .replace(/[^a-z0-9+/\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLeftBoundaryToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = escapeRegExp(needle);
  const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
  if (re.test(haystack)) return true;
  // Also allow prefix-start match for inflected stems (e.g., "cefixime" matching "cefixime-trihydrate")
  const prefixRe = new RegExp(`(?:^|[^a-z0-9])${escaped}`, 'i');
  return needle.length >= 4 && prefixRe.test(haystack);
}

/**
 * Parses comma-separated (or newline/semicolon-separated) generic names from
 * Departments.Preferred_Generics while preserving display casing and deduplicating.
 */
export function parsePreferredGenerics(raw?: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const results: string[] = [];
  String(raw)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    });
  return results;
}

/**
 * Case-insensitive base-name / substring matcher between a Specialist's Preferred_Generics
 * entry and a Product's Generic_Name (e.g., "Cefixime" matches "Cefixime Trihydrate",
 * "Esomeprazole" matches "Esomeprazole USP", while "Omeprazole" won't falsely match "Esomeprazole").
 */
export function productMatchesPreferredGeneric(
  product: Product,
  preferredGeneric: string
): boolean {
  const prodRaw = String(product.Generic_Name ?? '').trim();
  const prefRaw = String(preferredGeneric ?? '').trim();
  if (!prodRaw || !prefRaw) return false;

  const prodLower = prodRaw.toLowerCase().replace(/\s+/g, ' ');
  const prefLower = prefRaw.toLowerCase().replace(/\s+/g, ' ');

  if (prodLower === prefLower) return true;
  if (hasLeftBoundaryToken(prodLower, prefLower)) return true;

  const prodBase = stripGenericSalts(prodRaw);
  const prefBase = stripGenericSalts(prefRaw);

  if (prefBase && prodBase) {
    if (prodBase === prefBase) return true;
    if (hasLeftBoundaryToken(prodBase, prefBase)) return true;
    // Reverse match when preferredGeneric includes a salt (e.g., "Cefixime Trihydrate" vs "Cefixime")
    if (prodBase.length >= 4 && hasLeftBoundaryToken(prefBase, prodBase)) return true;
  }

  // Handle combination generics such as "Amoxicillin + Clavulanic Acid" or "Amlodipine / Valsartan"
  const prefParts = prefRaw
    .split(/[+/&]/)
    .map((part) => stripGenericSalts(part))
    .filter((part) => part.length >= 3);

  if (prefParts.length > 1) {
    return prefParts.every(
      (part) => hasLeftBoundaryToken(prodLower, part) || hasLeftBoundaryToken(prodBase, part)
    );
  }

  return false;
}

/**
 * Parses comma-separated (or semicolon/newline-separated) clinical indications from
 * Departments.Clinical_Indications while preserving display casing and deduplicating.
 */
export function parseClinicalIndications(raw?: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const results: string[] = [];
  String(raw)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    });
  return results;
}

const INDICATION_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'or',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'as',
  'from',
  'due',
  'the',
  'is',
  'are',
  'be',
  'not',
  'non',
  'other',
  'related',
  'associated',
  'induced',
  'type',
  'stage',
  'grade',
  'mild',
  'moderate',
  'severe',
  'acute',
  'chronic',
  'primary',
  'secondary',
  'essential',
  'simple',
  'uncomplicated',
  'complicated',
  'general',
  'systemic',
  'local',
  'clinical',
  'disease',
  'diseases',
  'disorder',
  'disorders',
  'syndrome',
  'syndromes',
  'condition',
  'conditions',
  'symptom',
  'symptoms',
  'symptomatic',
  'relief',
  'treatment',
  'therapy',
  'management',
  'prophylaxis',
  'prevention',
  'control',
  'care',
  'use',
  'patients',
  'adults',
  'adult',
  'children',
  'pediatric',
  'paediatric',
  'tract',
  'upper',
  'lower',
  'bilateral',
  'unilateral',
  'recurrent',
  'persistent',
  'intermittent',
  'seasonal',
  'perennial',
  'idiopathic',
  'benign',
  'malignant',
  'unspecified',
  'common',
  'various',
  'plus',
]);

// Broad clinical words that need corroborating context when part of a multi-word indication
const BROAD_CLINICAL_TERMS = new Set([
  'infection',
  'infections',
  'bacterial',
  'viral',
  'fungal',
  'parasitic',
  'pain',
  'ache',
  'fever',
  'pyrexia',
  'inflammation',
  'inflammatory',
  'arthritis',
  'allergy',
  'allergic',
  'cough',
  'cold',
  'bleeding',
  'edema',
  'oedema',
  'swelling',
  'rash',
  'spasm',
  'failure',
  'insufficiency',
  'deficiency',
  'supplement',
  'supplementation',
  'vitamin',
  'cancer',
  'carcinoma',
  'tumor',
  'tumour',
  'heart',
  'blood',
  'pressure',
  'skin',
  'soft',
  'tissue',
  'bone',
  'joint',
  'muscle',
  'nerve',
  'brain',
  'lung',
  'liver',
  'kidney',
  'renal',
  'hepatic',
  'gastric',
  'stomach',
  'bowel',
  'eye',
  'ear',
  'nose',
  'throat',
  'oral',
  'dental',
  'surgical',
  'postoperative',
  'post-operative',
  'operative',
  'orthopedic',
  'orthopaedic',
  'respiratory',
  'cardiovascular',
  'gastrointestinal',
  'neurological',
  'dermatological',
  'mellitus',
]);

const MEDICAL_SYNONYM_MAP: Record<string, string[]> = {
  gerd: ['gastroesophageal reflux', 'gastro-oesophageal reflux', 'acid reflux', 'reflux esophagitis', 'esophagitis'],
  'acid reflux': ['gerd', 'reflux esophagitis', 'esophagitis'],
  'peptic ulcer': ['gastric ulcer', 'duodenal ulcer', 'ulcer'],
  pud: ['peptic ulcer', 'gastric ulcer', 'duodenal ulcer'],
  uti: ['urinary tract infection', 'cystitis', 'pyelonephritis'],
  'urinary tract infection': ['uti', 'cystitis', 'pyelonephritis'],
  urti: ['upper respiratory tract infection', 'respiratory tract infection', 'sinusitis', 'pharyngitis', 'tonsillitis'],
  lrti: ['lower respiratory tract infection', 'respiratory tract infection', 'bronchitis', 'pneumonia'],
  rti: ['respiratory tract infection', 'sinusitis', 'bronchitis', 'pneumonia'],
  cap: ['community-acquired pneumonia', 'pneumonia'],
  htn: ['hypertension', 'high blood pressure'],
  hypertension: ['htn', 'high blood pressure'],
  t2dm: ['type 2 diabetes', 'diabetes mellitus', 'glycemic control', 'diabetic'],
  'type 2 diabetes': ['t2dm', 'diabetes mellitus', 'glycemic control'],
  diabetes: ['diabetic', 'glycemic', 'hyperglycemia', 't2dm'],
  dyslipidemia: ['hypercholesterolemia', 'hyperlipidemia', 'hypertriglyceridemia'],
  hyperlipidemia: ['dyslipidemia', 'hypercholesterolemia', 'hypertriglyceridemia'],
  hypercholesterolemia: ['dyslipidemia', 'hyperlipidemia'],
  oa: ['osteoarthritis'],
  ra: ['rheumatoid arthritis'],
  copd: ['chronic obstructive pulmonary'],
  ihd: ['ischemic heart', 'ischaemic heart', 'angina', 'coronary artery'],
  cad: ['coronary artery', 'ischemic heart', 'angina'],
  acs: ['acute coronary syndrome', 'myocardial infarction', 'unstable angina'],
  ckd: ['chronic kidney', 'renal failure'],
  bph: ['benign prostatic hyperplasia', 'prostatic'],
  ssti: ['skin and soft tissue', 'cellulitis', 'impetigo'],
  asthma: ['bronchoconstriction', 'bronchospasm', 'asthmatic'],
  gout: ['gouty arthritis', 'hyperuricemia'],
  'gouty arthritis': ['gout', 'hyperuricemia'],
  'h. pylori': ['helicobacter pylori', 'h. pylori'],
  'helicobacter pylori': ['h. pylori'],
};

const SHORT_MEDICAL_ACRONYMS = new Set([
  'oa',
  'ra',
  'dm',
  'hf',
  'af',
  'mi',
  'tb',
  'gi',
  'bp',
  'ib',
]);

function normalizeMedicalText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsWholeTerm(haystack: string, term: string): boolean {
  if (!term || !haystack) return false;
  const escaped = escapeRegExp(term);
  const exactRe = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
  if (exactRe.test(haystack)) return true;
  // Allow morphological suffix match for medical stems >= 5 chars (e.g. "ulcer" -> "ulcers", "diabet" -> "diabetic", "gout" -> "gouty")
  if (term.length >= 4 && !SHORT_MEDICAL_ACRONYMS.has(term)) {
    const stem = term.length >= 6 && term.endsWith('s') ? term.slice(0, -1) : term;
    const stemEscaped = escapeRegExp(stem);
    const stemRe = new RegExp(`(?:^|[^a-z0-9])${stemEscaped}[a-z]{0,4}(?:$|[^a-z0-9])`, 'i');
    return stemRe.test(haystack);
  }
  return false;
}

export interface ClinicalIndicationProductMatch {
  product: Product;
  isPreferredGeneric: boolean;
  score: number;
}

/**
 * Matches Drug International Limited products from the Products sheet whose
 * Approved_Indications match key medical terms from a Specialist's Clinical Indication,
 * prioritizing products whose Generic_Name is also in that Specialist's Preferred_Generics.
 */
export function matchProductsForClinicalIndication(
  products: Product[],
  indication: string,
  preferredGenerics: string[] = [],
  preferredProductIds?: Set<string>
): ClinicalIndicationProductMatch[] {
  const normIndication = normalizeMedicalText(indication);
  if (!normIndication) return [];

  // Extract parenthetical acronyms/phrases (e.g. "Urinary Tract Infection (UTI)" -> "uti")
  const parenTerms: string[] = [];
  const parenRe = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(normIndication)) !== null) {
    const inner = m[1].trim();
    if (inner.length >= 2) parenTerms.push(inner);
  }

  const withoutParens = normIndication.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // Split slash/colon sub-phrases (e.g. "GERD / Acid Reflux")
  const subPhrases = [
    withoutParens,
    ...withoutParens.split(/[/|:]+/).map((s) => s.trim()),
    ...parenTerms,
  ].filter((p, idx, arr) => p.length >= 2 && arr.indexOf(p) === idx);

  // Collect synonym expansions for phrases and individual tokens
  const synonymTerms = new Set<string>();
  for (const phrase of subPhrases) {
    const mapped = MEDICAL_SYNONYM_MAP[phrase];
    if (mapped) mapped.forEach((syn) => synonymTerms.add(syn));
    // Also check if a synonym key is contained as a sub-phrase
    for (const [key, vals] of Object.entries(MEDICAL_SYNONYM_MAP)) {
      if (key.length >= 4 && containsWholeTerm(phrase, key)) {
        vals.forEach((syn) => synonymTerms.add(syn));
      }
    }
  }

  // Extract medical keywords from the indication
  const rawTokens = normIndication
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter(Boolean);

  const uniqueKeywords: string[] = [];
  for (const tok of rawTokens) {
    if (INDICATION_STOP_WORDS.has(tok)) continue;
    if (tok.length < 3 && !SHORT_MEDICAL_ACRONYMS.has(tok)) continue;
    if (!uniqueKeywords.includes(tok)) uniqueKeywords.push(tok);
    const mapped = MEDICAL_SYNONYM_MAP[tok];
    if (mapped) mapped.forEach((syn) => synonymTerms.add(syn));
  }

  const specificKeywords = uniqueKeywords.filter((k) => !BROAD_CLINICAL_TERMS.has(k));
  const broadKeywords = uniqueKeywords.filter((k) => BROAD_CLINICAL_TERMS.has(k));

  const matches: ClinicalIndicationProductMatch[] = [];

  for (const prod of products) {
    const approvedRaw = String(prod.Approved_Indications ?? '').trim();
    if (!approvedRaw) continue;
    const approvedNorm = normalizeMedicalText(approvedRaw);

    let score = 0;

    // 1. Direct phrase / sub-phrase match (highest confidence)
    for (const phrase of subPhrases) {
      if (phrase.length >= 3 && containsWholeTerm(approvedNorm, phrase)) {
        score = Math.max(score, phrase === withoutParens ? 45 : 38);
      } else if (SHORT_MEDICAL_ACRONYMS.has(phrase) && containsWholeTerm(approvedNorm, phrase)) {
        score = Math.max(score, 32);
      }
    }

    // 2. Synonym / clinical abbreviation match
    if (score < 32 && synonymTerms.size > 0) {
      for (const syn of synonymTerms) {
        if (containsWholeTerm(approvedNorm, syn)) {
          score = Math.max(score, 30);
          break;
        }
      }
    }

    // 3. Key medical term keyword matching
    if (uniqueKeywords.length > 0) {
      const matchedSpecific = specificKeywords.filter((k) => containsWholeTerm(approvedNorm, k));
      const matchedBroad = broadKeywords.filter((k) => containsWholeTerm(approvedNorm, k));
      const totalMatched = matchedSpecific.length + matchedBroad.length;

      if (totalMatched === uniqueKeywords.length) {
        score = Math.max(score, 26 + totalMatched * 3);
      } else if (specificKeywords.length > 0 && matchedSpecific.length > 0) {
        // Match when all specific terms match, or at least half of specific terms match with strong specificity
        const specificRatio = matchedSpecific.length / specificKeywords.length;
        if (specificRatio >= 1) {
          score = Math.max(score, 22 + matchedSpecific.length * 3 + matchedBroad.length * 2);
        } else if (
          specificRatio >= 0.5 &&
          matchedSpecific.some((k) => k.length >= 6) &&
          (broadKeywords.length === 0 || matchedBroad.length > 0)
        ) {
          score = Math.max(score, 16 + matchedSpecific.length * 2 + matchedBroad.length);
        }
      } else if (specificKeywords.length === 0 && broadKeywords.length >= 2 && matchedBroad.length >= 2) {
        // Multi-word broad clinical indication (e.g. "Skin and Soft Tissue Infection" or "Post-Operative Pain")
        if (matchedBroad.length / broadKeywords.length >= 0.66) {
          score = Math.max(score, 18 + matchedBroad.length * 2);
        }
      }
    }

    if (score > 0) {
      const isPreferredGeneric = preferredProductIds
        ? preferredProductIds.has(prod.Product_ID)
        : preferredGenerics.some((g) => productMatchesPreferredGeneric(prod, g));
      matches.push({ product: prod, isPreferredGeneric, score });
    }
  }

  // Prioritize: 1) Specialist's Preferred_Generics first, 2) higher relevance score, 3) brand name A-Z
  matches.sort((a, b) => {
    if (a.isPreferredGeneric !== b.isPreferredGeneric) {
      return a.isPreferredGeneric ? -1 : 1;
    }
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    const nameA = String(a.product.Brand_Name || a.product.Product_Name || '');
    const nameB = String(b.product.Brand_Name || b.product.Product_Name || '');
    return nameA.localeCompare(nameB);
  });

  return matches;
}

/**
 * Splits comma-, semicolon-, or newline-separated values cleanly with case-insensitive deduplication.
 */
export function parseCommaList(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const results: string[] = [];
  String(raw)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase().replace(/\s+/g, ' ');
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    });
  return results;
}

/**
 * Fallback derivation: builds unique Indication records from Departments.Clinical_Indications
 * whenever the Google Sheet's "Indications" tab has not been synced in Code.gs yet.
 */
export function deriveIndicationsFromDepartments(
  departments: Department[],
  products: Product[] = []
): Indication[] {
  const byKey = new Map<
    string,
    {
      name: string;
      primaryCategory: string;
      specialists: string[];
      specialistPreferredGenerics: string[];
    }
  >();

  for (const dept of departments) {
    const deptName = String(dept.Department_Name ?? '').trim();
    if (!deptName) continue;
    const deptGenerics = parsePreferredGenerics(dept.Preferred_Generics);
    const deptIndications = parseClinicalIndications(dept.Clinical_Indications);

    for (const indName of deptIndications) {
      const key = indName.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key) continue;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          name: indName,
          primaryCategory: deptName,
          specialists: [],
          specialistPreferredGenerics: [],
        };
        byKey.set(key, entry);
      }
      if (!entry.specialists.some((s) => s.toLowerCase() === deptName.toLowerCase())) {
        entry.specialists.push(deptName);
      }
      for (const g of deptGenerics) {
        if (!entry.specialistPreferredGenerics.some((x) => x.toLowerCase() === g.toLowerCase())) {
          entry.specialistPreferredGenerics.push(g);
        }
      }
    }
  }

  const derived: Indication[] = [];
  let seq = 1;
  for (const entry of byKey.values()) {
    const matchedGenerics: string[] = [];
    if (products.length > 0) {
      const matchedProducts = matchProductsForClinicalIndication(
        products,
        entry.name,
        entry.specialistPreferredGenerics
      );
      for (const m of matchedProducts) {
        const gName = String(m.product.Generic_Name ?? '').trim();
        if (gName && !matchedGenerics.some((x) => x.toLowerCase() === gName.toLowerCase())) {
          matchedGenerics.push(gName);
        }
        if (matchedGenerics.length >= 12) break;
      }
    }

    const keyGenericsList =
      matchedGenerics.length > 0
        ? matchedGenerics
        : entry.specialistPreferredGenerics.slice(0, 6);

    derived.push({
      Indication_ID: `IND-${String(seq).padStart(3, '0')}`,
      Indication_Name: entry.name,
      Category: entry.primaryCategory,
      Relevant_Specialists: entry.specialists.join(', '),
      Key_Generics: keyGenericsList.join(', '),
      Status: 'Active',
    });
    seq += 1;
  }

  return derived;
}

/**
 * Returns live Indications from the Indications Google Sheet tab when present,
 * or falls back seamlessly to unique indications derived from Departments.Clinical_Indications.
 */
export function getEffectiveIndications(dataset: FieldDataset): {
  indications: Indication[];
  isDerivedFallback: boolean;
} {
  const validSheetRows = (dataset.Indications || []).filter(
    (row) => Boolean(String(row.Indication_Name ?? '').trim()) || Boolean(String(row.Indication_ID ?? '').trim())
  );
  if (validSheetRows.length > 0) {
    return { indications: validSheetRows, isDerivedFallback: false };
  }
  return {
    indications: deriveIndicationsFromDepartments(dataset.Departments || [], dataset.Products || []),
    isDerivedFallback: true,
  };
}

export interface IndicationMatchedProduct {
  product: Product;
  matchedViaGeneric: boolean;
  matchedViaIndication: boolean;
  matchedGenerics: string[];
  score: number;
}

/**
 * Matches Drug International Limited products for an Indication record using both:
 * 1) Key_Generics against Products.Generic_Name (case-insensitive base-name matching)
 * 2) Products.Approved_Indications keyword matching
 */
export function matchProductsForIndicationRecord(
  products: Product[],
  indication: Indication
): IndicationMatchedProduct[] {
  const keyGenerics = parseCommaList(indication.Key_Generics);
  const byProductId = new Map<string, IndicationMatchedProduct>();

  // 1. Match via Key_Generics against Products.Generic_Name
  if (keyGenerics.length > 0) {
    for (const prod of products) {
      const matchedGenerics = keyGenerics.filter((g) => productMatchesPreferredGeneric(prod, g));
      if (matchedGenerics.length > 0) {
        const key = prod.Product_ID || `${prod.Product_Name}-${prod.Strength}`;
        byProductId.set(key, {
          product: prod,
          matchedViaGeneric: true,
          matchedViaIndication: false,
          matchedGenerics,
          score: 50 + matchedGenerics.length * 5,
        });
      }
    }
  }

  // 2. Match via Products.Approved_Indications medical keyword matching
  const indicationMatches = matchProductsForClinicalIndication(
    products,
    indication.Indication_Name,
    keyGenerics
  );

  for (const m of indicationMatches) {
    const key = m.product.Product_ID || `${m.product.Product_Name}-${m.product.Strength}`;
    const existing = byProductId.get(key);
    if (existing) {
      existing.matchedViaIndication = true;
      existing.score += m.score + 20;
    } else {
      byProductId.set(key, {
        product: m.product,
        matchedViaGeneric: false,
        matchedViaIndication: true,
        matchedGenerics: [],
        score: m.score,
      });
    }
  }

  const results = Array.from(byProductId.values());
  results.sort((a, b) => {
    const aBoth = a.matchedViaGeneric && a.matchedViaIndication ? 1 : 0;
    const bBoth = b.matchedViaGeneric && b.matchedViaIndication ? 1 : 0;
    if (aBoth !== bBoth) return bBoth - aBoth;
    if (a.matchedViaGeneric !== b.matchedViaGeneric) return a.matchedViaGeneric ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    const nameA = String(a.product.Brand_Name || a.product.Product_Name || '');
    const nameB = String(b.product.Brand_Name || b.product.Product_Name || '');
    return nameA.localeCompare(nameB);
  });

  return results;
}

export function applyMutationLocally(
  dataset: FieldDataset,
  action: 'add' | 'update' | 'delete',
  sheet: SheetName,
  record: Record<string, unknown>
): FieldDataset {
  const idKey = SHEET_PRIMARY_KEY[sheet];
  const currentList = [...(dataset[sheet] as unknown as Record<string, unknown>[])];
  const targetId = String(record[idKey] ?? '').trim();

  if (action === 'delete' && targetId) {
    const filtered = currentList.filter(
      (item) => String(item[idKey] ?? '').trim() !== targetId
    );
    return {
      ...dataset,
      [sheet]: filtered,
    } as FieldDataset;
  }

  if (action === 'update' && targetId) {
    const idx = currentList.findIndex(
      (item) => String(item[idKey] ?? '').trim() === targetId
    );
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...record };
    } else {
      currentList.unshift(record);
    }
  } else {
    currentList.unshift(record);
  }

  return {
    ...dataset,
    [sheet]: currentList,
  } as FieldDataset;
}

export function generateRecordId(prefix: string): string {
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${stamp}${rand}`;
}

export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function addDaysToDate(baseDateISO: string, days: number): string {
  const parts = baseDateISO.split('-').map(Number);
  const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatReadableDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const cleaned = String(dateStr).slice(0, 10);
  const parts = cleaned.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatBDT(value?: number | string): string {
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  const cleaned = String(value).replace(/[৳,\s]/g, '');
  const num = Number(cleaned);
  if (Number.isNaN(num)) return `৳${value}`;
  return Number.isInteger(num)
    ? `৳${num.toLocaleString('en-BD')}`
    : `৳${num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parses pharmaceutical Pack_Size strings into billable unit count per box:
 * - Multiplication packs: "3x10s", "3 × 10", "30s Box (3x10s)", "2*7s" -> 30, 14
 * - Liquid / single-unit packs: "60ml", "100ml", "15gm", "1s", "1 Vial" -> 1
 * - Strip/count packs: "7s", "10s", "14s Box", "30 tablets" -> 7, 10, 14, 30
 */
export function parsePackUnits(packSize?: string): number {
  const raw = String(packSize ?? '').trim();
  if (!raw) return 1;

  // 1. Multiplication packs like "3x10s", "3 x 10", "5×10s", "2*7s" (excluding e.g. "1x100ml")
  const multiMatch = raw.match(
    /(\d+)\s*[x×*]\s*(\d+)\s*(?:s\b|tabs?|tablets?|caps?|capsules?|pcs?|strips?)?(?!\s*(?:ml|l|gm|g|mg|mcg|cc|oz)\b)/i
  );
  if (multiMatch) {
    const a = Number(multiMatch[1]);
    const b = Number(multiMatch[2]);
    if (a > 0 && b > 0) return a * b;
  }

  // 2. Liquid / cream / single packs like "60ml", "100ml", "15gm", "30g", "1s"
  if (/\b\d+(?:\.\d+)?\s*(?:ml|l|gm|g|mg|mcg|cc|oz)\b/i.test(raw)) {
    // Check if there is a multi-vial/ampoule prefix like "5x5ml"
    const multiLiquid = raw.match(/^(\d+)\s*[x×*]\s*\d+(?:\.\d+)?\s*(?:ml|gm|g)\b/i);
    if (multiLiquid && Number(multiLiquid[1]) > 1) {
      return Number(multiLiquid[1]);
    }
    return 1;
  }

  // 3. Single pack indicators like "1s", "1 bottle", "1 vial", "1 inhaler"
  if (/^\s*1\s*(?:s|bottle|vial|tube|jar|inhaler|pack|unit|pc|strip)?\s*$/i.test(raw)) {
    return 1;
  }

  // 4. Count packs like "7s", "10s", "14s Box", "30 tablets", "20 caps"
  const countMatch = raw.match(
    /\b(\d+)\s*(?:s\b|tabs?|tablets?|caps?|capsules?|pcs?|units?|sachets?|ampoules?|vials?|suppositories?)/i
  );
  if (countMatch) {
    const count = Number(countMatch[1]);
    if (count > 0) return count;
  }

  // 5. Fallback to leading standalone integer if present
  const plainInt = raw.match(/^\s*(\d+)\s*$/);
  if (plainInt && Number(plainInt[1]) > 0) {
    return Number(plainInt[1]);
  }

  return 1;
}

export function calculateBoxPrice(
  singlePrice?: number | string,
  packSize?: string
): string {
  if (singlePrice === undefined || singlePrice === null || String(singlePrice).trim() === '') {
    return '';
  }
  const unitVal = Number(String(singlePrice).replace(/[৳,\s]/g, ''));
  if (Number.isNaN(unitVal) || unitVal < 0) return '';
  const units = parsePackUnits(packSize);
  const total = Math.round((unitVal * units + Number.EPSILON) * 100) / 100;
  return String(total);
}

const SPECIALIST_ALIASES: Record<string, string[]> = {
  'internal medicine': ['medicine', 'general medicine', 'medicine / internal medicine', 'internal medicine / medicine'],
  pediatrics: ['paediatrics', 'child', 'pediatric', 'paediatric'],
  'endocrinology & diabetology': ['endocrinology', 'diabetology', 'diabetes', 'endocrinology / diabetology'],
  'pulmonology / chest': ['pulmonology', 'chest', 'respiratory', 'chest diseases', 'respiratory medicine'],
  'gynecology & obstetrics': ['gynecology', 'gynaecology', 'obstetrics', 'obgyn', 'gynae', 'obs & gynae'],
  'general surgery': ['surgery', 'surgeon'],
  'general physician (gp)': ['gp', 'general physician', 'general practice'],
  ent: ['ear nose throat', 'otolaryngology', 'ent & head neck'],
  orthopedics: ['orthopaedics', 'ortho', 'orthopedic surgery'],
};

export function matchSpecialistName(a?: string, b?: string): boolean {
  const normA = String(a ?? '').trim().toLowerCase();
  const normB = String(b ?? '').trim().toLowerCase();
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  for (const [canonical, aliases] of Object.entries(SPECIALIST_ALIASES)) {
    const group = [canonical, ...aliases];
    if (group.includes(normA) && group.includes(normB)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a Doctor belongs to a given Specialist (Department sheet row),
 * matching by Department_ID OR Specialty / Specialist name (with aliases).
 */
export function doctorMatchesDepartment(doc: Doctor, dept: Department): boolean {
  const docDeptId = String(doc.Department_ID ?? '').trim().toLowerCase();
  const deptId = String(dept.Department_ID ?? '').trim().toLowerCase();
  if (docDeptId && deptId && docDeptId === deptId) return true;

  const deptName = String(dept.Department_Name ?? '').trim();
  if (!deptName) return false;

  if (doc.Specialty && matchSpecialistName(doc.Specialty, deptName)) return true;
  if (doc.Department_ID && matchSpecialistName(doc.Department_ID, deptName)) return true;
  return false;
}

/**
 * Resolves a Doctor's Regular vs Guest classification from Doctor_Type, Category, Status, or Remarks.
 */
export function getDoctorType(doc?: Partial<Doctor> | Record<string, unknown> | null): DoctorType {
  if (!doc) return 'Regular';
  const candidates = [
    String((doc as Record<string, unknown>).Doctor_Type ?? ''),
    String((doc as Record<string, unknown>).Category ?? ''),
    String((doc as Record<string, unknown>).Status ?? ''),
    String((doc as Record<string, unknown>).Remarks ?? ''),
  ]
    .join(' ')
    .toLowerCase();

  if (/\bguest\b/.test(candidates) || candidates.includes('গেস্ট')) {
    return 'Guest';
  }
  return 'Regular';
}

export function formatDoctorRemarks(
  doctorType: DoctorType,
  visitingDays: string,
  visitingHours: string
): string {
  const parts: string[] = [
    `Type: ${doctorType === 'Guest' ? 'Guest (গেস্ট)' : 'Regular (নিয়মিত)'}`,
  ];
  if (visitingDays.trim()) parts.push(`Days: ${visitingDays.trim()}`);
  if (visitingHours.trim()) parts.push(`Time: ${visitingHours.trim()}`);
  return parts.join(' | ');
}

export function parseScheduleFromRemarks(remarks?: string): { days: string; hours: string } {
  const text = String(remarks ?? '').trim();
  if (!text) return { days: '', hours: '' };
  const daysMatch = text.match(/Days:\s*([^|]+)/i);
  const timeMatch = text.match(/Time:\s*([^|]+)/i);
  return {
    days: daysMatch ? daysMatch[1].trim() : '',
    hours: timeMatch ? timeMatch[1].trim() : '',
  };
}

export function getDoctorSchedule(
  doc: Doctor,
  chambers: Chamber[]
): { days: string; hours: string; primaryChamber?: Chamber } {
  const linked = chambers.filter((c) => c.Doctor_ID === doc.Doctor_ID);
  const primaryChamber =
    linked.find((c) => Boolean(c.Visiting_Days || c.Visiting_Hours)) || linked[0];
  const fromRemarks = parseScheduleFromRemarks(doc.Remarks);

  const days =
    String(primaryChamber?.Visiting_Days ?? '').trim() ||
    String(doc.Visiting_Days ?? '').trim() ||
    fromRemarks.days;
  const hours =
    String(primaryChamber?.Visiting_Hours ?? '').trim() ||
    String(doc.Visiting_Hours ?? '').trim() ||
    fromRemarks.hours;

  return { days, hours, primaryChamber };
}

export function parseVisitingDaysToSelection(raw?: string): {
  selectedDays: string[];
  isDaily: boolean;
} {
  const text = String(raw ?? '').trim();
  if (!text) return { selectedDays: [], isDaily: false };
  if (/daily|every\s*day|all\s*days|প্রতিদিন/i.test(text)) {
    return { selectedDays: [...VISITING_DAYS_LIST], isDaily: true };
  }

  const allDays: string[] = [...VISITING_DAYS_LIST];
  const found = new Set<string>();

  // Handle range like "Sat – Thu" or "Sun - Thu"
  const rangeMatch = text.match(
    /\b(sat|sun|mon|tue|wed|thu|fri)[a-z]*\s*[-–—to]+\s*(sat|sun|mon|tue|wed|thu|fri)[a-z]*\b/i
  );
  if (rangeMatch) {
    const startIdx = allDays.findIndex((d) => d.toLowerCase() === rangeMatch[1].toLowerCase());
    const endIdx = allDays.findIndex((d) => d.toLowerCase() === rangeMatch[2].toLowerCase());
    if (startIdx >= 0 && endIdx >= 0) {
      let i = startIdx;
      for (let step = 0; step < 7; step++) {
        found.add(allDays[i]);
        if (i === endIdx) break;
        i = (i + 1) % 7;
      }
    }
  }

  allDays.forEach((day) => {
    const regex = new RegExp(`\\b${day}`, 'i');
    if (regex.test(text)) {
      found.add(day);
    }
  });

  const ordered = allDays.filter((d) => found.has(d));
  return {
    selectedDays: ordered,
    isDaily: ordered.length === 7,
  };
}

export function formatVisitingDays(selectedDays: string[], isDaily: boolean): string {
  if (isDaily || selectedDays.length === 7) return 'Daily';
  const ordered = VISITING_DAYS_LIST.filter((d) => selectedDays.includes(d));
  return ordered.join(', ');
}

export function formatTime24To12(time24?: string): string {
  const raw = String(time24 ?? '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2];
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return raw;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

function parseSingleTimeTo24(part?: string): string {
  const raw = String(part ?? '').trim();
  if (!raw) return '';
  const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = Number(ampmMatch[1]);
    const m = ampmMatch[2] || '00';
    const mer = ampmMatch[3].toUpperCase();
    if (mer === 'PM' && h < 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const h24Match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    return `${String(Number(h24Match[1])).padStart(2, '0')}:${h24Match[2]}`;
  }
  return '';
}

export function parseTimeRangeTo24(rangeStr?: string): { start: string; end: string } {
  const text = String(rangeStr ?? '').trim();
  if (!text) return { start: '', end: '' };
  // If compound multi-slot string like "10:00 AM - 2:00 PM & 5:00 PM - 8:00 PM", only parse first slot if simple
  if (text.includes('&')) return { start: '', end: '' };
  const parts = text.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return { start: '', end: '' };
  return {
    start: parseSingleTimeTo24(parts[0]),
    end: parseSingleTimeTo24(parts[1]),
  };
}

/**
 * Splits comma- or semicolon-separated Product_ID strings (e.g. "LIN400, LIN600, LINSUS")
 * into deduplicated, trimmed product IDs.
 */
export function parseProductIds(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(/[,;\n]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = String(item ?? '').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

/**
 * Checks whether a detailing script's Product_ID field (single ID or comma-separated IDs)
 * includes the given target Product_ID.
 */
export function scriptMatchesProduct(
  scriptProductIds?: string | null,
  targetProductId?: string | null
): boolean {
  const target = String(targetProductId ?? '').trim().toLowerCase();
  if (!target || !scriptProductIds) return false;
  return parseProductIds(scriptProductIds).some((id) => id.toLowerCase() === target);
}

/**
 * Resolves comma-separated Product_IDs into readable Brand names for display.
 */
export function formatLinkedProductNames(
  scriptProductIds: string | undefined,
  productMap: Map<string, { Brand_Name?: string; Product_Name: string; Strength?: string }>
): string {
  const ids = parseProductIds(scriptProductIds);
  if (ids.length === 0) return 'Product';
  return ids
    .map((id) => {
      const prod = productMap.get(id);
      if (!prod) return id;
      const base = prod.Brand_Name || prod.Product_Name || id;
      if (prod.Strength && !base.toLowerCase().includes(prod.Strength.toLowerCase())) {
        return `${base} ${prod.Strength}`;
      }
      return base;
    })
    .join(', ');
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (value: string | number) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes a Generic Name into a stable grouping key.
 */
export function normalizeGenericKey(name?: string | null): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Extracts a clean brand family name (e.g. "Linzo 400mg Tablet" -> "Linzo", "Amlocard 5" -> "Amlocard").
 */
export function extractBrandBase(brandName?: string | null): string {
  const cleaned = String(brandName ?? '').trim();
  if (!cleaned) return '';
  // Strip trailing dosage strength/form tokens while preserving multi-word brand prefixes
  const withoutStrength = cleaned
    .replace(/\s+\d+(?:\.\d+)?\s*(?:mg|mcg|gm|g|ml|iu|%|s)?(?:\/\d+(?:\.\d+)?\s*(?:mg|ml))?.*$/i, '')
    .replace(/\s+(?:tablet|tab|capsule|cap|syrup|syr|pfs|suspension|susp|injection|inj|drops|cream|ointment|inhaler|plus|ds|sr|xr|er|iv|im)\b.*$/i, '')
    .trim();
  return withoutStrength || cleaned.split(/\s+/)[0] || cleaned;
}

/**
 * Legacy shorthand code prefixes mapped to known generic/brand keywords
 * so previously saved Google Sheet rows (e.g. "LZ4", "LZS", "LZ6") link automatically.
 */
const LEGACY_SHORTHAND_KEYWORDS: { pattern: RegExp; keywords: string[] }[] = [
  { pattern: /^lz[0-9a-z]*$/i, keywords: ['linezolid', 'linzo'] },
  { pattern: /^lin(?:zo)?(?:400|600|sus|pfs)?$/i, keywords: ['linezolid', 'linzo'] },
  { pattern: /^az(?:m|i|250|500|s|pfs)?$/i, keywords: ['azithromycin', 'azimex'] },
];

export interface GenericGroup {
  key: string;
  genericName: string;
  brandNames: string[];
  therapeuticClasses: string[];
  products: import('../types').Product[];
  productIds: string[];
  scripts: import('../types').DoctorProductDetailing[];
}

function tokenMatchesGenericMetadata(
  rawToken: string,
  genericName: string,
  productIdsLower: Set<string>,
  brandBasesLower: Set<string>,
  fullBrandNamesLower: Set<string>
): boolean {
  const token = rawToken.trim().toLowerCase();
  if (!token) return false;

  // 1. Exact Product_ID match
  if (productIdsLower.has(token)) return true;

  const normGeneric = normalizeGenericKey(genericName);
  if (normGeneric) {
    // 2. Exact Generic Name match
    if (token === normGeneric) return true;

    // 3. Base Generic match (e.g., "azithromycin" matches "azithromycin dihydrate")
    const genericFirstWord = normGeneric.split(/[\s+/,(]+/)[0] || '';
    const tokenFirstWord = token.split(/[\s+/,(]+/)[0] || '';
    if (token.length >= 5 && (normGeneric.startsWith(token) || token.startsWith(normGeneric))) {
      return true;
    }
    if (
      genericFirstWord.length >= 5 &&
      tokenFirstWord.length >= 5 &&
      genericFirstWord === tokenFirstWord
    ) {
      return true;
    }
  }

  // 4. Exact Brand Name or Brand Base match (e.g., "Linzo", "Azimex 500")
  if (fullBrandNamesLower.has(token) || brandBasesLower.has(token)) return true;
  for (const base of brandBasesLower) {
    if (base.length >= 4 && token.startsWith(base)) {
      return true;
    }
  }

  // 5. Legacy shorthand codes (e.g., "LZ4", "LZS", "LZ6" -> Linezolid / Linzo)
  const searchCorpus = [normGeneric, ...Array.from(brandBasesLower), ...Array.from(fullBrandNamesLower)].join(' ');
  for (const rule of LEGACY_SHORTHAND_KEYWORDS) {
    if (rule.pattern.test(token)) {
      if (rule.keywords.some((kw) => searchCorpus.includes(kw))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a Doctor_Product_Detailing row belongs to a Generic group.
 * Supports comma-separated Product_IDs, Generic Name strings, Brand Names,
 * and legacy shorthand codes (such as LZ4, LZS, LZ6).
 */
export function scriptMatchesGenericGroup(
  script: import('../types').DoctorProductDetailing,
  genericName: string,
  groupProducts: import('../types').Product[]
): boolean {
  const productIdsLower = new Set(
    groupProducts.map((p) => String(p.Product_ID ?? '').trim().toLowerCase()).filter(Boolean)
  );
  const brandBasesLower = new Set(
    groupProducts
      .map((p) => extractBrandBase(p.Brand_Name || p.Product_Name).toLowerCase())
      .filter(Boolean)
  );
  const fullBrandNamesLower = new Set(
    groupProducts
      .map((p) => String(p.Brand_Name || p.Product_Name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const tokens = [
    ...parseProductIds(script.Product_ID),
    ...(script.Generic_Name ? [String(script.Generic_Name).trim()] : []),
  ].filter(Boolean);

  if (tokens.length === 0) return false;

  return tokens.some((tok) =>
    tokenMatchesGenericMetadata(
      tok,
      genericName,
      productIdsLower,
      brandBasesLower,
      fullBrandNamesLower
    )
  );
}

/**
 * Groups all Products by unique Generic Name and links all matching
 * Doctor_Product_Detailing scripts to their Generic group.
 */
export function buildGenericGroups(
  products: import('../types').Product[],
  scripts: import('../types').DoctorProductDetailing[]
): GenericGroup[] {
  const groupMap = new Map<string, GenericGroup>();

  for (const prod of products) {
    const rawGeneric =
      String(prod.Generic_Name ?? '').trim() ||
      extractBrandBase(prod.Brand_Name || prod.Product_Name) ||
      prod.Product_ID;
    const key = normalizeGenericKey(rawGeneric);
    if (!key) continue;

    let group = groupMap.get(key);
    if (!group) {
      group = {
        key,
        genericName: rawGeneric,
        brandNames: [],
        therapeuticClasses: [],
        products: [],
        productIds: [],
        scripts: [],
      };
      groupMap.set(key, group);
    }

    group.products.push(prod);

    const pid = String(prod.Product_ID ?? '').trim();
    if (pid && !group.productIds.some((id) => id.toLowerCase() === pid.toLowerCase())) {
      group.productIds.push(pid);
    }

    const brandBase = extractBrandBase(prod.Brand_Name || prod.Product_Name);
    if (
      brandBase &&
      !group.brandNames.some((b) => b.toLowerCase() === brandBase.toLowerCase())
    ) {
      group.brandNames.push(brandBase);
    }

    const tClass = String(prod.Therapeutic_Class ?? '').trim();
    if (
      tClass &&
      !group.therapeuticClasses.some((c) => c.toLowerCase() === tClass.toLowerCase())
    ) {
      group.therapeuticClasses.push(tClass);
    }
  }

  const allGroups = Array.from(groupMap.values());
  const matchedScriptIds = new Set<string>();

  for (const group of allGroups) {
    const seenDetailingIds = new Set<string>();
    for (const script of scripts) {
      const hasContent =
        Boolean(String(script.Specialist ?? '').trim()) ||
        Boolean(String(script.Detailing_BN ?? '').trim()) ||
        Boolean(String(script.Detailing_EN ?? '').trim());
      if (!hasContent) continue;

      if (scriptMatchesGenericGroup(script, group.genericName, group.products)) {
        const sid = String(script.Detailing_ID ?? '').trim() || `${script.Product_ID}-${script.Specialist}`;
        if (!seenDetailingIds.has(sid)) {
          seenDetailingIds.add(sid);
          group.scripts.push(script);
          matchedScriptIds.add(sid);
        }
      }
    }
  }

  // Ensure any saved detailing scripts whose Product_ID / Generic doesn't match a product row
  // still appear cleanly in their own fallback Generic group (never hidden)
  for (const script of scripts) {
    const hasContent =
      Boolean(String(script.Specialist ?? '').trim()) ||
      Boolean(String(script.Detailing_BN ?? '').trim()) ||
      Boolean(String(script.Detailing_EN ?? '').trim());
    if (!hasContent) continue;

    const sid = String(script.Detailing_ID ?? '').trim() || `${script.Product_ID}-${script.Specialist}`;
    if (matchedScriptIds.has(sid)) continue;

    const fallbackLabel =
      String(script.Generic_Name ?? '').trim() ||
      String(script.Product_ID ?? '').trim() ||
      'General Product';
    const fallbackKey = normalizeGenericKey(fallbackLabel);
    let fallbackGroup = groupMap.get(fallbackKey);
    if (!fallbackGroup) {
      fallbackGroup = {
        key: fallbackKey,
        genericName: fallbackLabel,
        brandNames: [],
        therapeuticClasses: [],
        products: [],
        productIds: parseProductIds(script.Product_ID),
        scripts: [],
      };
      groupMap.set(fallbackKey, fallbackGroup);
      allGroups.push(fallbackGroup);
    }
    fallbackGroup.scripts.push(script);
    matchedScriptIds.add(sid);
  }

  // Sort: generics with saved scripts first (most scripts first), then alphabetically
  allGroups.sort((a, b) => {
    const aHas = a.scripts.length > 0 ? 1 : 0;
    const bHas = b.scripts.length > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    if (a.scripts.length !== b.scripts.length) return b.scripts.length - a.scripts.length;
    return a.genericName.localeCompare(b.genericName);
  });

  return allGroups;
}

/**
 * Returns dashboard summary metrics for saved detailing scripts and unique generics covered.
 */
export function getDetailingOverviewStats(
  products: import('../types').Product[],
  scripts: import('../types').DoctorProductDetailing[]
): { totalScripts: number; uniqueGenericsWithScripts: number } {
  const validScripts = scripts.filter(
    (s) =>
      Boolean(String(s.Specialist ?? '').trim()) ||
      Boolean(String(s.Detailing_BN ?? '').trim()) ||
      Boolean(String(s.Detailing_EN ?? '').trim())
  );
  const groups = buildGenericGroups(products, validScripts);
  const uniqueGenericsWithScripts = groups.filter((g) => g.scripts.length > 0).length;
  return {
    totalScripts: validScripts.length,
    uniqueGenericsWithScripts,
  };
}

// ============================================================================
// Bengali Disease Guide (বিস্তারিত) — Cache, Sheet Parser & Server API Helpers
// ============================================================================

const DISEASE_GUIDE_CACHE_PREFIX = 'mfa_di_disease_guide_bn_v1:';

export function normalizeDiseaseGuideKey(indicationName: string): string {
  return String(indicationName ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sanitizeGuideList(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => String(item ?? '').trim()).filter(Boolean);
}

export function loadCachedDiseaseGuide(indicationName: string): DiseaseGuideBN | null {
  try {
    const key = normalizeDiseaseGuideKey(indicationName);
    if (!key) return null;
    const raw = localStorage.getItem(`${DISEASE_GUIDE_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DiseaseGuideBN>;
    if (!parsed || typeof parsed !== 'object') return null;
    const hasContent =
      Boolean(String(parsed.overview ?? '').trim()) ||
      Boolean(String(parsed.rawSheetText ?? '').trim()) ||
      (Array.isArray(parsed.keySymptoms) && parsed.keySymptoms.length > 0);
    if (!hasContent) return null;

    return {
      indicationKey: String(parsed.indicationKey || key),
      indicationName: String(parsed.indicationName || indicationName).trim(),
      titleBn: String(parsed.titleBn || indicationName).trim(),
      overview: String(parsed.overview || '').trim(),
      causesAndRiskFactors: sanitizeGuideList(parsed.causesAndRiskFactors),
      keySymptoms: sanitizeGuideList(parsed.keySymptoms),
      managementAndPrevention: sanitizeGuideList(parsed.managementAndPrevention),
      specialistWarning: parsed.specialistWarning ? String(parsed.specialistWarning).trim() : undefined,
      mpoDetailingFocus: sanitizeGuideList(parsed.mpoDetailingFocus),
      rawSheetText: parsed.rawSheetText ? String(parsed.rawSheetText).trim() : undefined,
      source: parsed.source === 'sheet' ? 'sheet' : 'ai',
      generatedAt: String(parsed.generatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function saveCachedDiseaseGuide(indicationName: string, guide: DiseaseGuideBN): void {
  try {
    const key = normalizeDiseaseGuideKey(indicationName);
    if (!key) return;
    localStorage.setItem(
      `${DISEASE_GUIDE_CACHE_PREFIX}${key}`,
      JSON.stringify({
        ...guide,
        indicationKey: key,
        indicationName: guide.indicationName || indicationName,
      })
    );
  } catch {
    // Ignore storage quota or private-mode errors gracefully
  }
}

export function parseSheetDescriptionBn(
  indicationName: string,
  rawDescriptionBn?: string
): DiseaseGuideBN | null {
  const cleaned = String(rawDescriptionBn ?? '').trim();
  if (!cleaned) return null;

  const key = normalizeDiseaseGuideKey(indicationName);

  // Support structured JSON stored inside Description_BN
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned) as Partial<DiseaseGuideBN>;
      const overview = String(parsed.overview ?? '').trim();
      const causes = sanitizeGuideList(parsed.causesAndRiskFactors);
      const symptoms = sanitizeGuideList(parsed.keySymptoms);
      const management = sanitizeGuideList(parsed.managementAndPrevention);
      const detailing = sanitizeGuideList(parsed.mpoDetailingFocus);
      if (overview || causes.length > 0 || symptoms.length > 0 || management.length > 0) {
        return {
          indicationKey: key,
          indicationName,
          titleBn: String(parsed.titleBn || indicationName).trim(),
          overview,
          causesAndRiskFactors: causes,
          keySymptoms: symptoms,
          managementAndPrevention: management,
          specialistWarning: parsed.specialistWarning
            ? String(parsed.specialistWarning).trim()
            : undefined,
          mpoDetailingFocus: detailing,
          source: 'sheet',
          generatedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fall through to plain Bengali sheet text parsing
    }
  }

  return {
    indicationKey: key,
    indicationName,
    titleBn: indicationName,
    overview: cleaned,
    causesAndRiskFactors: [],
    keySymptoms: [],
    managementAndPrevention: [],
    mpoDetailingFocus: [],
    rawSheetText: cleaned,
    source: 'sheet',
    generatedAt: new Date().toISOString(),
  };
}

export function formatDiseaseGuideForCopy(guide: DiseaseGuideBN): string {
  const lines: string[] = [];
  const header =
    guide.titleBn && guide.titleBn.toLowerCase() !== guide.indicationName.toLowerCase()
      ? `${guide.titleBn} (${guide.indicationName})`
      : guide.indicationName;

  lines.push(`ক্লিনিক্যাল নির্দেশিকা: ${header}`);
  lines.push('');

  if (guide.rawSheetText && guide.causesAndRiskFactors.length === 0 && guide.keySymptoms.length === 0) {
    lines.push('বিস্তারিত:');
    lines.push(guide.rawSheetText);
    return lines.join('\n').trim();
  }

  if (guide.overview) {
    lines.push('১. রোগটি কী? (সংজ্ঞা):');
    lines.push(guide.overview);
    lines.push('');
  }

  if (guide.causesAndRiskFactors.length > 0) {
    lines.push('২. প্রধান কারণ ও ঝুঁকির দিক:');
    guide.causesAndRiskFactors.forEach((item) => lines.push(`• ${item}`));
    lines.push('');
  }

  if (guide.keySymptoms.length > 0) {
    lines.push('৩. মূল লক্ষণসমূহ:');
    guide.keySymptoms.forEach((item) => lines.push(`• ${item}`));
    lines.push('');
  }

  if (guide.managementAndPrevention.length > 0 || guide.specialistWarning) {
    lines.push('৪. প্রাথমিক করণীয়, প্রতিকার ও চিকিৎসা নীতি:');
    guide.managementAndPrevention.forEach((item) => lines.push(`• ${item}`));
    if (guide.specialistWarning) {
      lines.push(`সতর্কতা: ${guide.specialistWarning}`);
    }
    lines.push('');
  }

  if (guide.mpoDetailingFocus.length > 0) {
    lines.push('৫. MPO ডিটেইলিং ফোকাস:');
    guide.mpoDetailingFocus.forEach((item) => lines.push(`• ${item}`));
  }

  return lines.join('\n').trim();
}

const DISEASE_GUIDE_TIMEOUT_MS = 15000;

export async function fetchDiseaseGuideFromServer(
  payload: {
    indicationName: string;
    category?: string;
    specialists?: string[];
    keyGenerics?: string[];
    therapeuticClasses?: string[];
    matchedBrands?: string[];
  },
  signal?: AbortSignal
): Promise<DiseaseGuideBN> {
  const internalController = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => {
    internalController.abort();
  };

  if (signal) {
    if (signal.aborted) {
      internalController.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    internalController.abort();
  }, DISEASE_GUIDE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/disease-guide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: internalController.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new Error(
        'Request timed out after 15 seconds. অনুগ্রহ করে "আবার চেষ্টা করুন (Retry)" বাটনে ক্লিক করুন।'
      );
    }
    if (signal?.aborted) {
      const abortErr = new Error('Request cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw new Error(
      err instanceof Error
        ? `Network error: ${err.message}`
        : 'নেটওয়ার্ক ত্রুটি: সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।'
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }

  const rawBody = await response.text().catch(() => '');
  const parsedResp = safeParseJsonResponse<{
    status?: string;
    ok?: boolean;
    error?: unknown;
    message?: string;
    guide?: {
      titleBn?: string;
      overview?: string;
      causesAndRiskFactors?: string[];
      keySymptoms?: string[];
      managementAndPrevention?: string[];
      specialistWarning?: string;
      mpoDetailingFocus?: string[];
    };
  }>(rawBody);

  const data = parsedResp.ok ? parsedResp.data : null;
  const apiError = extractApiErrorMessage(data);

  if (
    !response.ok ||
    !parsedResp.ok ||
    !data ||
    data.ok === false ||
    data.status === 'error' ||
    Boolean(data.error) ||
    data.status !== 'success' ||
    !data.guide
  ) {
    const parseErr = !parsedResp.ok ? parsedResp.error : '';
    const httpHint = !response.ok
      ? response.statusText
        ? `HTTP ${response.status} ${response.statusText}`
        : `HTTP ${response.status}`
      : 'Unexpected response payload';
    throw new Error(
      apiError ||
        parseErr ||
        `বাংলা ক্লিনিক্যাল গাইড তৈরি করা যায়নি (${httpHint})। অনুগ্রহ করে আবার চেষ্টা করুন।`
    );
  }

  const g = data.guide;
  const key = normalizeDiseaseGuideKey(payload.indicationName);
  const overview = String(g.overview || '').trim();
  const causesAndRiskFactors = sanitizeGuideList(g.causesAndRiskFactors);
  const keySymptoms = sanitizeGuideList(g.keySymptoms);
  const managementAndPrevention = sanitizeGuideList(g.managementAndPrevention);
  const mpoDetailingFocus = sanitizeGuideList(g.mpoDetailingFocus);

  if (!overview && keySymptoms.length === 0) {
    throw new Error('অসম্পূর্ণ ক্লিনিক্যাল গাইড পাওয়া গেছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  return {
    indicationKey: key,
    indicationName: payload.indicationName,
    titleBn: String(g.titleBn || payload.indicationName).trim(),
    overview,
    causesAndRiskFactors,
    keySymptoms,
    managementAndPrevention,
    specialistWarning: g.specialistWarning ? String(g.specialistWarning).trim() : undefined,
    mpoDetailingFocus,
    source: 'ai',
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Safe JSON Response Parser (strips markdown fences, extracts balanced JSON,
// detects HTML responses, and surfaces data.error / data.ok === false cleanly)
// ============================================================================

function stripJsonCodeFences(raw: string): string {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractBalancedJsonObjectFromText(text: string): string | null {
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

export function safeParseJsonResponse<T = Record<string, unknown>>(
  rawBody: string
): { ok: true; data: T } | { ok: false; error: string } {
  const raw = String(rawBody ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) {
    return { ok: false, error: 'Empty response received from the calculation service.' };
  }

  // Detect HTML returned with HTTP 200 (e.g., static host SPA fallback or proxy error page)
  if (/^(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(raw)) {
    return {
      ok: false,
      error:
        'Live dose calculation API is unavailable on this endpoint (received HTML instead of JSON).',
    };
  }

  const unfenced = stripJsonCodeFences(raw);
  try {
    const parsed = JSON.parse(unfenced) as T;
    if (parsed && typeof parsed === 'object') {
      return { ok: true, data: parsed };
    }
  } catch {
    // Fall through to balanced JSON object extraction
  }

  const extracted = extractBalancedJsonObjectFromText(unfenced);
  if (extracted) {
    try {
      const parsed = JSON.parse(extracted) as T;
      if (parsed && typeof parsed === 'object') {
        return { ok: true, data: parsed };
      }
    } catch {
      // Fall through to clean parse error
    }
  }

  return {
    ok: false,
    error: 'Received invalid JSON response from the live dose calculation service.',
  };
}

export function extractApiErrorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;

  if (typeof obj.error === 'string' && obj.error.trim()) {
    return obj.error.trim();
  }
  if (obj.error && typeof obj.error === 'object') {
    const nested = obj.error as Record<string, unknown>;
    const msg = typeof nested.message === 'string' ? nested.message.trim() : '';
    if (msg) return msg;
  }
  if (typeof obj.message === 'string' && obj.message.trim()) {
    if (obj.ok === false || obj.status === 'error' || obj.status !== 'success') {
      return obj.message.trim();
    }
  }
  if (obj.ok === false) {
    return 'The dose calculation service reported an error (ok: false).';
  }
  return '';
}

// ============================================================================
// Dose Calculator — Liquid Parser, Exact Pediatric Arithmetic, Cache & API
// ============================================================================

const DOSE_CALC_CACHE_PREFIX = 'mfa_di_dose_calc_v1:';
const DOSE_CALC_TIMEOUT_MS = 25000;

export function isLiquidDosageForm(dosageForm?: string, strength?: string): boolean {
  const combined = `${dosageForm ?? ''} ${strength ?? ''}`.toLowerCase();
  return (
    /\b(suspension|susp|pfs|powder\s+for\s+suspension|syrup|syr|drops?|paediatric\s+drops?|pediatric\s+drops?|oral\s+solution|solution|elixir|liquid|dry\s+syrup)\b/i.test(
      combined
    ) || /\/\s*\d*(?:\.\d+)?\s*ml\b/i.test(String(strength ?? ''))
  );
}

/**
 * Parses liquid pharmaceutical concentrations into exact mg/mL for deterministic frontend math.
 * Supports:
 * - "100 mg/5 ml", "200mg/5ml", "125mg/5ml", "400mg/5ml"
 * - "100mg/ml", "25mg/1ml", "80mg/0.8ml", "50mg/1.25ml"
 * - "1g/5ml" -> 1000mg/5ml
 * - Combination liquids like "125mg + 31.25mg / 5ml" or "125mg+31.25mg/5ml" (uses primary component)
 */
export function parseLiquidStrength(
  strength?: string,
  dosageForm?: string
): ParsedLiquidStrength {
  const rawStrength = String(strength ?? '').trim();
  const rawForm = String(dosageForm ?? '').trim();
  const isDrops = /\b(drops?|pediatric\s+drops?|paediatric\s+drops?)\b/i.test(
    `${rawForm} ${rawStrength}`
  );
  const isLiquid = isLiquidDosageForm(rawForm, rawStrength);

  if (!rawStrength) {
    return {
      isLiquid,
      mgPerMl: null,
      numeratorMg: null,
      denominatorMl: null,
      unitLabel: '',
      isDrops,
    };
  }

  // Combination pattern like "125mg + 31.25mg / 5ml" or "200mg+28.5mg/5ml"
  const comboMatch = rawStrength.match(
    /(\d+(?:\.\d+)?)\s*(mg|g|gm)\s*\+\s*(\d+(?:\.\d+)?)\s*(mg|g|gm)?\s*\/\s*(\d+(?:\.\d+)?)?\s*ml\b/i
  );
  if (comboMatch) {
    const firstVal = Number(comboMatch[1]);
    const firstUnit = comboMatch[2].toLowerCase();
    const denomMl = comboMatch[5] ? Number(comboMatch[5]) : 1;
    const primaryMg = firstUnit === 'g' || firstUnit === 'gm' ? firstVal * 1000 : firstVal;
    if (primaryMg > 0 && denomMl > 0) {
      return {
        isLiquid: true,
        mgPerMl: primaryMg / denomMl,
        numeratorMg: primaryMg,
        denominatorMl: denomMl,
        unitLabel: `${primaryMg} mg / ${denomMl} mL`,
        isDrops,
        isCombinationNote: `Calculated on primary active component (${primaryMg} mg per ${denomMl} mL)`,
      };
    }
  }

  // Standard liquid pattern like "100mg/5ml", "100 mg / 5 ml", "80mg/0.8ml", "100mg/ml", "1g/5ml"
  const standardMatch = rawStrength.match(
    /(\d+(?:\.\d+)?)\s*(mg|g|gm)\s*\/\s*(\d+(?:\.\d+)?)?\s*ml\b/i
  );
  if (standardMatch) {
    const numVal = Number(standardMatch[1]);
    const unit = standardMatch[2].toLowerCase();
    const denomMl = standardMatch[3] ? Number(standardMatch[3]) : 1;
    const numMg = unit === 'g' || unit === 'gm' ? numVal * 1000 : numVal;
    if (numMg > 0 && denomMl > 0) {
      return {
        isLiquid: true,
        mgPerMl: numMg / denomMl,
        numeratorMg: numMg,
        denominatorMl: denomMl,
        unitLabel: `${numMg} mg / ${denomMl} mL`,
        isDrops,
      };
    }
  }

  return {
    isLiquid,
    mgPerMl: null,
    numeratorMg: null,
    denominatorMl: null,
    unitLabel: '',
    isDrops,
  };
}

function roundDoseNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

function roundMlNumber(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 1) return Math.round(value * 100) / 100;
  return Math.round(value * 10) / 10;
}

function formatTeaspoonEquivalent(minMl: number, maxMl: number): string {
  const formatSingleTsp = (ml: number): string => {
    const tsp = ml / 5;
    if (tsp < 0.2) return '< 0.25 tsp';
    const quarterRounded = Math.round(tsp * 4) / 4;
    if (quarterRounded === 0.25) return '¼ tsp (¼ চা চামচ)';
    if (quarterRounded === 0.5) return '½ tsp (আধা চা চামচ)';
    if (quarterRounded === 0.75) return '¾ tsp (¾ চা চামচ)';
    if (quarterRounded === 1) return '1 tsp (১ চা চামচ)';
    if (quarterRounded === 1.5) return '1½ tsp (দেড় চা চামচ)';
    if (quarterRounded === 2) return '2 tsp (২ চা চামচ)';
    const clean = Number.isInteger(quarterRounded)
      ? String(quarterRounded)
      : quarterRounded.toFixed(2).replace(/0$/, '');
    return `~${clean} tsp (প্রায় ${clean} চা চামচ)`;
  };

  if (Math.abs(maxMl - minMl) < 0.15) {
    return formatSingleTsp(minMl);
  }
  const minTsp = Math.round((minMl / 5) * 10) / 10;
  const maxTsp = Math.round((maxMl / 5) * 10) / 10;
  return `~${minTsp}–${maxTsp} tsp (১ চা চামচ = ৫ mL)`;
}

/**
 * Deterministic front-end arithmetic for pediatric weight-based dosing & liquid mL conversion.
 * Strictly enforces maximum daily dose caps and optional single-dose caps.
 */
export function computePediatricDoseMath(
  weightKg: number | null | undefined,
  pediatric: DoseCalculationResult['pediatric'],
  liquidInfo: ParsedLiquidStrength
): ComputedPediatricDose | null {
  if (!pediatric.applicable) return null;
  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) return null;

  const minRate = pediatric.mgPerKgPerDayMin;
  const maxRate = pediatric.mgPerKgPerDayMax ?? minRate;
  if (!minRate || minRate <= 0) return null;

  const effectiveMaxRate = maxRate && maxRate >= minRate ? maxRate : minRate;
  const dosesPerDay =
    Number.isFinite(pediatric.dosesPerDay) && pediatric.dosesPerDay >= 1
      ? Math.round(pediatric.dosesPerDay)
      : 2;

  const rawDailyMin = weightKg * minRate;
  const rawDailyMax = weightKg * effectiveMaxRate;

  const maxDailyCap =
    pediatric.maxDailyDoseMg && pediatric.maxDailyDoseMg > 0 ? pediatric.maxDailyDoseMg : null;
  const maxSingleCap =
    pediatric.maxSingleDoseMg && pediatric.maxSingleDoseMg > 0 ? pediatric.maxSingleDoseMg : null;

  let wasDailyCapApplied = false;
  let dailyMinMg = rawDailyMin;
  let dailyMaxMg = rawDailyMax;

  if (maxDailyCap !== null) {
    if (dailyMinMg > maxDailyCap) {
      dailyMinMg = maxDailyCap;
      wasDailyCapApplied = true;
    }
    if (dailyMaxMg > maxDailyCap) {
      dailyMaxMg = maxDailyCap;
      wasDailyCapApplied = true;
    }
  }

  let singleMinMg = dailyMinMg / dosesPerDay;
  let singleMaxMg = dailyMaxMg / dosesPerDay;
  let wasSingleCapApplied = false;

  if (maxSingleCap !== null) {
    if (singleMinMg > maxSingleCap) {
      singleMinMg = maxSingleCap;
      wasSingleCapApplied = true;
    }
    if (singleMaxMg > maxSingleCap) {
      singleMaxMg = maxSingleCap;
      wasSingleCapApplied = true;
    }
    if (wasSingleCapApplied) {
      dailyMinMg = Math.min(dailyMinMg, singleMinMg * dosesPerDay);
      dailyMaxMg = Math.min(dailyMaxMg, singleMaxMg * dosesPerDay);
    }
  }

  let singleMinMl: number | null = null;
  let singleMaxMl: number | null = null;
  let teaspoonLabel: string | null = null;
  let dropsLabel: string | null = null;

  if (liquidInfo.mgPerMl && liquidInfo.mgPerMl > 0) {
    singleMinMl = roundMlNumber(singleMinMg / liquidInfo.mgPerMl);
    singleMaxMl = roundMlNumber(singleMaxMg / liquidInfo.mgPerMl);
    if (liquidInfo.isDrops) {
      dropsLabel =
        Math.abs(singleMaxMl - singleMinMl) < 0.05
          ? `${singleMinMl} mL via calibrated dropper`
          : `${singleMinMl}–${singleMaxMl} mL via calibrated dropper`;
    } else {
      teaspoonLabel = formatTeaspoonEquivalent(singleMinMl, singleMaxMl);
    }
  }

  return {
    weightKg,
    dailyMinMg: roundDoseNumber(dailyMinMg),
    dailyMaxMg: roundDoseNumber(dailyMaxMg),
    singleMinMg: roundDoseNumber(singleMinMg),
    singleMaxMg: roundDoseNumber(singleMaxMg),
    dosesPerDay,
    wasDailyCapApplied,
    wasSingleCapApplied,
    singleMinMl,
    singleMaxMl,
    teaspoonLabel,
    dropsLabel,
  };
}

export function buildDoseCacheKey(params: {
  genericName: string;
  strength?: string;
  dosageForm?: string;
  weightKg?: number | null;
  indication?: string;
  renalElderlyCaution?: boolean;
}): string {
  const norm = (s?: string) =>
    String(s ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  const weightBucket =
    params.weightKg && Number.isFinite(params.weightKg) && params.weightKg > 0
      ? String(Math.round(params.weightKg * 10) / 10)
      : 'any';
  return [
    norm(params.genericName),
    norm(params.strength) || 'any',
    norm(params.dosageForm) || 'any',
    weightBucket,
    norm(params.indication) || 'general',
    params.renalElderlyCaution ? 'renal' : 'std',
  ].join('|');
}

export function loadCachedDoseCalculation(cacheKey: string): DoseCalculationResult | null {
  try {
    if (!cacheKey) return null;
    const raw = localStorage.getItem(`${DOSE_CALC_CACHE_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DoseCalculationResult>;
    if (
      !parsed ||
      parsed.source === 'catalog-fallback' ||
      !parsed.pediatric ||
      !parsed.adult ||
      !parsed.duration ||
      !parsed.safety
    ) {
      return null;
    }
    return parsed as DoseCalculationResult;
  } catch {
    return null;
  }
}

export function saveCachedDoseCalculation(result: DoseCalculationResult): void {
  try {
    if (!result.cacheKey || result.source === 'catalog-fallback') return;
    localStorage.setItem(`${DOSE_CALC_CACHE_PREFIX}${result.cacheKey}`, JSON.stringify(result));
  } catch {
    // Ignore storage quota or private-mode errors gracefully
  }
}

/**
 * Calls the server-side `/api/dose-calculator` endpoint (powered by `@google/genai` on `server.ts`)
 * with safe JSON parsing and timeout/abort handling.
 */
export async function fetchDoseCalculationFromGemini(
  payload: {
    genericName: string;
    brandName?: string;
    strength?: string;
    dosageForm?: string;
    approvedIndications?: string;
    indication?: string;
    patientMode: DosePatientMode;
    weightKg?: number | null;
    ageText?: string;
    renalElderlyCaution?: boolean;
  },
  signal?: AbortSignal
): Promise<DoseCalculationResult> {
  const internalController = new AbortController();
  let timedOut = false;

  const onExternalAbort = () => {
    internalController.abort();
  };

  if (signal) {
    if (signal.aborted) {
      internalController.abort();
    } else {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    internalController.abort();
  }, DOSE_CALC_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/dose-calculator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: internalController.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new Error(
        `Request timed out after ${Math.round(DOSE_CALC_TIMEOUT_MS / 1000)} seconds.`
      );
    }
    if (signal?.aborted) {
      const abortErr = new Error('Request cancelled');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    throw new Error(
      err instanceof Error ? `Network error: ${err.message}` : 'Unable to reach dose calculator service.'
    );
  } finally {
    window.clearTimeout(timeoutId);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }

  const rawBody = await response.text().catch(() => '');
  type DosePayloadShape = Omit<
    DoseCalculationResult,
    'cacheKey' | 'genericName' | 'brandName' | 'strength' | 'dosageForm' | 'indication' | 'generatedAt'
  >;
  const parsedResp = safeParseJsonResponse<{
    status?: string;
    ok?: boolean;
    error?: unknown;
    message?: string;
    calculation?: DosePayloadShape;
    data?: DosePayloadShape;
    pediatric?: DoseCalculationResult['pediatric'];
    adult?: DoseCalculationResult['adult'];
    duration?: DoseCalculationResult['duration'];
    administration?: DoseCalculationResult['administration'];
    safety?: DoseCalculationResult['safety'];
    therapeuticClass?: string;
  }>(rawBody);

  const data = parsedResp.ok ? parsedResp.data : null;
  const apiError = extractApiErrorMessage(data);

  const rawCalculation: DosePayloadShape | null =
    data?.calculation ??
    (data?.data && data.data.pediatric && data.data.adult ? data.data : null) ??
    (data && data.pediatric && data.adult && data.duration && data.administration && data.safety
      ? {
          therapeuticClass: data.therapeuticClass,
          pediatric: data.pediatric,
          adult: data.adult,
          duration: data.duration,
          administration: data.administration,
          safety: data.safety,
        }
      : null);

  if (
    !response.ok ||
    !parsedResp.ok ||
    !data ||
    data.ok === false ||
    data.status === 'error' ||
    Boolean(data.error) ||
    !rawCalculation ||
    !rawCalculation.pediatric ||
    !rawCalculation.adult ||
    !rawCalculation.duration ||
    !rawCalculation.administration ||
    !rawCalculation.safety
  ) {
    const parseErr = !parsedResp.ok ? parsedResp.error : '';
    const statusHint = !response.ok
      ? response.statusText
        ? `HTTP ${response.status} ${response.statusText}`
        : `HTTP ${response.status}`
      : 'Incomplete structured dose payload';
    throw new Error(
      apiError || parseErr || `Live dose calculation unavailable (${statusHint}).`
    );
  }

  const cacheKey = buildDoseCacheKey({
    genericName: payload.genericName,
    strength: payload.strength,
    dosageForm: payload.dosageForm,
    weightKg: payload.weightKg,
    indication: payload.indication,
    renalElderlyCaution: payload.renalElderlyCaution,
  });

  const c = rawCalculation;
  return {
    cacheKey,
    genericName: payload.genericName,
    brandName: payload.brandName || undefined,
    strength: payload.strength || undefined,
    dosageForm: payload.dosageForm || undefined,
    indication: payload.indication || undefined,
    therapeuticClass: c.therapeuticClass || undefined,
    pediatric: c.pediatric,
    adult: c.adult,
    duration: c.duration,
    administration: c.administration,
    safety: c.safety,
    source: 'ai',
    generatedAt: new Date().toISOString(),
  };
}

export const fetchDoseCalculationFromServer = fetchDoseCalculationFromGemini;

export function formatDoseRangeMg(minMg: number, maxMg: number): string {
  if (Math.abs(maxMg - minMg) < 0.05) return `${minMg} mg`;
  return `${minMg}–${maxMg} mg`;
}

export function formatDoseRangeMl(minMl: number, maxMl: number): string {
  if (Math.abs(maxMl - minMl) < 0.05) return `${minMl} mL`;
  return `${minMl}–${maxMl} mL`;
}

export function formatDoseSummaryForCopy(
  result: DoseCalculationResult,
  computedPed: ComputedPediatricDose | null,
  liquidInfo: ParsedLiquidStrength
): string {
  const lines: string[] = [];
  const titleParts = [
    result.brandName ? `${result.brandName}` : '',
    result.genericName,
    result.strength || '',
    result.dosageForm || '',
  ].filter(Boolean);
  lines.push(`Dose Reference — ${titleParts.join(' · ')}`);
  if (result.source === 'catalog-fallback') {
    lines.push(`Source: ${result.sourceLabel || 'Standard Catalog Reference Dose'}`);
  }
  if (result.indication) {
    lines.push(`Indication: ${result.indication}`);
  }
  lines.push('');

  lines.push('1. Pediatric Dose (শিশুদের ডোজ):');
  if (!result.pediatric.applicable) {
    lines.push(
      `• ${result.pediatric.contraindicationBadge || 'Not recommended / contraindicated in children'}`
    );
    if (result.pediatric.pediatricNotes) lines.push(`• ${result.pediatric.pediatricNotes}`);
  } else {
    lines.push(`• Standard Range: ${result.pediatric.standardRangeLabel}`);
    if (computedPed) {
      const mgStr = formatDoseRangeMg(computedPed.singleMinMg, computedPed.singleMaxMg);
      const mlStr =
        computedPed.singleMinMl != null && computedPed.singleMaxMl != null
          ? ` (${formatDoseRangeMl(computedPed.singleMinMl, computedPed.singleMaxMl)}${
              computedPed.teaspoonLabel
                ? ` · ${computedPed.teaspoonLabel}`
                : computedPed.dropsLabel
                ? ` · ${computedPed.dropsLabel}`
                : ''
            })`
          : '';
      lines.push(
        `• Calculated Single Dose (${computedPed.weightKg} kg): ${mgStr}${mlStr} — ${result.pediatric.frequencyLabel}`
      );
      if (liquidInfo.unitLabel) {
        lines.push(`• Liquid Concentration: ${liquidInfo.unitLabel}`);
      }
      if (computedPed.wasDailyCapApplied || computedPed.wasSingleCapApplied) {
        lines.push(`• Note: Maximum pediatric dose cap applied (${result.pediatric.maxDailyLimitLabel})`);
      }
    }
    if (result.pediatric.maxDailyLimitLabel) {
      lines.push(`• Max Daily Limit: ${result.pediatric.maxDailyLimitLabel}`);
    }
    if (result.pediatric.pediatricNotes) {
      lines.push(`• Note: ${result.pediatric.pediatricNotes}`);
    }
  }
  lines.push('');

  lines.push('2. Adult Dose (বড়দের ডোজ):');
  lines.push(`• Standard: ${result.adult.standardDose} — ${result.adult.frequency}`);
  if (result.adult.maxDailyLimit) lines.push(`• Max Daily Limit: ${result.adult.maxDailyLimit}`);
  result.adult.indicationVariations.forEach((v) => lines.push(`• ${v}`));
  if (result.adult.renalElderlyNote) {
    lines.push(`• Renal/Elderly: ${result.adult.renalElderlyNote}`);
  }
  lines.push('');

  lines.push('3. Duration of Therapy (কতদিন চলবে):');
  lines.push(`• ${result.duration.summary}`);
  result.duration.byIndication.forEach((d) => lines.push(`• ${d}`));
  lines.push('');

  lines.push('4. Administration & Key Notes (খাওয়ার নিয়ম):');
  lines.push(`• Meal: ${result.administration.mealGuidance}`);
  if (result.administration.reconstitutionNote) {
    lines.push(`• Form / PFS Note: ${result.administration.reconstitutionNote}`);
  }
  result.administration.keyTips.forEach((t) => lines.push(`• ${t}`));
  lines.push('');

  lines.push('5. Safety & Renal/Pregnancy Note (সতর্কতা):');
  result.safety.contraindications.forEach((c) => lines.push(`• ${c}`));
  if (result.safety.pregnancyLactation) {
    lines.push(`• Pregnancy/Lactation: ${result.safety.pregnancyLactation}`);
  }
  if (result.safety.renalHepaticCaution) {
    lines.push(`• Renal/Hepatic: ${result.safety.renalHepaticCaution}`);
  }
  lines.push(
    'Disclaimer: For educational & MPO detailing reference only; final dose must be confirmed by a registered physician.'
  );

  return lines.join('\n').trim();
}

// ============================================================================
// SUPER ADMIN SERVER AUTH & PUBLIC CONFIG CLIENT HELPERS
// ============================================================================

export type SuperAdminConfigSource = 'env' | 'claimed' | 'unconfigured' | 'unavailable';

export interface SuperAdminStatusResponse {
  configured: boolean;
  source: SuperAdminConfigSource;
  authenticated: boolean;
  expiresAt: number | null;
}

export async function fetchSuperAdminStatus(
  token?: string | null
): Promise<SuperAdminStatusResponse> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch('/api/super-admin/status', {
      method: 'GET',
      headers,
    });
    const text = await res.text();
    const data = JSON.parse(text) as Partial<SuperAdminStatusResponse> & { ok?: boolean };
    if (!res.ok || !data.ok) {
      return {
        configured: false,
        source: 'unavailable',
        authenticated: false,
        expiresAt: null,
      };
    }
    return {
      configured: Boolean(data.configured),
      source: (data.source as SuperAdminConfigSource) || 'unconfigured',
      authenticated: Boolean(data.authenticated),
      expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
    };
  } catch {
    return {
      configured: false,
      source: 'unavailable',
      authenticated: false,
      expiresAt: null,
    };
  }
}

export async function setupSuperAdminPasscodeOnServer(
  passcode: string
): Promise<{ ok: true; token: string; expiresAt: number; source: 'claimed' } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/super-admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      token?: string;
      expiresAt?: number;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.token) {
      return { ok: false, error: data.error || 'Could not configure Super Admin passcode.' };
    }
    return {
      ok: true,
      token: data.token,
      expiresAt: Number(data.expiresAt) || Date.now() + 12 * 60 * 60 * 1000,
      source: 'claimed',
    };
  } catch {
    return { ok: false, error: 'Unable to reach server. Super Admin setup requires an active connection.' };
  }
}

export async function loginSuperAdminOnServer(
  passcode: string
): Promise<
  | { ok: true; token: string; expiresAt: number; source: 'env' | 'claimed' }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch('/api/super-admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      token?: string;
      expiresAt?: number;
      source?: 'env' | 'claimed';
      error?: string;
    };
    if (!res.ok || !data.ok || !data.token) {
      return { ok: false, error: data.error || 'Invalid Super Admin passcode.' };
    }
    return {
      ok: true,
      token: data.token,
      expiresAt: Number(data.expiresAt) || Date.now() + 12 * 60 * 60 * 1000,
      source: data.source || 'claimed',
    };
  } catch {
    return { ok: false, error: 'Unable to reach server. Check your connection and try again.' };
  }
}

export async function changeSuperAdminPasscodeOnServer(
  token: string,
  currentPasscode: string,
  newPasscode: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/super-admin/change-passcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPasscode, newPasscode }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Could not update Super Admin passcode.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to reach server. Please try again.' };
  }
}

export async function logoutSuperAdminOnServer(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await fetch('/api/super-admin/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Best-effort server logout; client memory token is always cleared
  }
}

export async function fetchPublicConfigFromServer(): Promise<{
  defaultApiUrl: string;
  source: 'env' | 'saved' | 'none';
}> {
  try {
    const res = await fetch('/api/public-config', { method: 'GET' });
    if (!res.ok) return { defaultApiUrl: '', source: 'none' };
    const data = (await res.json()) as {
      ok?: boolean;
      defaultApiUrl?: string;
      source?: 'env' | 'saved' | 'none';
    };
    if (!data.ok) return { defaultApiUrl: '', source: 'none' };
    return {
      defaultApiUrl: String(data.defaultApiUrl ?? '').trim(),
      source: data.source || 'none',
    };
  } catch {
    return { defaultApiUrl: '', source: 'none' };
  }
}

export async function saveServerDefaultApiUrl(
  token: string,
  apiUrl: string
): Promise<{ ok: boolean; defaultApiUrl?: string; error?: string }> {
  try {
    const res = await fetch('/api/super-admin/default-api-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ apiUrl }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      defaultApiUrl?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Could not publish default endpoint URL.' };
    }
    return { ok: true, defaultApiUrl: data.defaultApiUrl };
  } catch {
    return { ok: false, error: 'Unable to reach app server.' };
  }
}





