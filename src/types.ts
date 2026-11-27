export type SheetName =
  | 'Hospitals'
  | 'Doctors'
  | 'Chambers'
  | 'Departments'
  | 'Indications'
  | 'Products'
  | 'Doctor_Product_Detailing'
  | 'Doctor_Visits'
  | 'MPO_Users'
  | 'Areas'
  | 'Daily_Activities';

export type NavTab =
  | 'dashboard'
  | 'products'
  | 'detailing'
  | 'indications'
  | 'specialists'
  | 'dose-calculator'
  | 'knowledge'
  | 'team'
  | 'settings';

export interface TeamSession {
  loginMode: 'firebase' | 'area' | 'mpo';
  uid?: string;
  email?: string;
  phone?: string;
  areaId: string;
  areaName: string;
  joinCode?: string;
  district: string;
  upazila?: string;
  zone: string;
  mpoId?: string;
  mpoName?: string;
  role?: string;
  employeeCode?: string;
  canSwitchAreas?: boolean;
  loggedInAt: string;
}

export interface FirebaseUserProfile {
  uid: string;
  email: string;
  emailLower?: string;
  officerName: string;
  role: string;
  employeeCode?: string;
  phone?: string;
  phoneNormalized?: string;
  areaId: string;
  areaName: string;
  joinCode?: string;
  district: string;
  upazila: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvite {
  inviteId: string;
  toUid: string;
  toEmail: string;
  toPhone?: string;
  toName?: string;
  fromUid: string;
  fromName: string;
  areaId: string;
  areaName: string;
  district?: string;
  upazila?: string;
  joinCode: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface OfficerSearchResult {
  uid: string;
  officerName: string;
  email: string;
  phone?: string;
  role?: string;
  areaId: string;
  areaName: string;
  district?: string;
}

export interface AreaNote {
  Note_ID: string;
  Area_ID: string;
  Title: string;
  Content: string;
  Category?: string;
  Pinned?: boolean;
  Author_Name?: string;
  Author_UID?: string;
  Created_At: string;
  Updated_At: string;
}

export interface Area {
  Area_ID: string;
  Area_Name: string;
  Zone: string;
  Territory?: string;
  District: string;
  Assigned_MPO_ID?: string;
  Team_PIN?: string;
  Status?: string;
}

export interface Department {
  Department_ID: string;
  Department_Name: string;
  Preferred_Generics?: string;
  Clinical_Indications?: string;
  Status?: string;
}

export interface Indication {
  Indication_ID: string;
  Indication_Name: string;
  Category: string;
  Relevant_Specialists: string;
  Key_Generics: string;
  Description_BN?: string;
  Video_URL?: string;
  YouTube_URL?: string;
  Status?: string;
  Created_At?: string;
  Updated_At?: string;
  Created_By?: string;
}

export interface DiseaseGuideBN {
  indicationKey: string;
  indicationName: string;
  titleBn: string;
  overview: string;
  causesAndRiskFactors: string[];
  keySymptoms: string[];
  managementAndPrevention: string[];
  specialistWarning?: string;
  mpoDetailingFocus: string[];
  rawSheetText?: string;
  source: 'sheet' | 'ai' | 'local' | 'knowledge';
  generatedAt: string;
}

export type DosePatientMode = 'pediatric' | 'adult' | 'both';

export interface ParsedLiquidStrength {
  isLiquid: boolean;
  mgPerMl: number | null;
  numeratorMg: number | null;
  denominatorMl: number | null;
  unitLabel: string;
  isDrops: boolean;
  isCombinationNote?: string;
}

export interface ComputedPediatricDose {
  weightKg: number;
  dailyMinMg: number;
  dailyMaxMg: number;
  singleMinMg: number;
  singleMaxMg: number;
  dosesPerDay: number;
  wasDailyCapApplied: boolean;
  wasSingleCapApplied: boolean;
  singleMinMl?: number | null;
  singleMaxMl?: number | null;
  teaspoonLabel?: string | null;
  dropsLabel?: string | null;
}

export interface DoseCalculationResult {
  cacheKey: string;
  genericName: string;
  brandName?: string;
  strength?: string;
  dosageForm?: string;
  indication?: string;
  therapeuticClass?: string;
  pediatric: {
    applicable: boolean;
    contraindicationBadge?: string;
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
    reconstitutionNote?: string;
    keyTips: string[];
  };
  safety: {
    contraindications: string[];
    pregnancyLactation: string;
    renalHepaticCaution: string;
  };
  source?: 'ai' | 'catalog-fallback';
  sourceLabel?: string;
  fallbackReason?: string;
  generatedAt: string;
}

export interface Hospital {
  Hospital_ID: string;
  Hospital_Name: string;
  Area_ID: string;
  Hospital_Type?: string;
  Address?: string;
  Phone?: string;
  Status?: string;
}

export type DoctorType = 'Regular' | 'Guest';

export const BANGLADESH_MEDICAL_DEGREES = [
  'MBBS',
  'MBBS, FCPS',
  'MBBS, MD',
  'MBBS, MS',
  'MBBS, BCS (Health)',
  'MBBS, CCD (BIRDEM)',
  'MBBS, DGO',
  'MBBS, DCH',
  'MBBS, DLO',
  'MBBS, DO',
  'MBBS, DDV',
  'MBBS, DTCD',
  'MBBS, D-Card',
  'MBBS, D-Ortho',
  'MBBS, M.Phil',
  'BDS',
  'BDS, FCPS',
] as const;

export const VISITING_DAYS_LIST = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

export interface Doctor {
  Doctor_ID: string;
  Doctor_Name: string;
  Degree: string;
  Specialty: string;
  Department_ID: string;
  Primary_Hospital_ID: string;
  Area_ID: string;
  Phone?: string;
  Email?: string;
  Category?: string;
  Doctor_Type?: DoctorType | string;
  Visiting_Days?: string;
  Visiting_Hours?: string;
  Remarks?: string;
  Status?: string;
}

export interface Chamber {
  Chamber_ID: string;
  Doctor_ID: string;
  Chamber_Name: string;
  Address: string;
  Area_ID: string;
  Visiting_Days: string;
  Visiting_Hours: string;
  Assistant_Phone?: string;
  Status?: string;
}

export const MEDICAL_SPECIALTIES = [
  'Internal Medicine',
  'Pediatrics',
  'Cardiology',
  'Neurology',
  'Gastroenterology',
  'Endocrinology & Diabetology',
  'Pulmonology / Chest',
  'Nephrology',
  'Gynecology & Obstetrics',
  'ENT',
  'Ophthalmology',
  'Dermatology',
  'Orthopedics',
  'General Surgery',
  'Urology',
  'Psychiatry',
  'Oncology',
  'Rheumatology',
  'Dental',
  'General Physician (GP)',
] as const;

export type ProductGroupCode =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O';

export const PRODUCT_GROUP_CODES: readonly ProductGroupCode[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
] as const;

export const PRODUCT_GROUP_OPTIONS = [
  'None',
  'Group A',
  'Group B',
  'Group C',
  'Group D',
  'Group E',
  'Group F',
  'Group G',
  'Group H',
  'Group I',
  'Group J',
  'Group K',
  'Group L',
  'Group M',
  'Group N',
  'Group O',
] as const;

export interface Product {
  Product_ID: string;
  Product_Name: string;
  Brand_Name?: string;
  Generic_Name: string;
  Strength: string;
  Dosage_Form: string;
  Therapeutic_Class: string;
  Pack_Size?: string;
  Approved_Indications?: string;
  Single_Price?: number | string;
  Box_Price?: number | string;
  MRP_BDT?: number | string;
  Product_Group?: string;
  Video_URL?: string;
  YouTube_URL?: string;
  Status?: string;
}

export interface DoctorProductDetailing {
  Detailing_ID: string;
  Product_ID: string;
  Generic_Name?: string;
  Specialist: string;
  Detailing_BN: string;
  Detailing_EN: string;
  Status?: string;
  // Optional legacy fields retained strictly for backward-compatible reading of older rows
  Doctor_ID?: string;
  MPO_ID?: string;
  Detailing_Date?: string;
  Response_Level?: string;
  Samples_Given?: number;
  Literature_Shared?: string;
  Remarks?: string;
}

export interface DoctorVisit {
  Visit_ID: string;
  Doctor_ID: string;
  Primary_Hospital_ID: string;
  MPO_ID: string;
  Visit_Date: string;
  Visit_Time: string;
  Products_Discussed: string;
  Discussion_Summary: string;
  Next_Follow_Up: string;
  Visit_Type?: string;
}

export interface MPOUser {
  MPO_ID: string;
  MPO_Name: string;
  Role?: string;
  Employee_ID?: string;
  Employee_Code?: string;
  Territory?: string;
  Area?: string;
  Designation?: string;
  Area_ID?: string;
  Phone_Number?: string;
  Phone?: string;
  Email?: string;
  PIN?: string;
  Monthly_Visit_Target?: number;
  Status?: string;
}

export type ActivityStatus = 'Completed' | 'In Progress' | 'Planned';

export interface DailyActivity {
  Activity_ID: string;
  MPO_ID: string;
  Activity_Date: string;
  Activity_Time: string;
  Area_ID: string;
  Activity_Type: string;
  Location: string;
  Doctors_Met: number;
  Summary: string;
  Outcome?: string;
  Status?: ActivityStatus | string;
}

export interface KnowledgeChapter {
  Chapter_No: string;
  Title_BN: string;
  Category: string;
  Read_Time: string;
  Short_Summary_BN: string;
  Full_Content_BN: string;
  Key_Takeaway_BN: string;
  Video_URL?: string;
  YouTube_URL?: string;
  Status?: string;
}

export interface FieldDataset {
  Hospitals: Hospital[];
  Doctors: Doctor[];
  Chambers: Chamber[];
  Departments: Department[];
  Indications: Indication[];
  Products: Product[];
  Doctor_Product_Detailing: DoctorProductDetailing[];
  Doctor_Visits: DoctorVisit[];
  MPO_Users: MPOUser[];
  Areas: Area[];
  Daily_Activities: DailyActivity[];
  MPO_Desk: KnowledgeChapter[];
  Medical_Knowledge: KnowledgeChapter[];
}

export interface ApiGetResponse {
  status: 'success' | 'error';
  data?: Partial<FieldDataset>;
  message?: string;
}

export interface ApiPostPayload<T = Record<string, unknown>> {
  action: 'add' | 'update' | 'delete';
  sheet: SheetName;
  data: T;
}

export interface QueuedMutation {
  queueId: string;
  createdAt: string;
  action: 'add' | 'update' | 'delete';
  sheet: SheetName;
  data: Record<string, unknown>;
  lastError?: string;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}
