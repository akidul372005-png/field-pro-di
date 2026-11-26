import { DoseCalculationResult, ParsedLiquidStrength } from '../types';
import {
  buildDoseCacheKey,
  isLiquidDosageForm,
  parseCommaList,
  parseLiquidStrength,
} from './api';

export interface DoseFallbackInput {
  genericName: string;
  brandName?: string;
  strength?: string;
  dosageForm?: string;
  therapeuticClass?: string;
  approvedIndications?: string;
  indication?: string;
  weightKg?: number | null;
  ageText?: string;
  renalElderlyCaution?: boolean;
  fallbackReason?: string;
}

interface BuiltinGenericRule {
  keywords: string[];
  excludeKeywords?: string[];
  therapeuticClass: string;
  pediatric: DoseCalculationResult['pediatric'];
  adult: DoseCalculationResult['adult'];
  duration: DoseCalculationResult['duration'];
  administration: DoseCalculationResult['administration'];
  safety: DoseCalculationResult['safety'];
}

export const STANDARD_CATALOG_REFERENCE_LABEL = 'Standard Catalog Reference Dose';

const BUILTIN_GENERIC_RULES: BuiltinGenericRule[] = [
  {
    keywords: ['cefixime'],
    therapeuticClass: '3rd Generation Oral Cephalosporin',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 8,
      mgPerKgPerDayMax: 8,
      standardRangeLabel: '8 mg/kg/day (OD or divided BD every 12h)',
      dosesPerDay: 2,
      frequencyLabel: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর) or OD',
      maxDailyDoseMg: 400,
      maxSingleDoseMg: 200,
      maxDailyLimitLabel: 'Max 400 mg/day',
      pediatricNotes:
        'For children ≥6 months. In enteric/typhoid fever, clinicians may use up to 15–20 mg/kg/day divided BD under physician guidance.',
    },
    adult: {
      standardDose: '200–400 mg',
      frequency: 'OD or 200 mg BD (প্রতি ১২–২৪ ঘণ্টা পরপর)',
      maxDailyLimit: '400 mg/day',
      indicationVariations: [
        'URTI / Pharyngitis / Uncomplicated UTI: 200 mg BD or 400 mg OD',
        'Enteric / Typhoid Fever: 200 mg BD (up to 400 mg/day) for 7–14 days',
        'Acute Bronchitis / LRTI: 200 mg BD or 400 mg OD',
      ],
      renalElderlyNote:
        'Reduce dose in severe renal impairment (CrCl <20 mL/min: 200 mg once daily). No routine reduction in elderly with normal renal function.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন; টাইফয়েডে ৭–১৪ দিন)',
      byIndication: [
        'URTI / Tonsillitis / Otitis Media: 5–7 days',
        'Uncomplicated UTI: 5–7 days',
        'Typhoid / Enteric Fever: 7–14 days (complete full course)',
      ],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে নেওয়া যাবে)',
      reconstitutionNote:
        'PFS Suspension: Reconstitute with boiled & cooled water up to the bottle mark, shake well before each dose, and discard unused suspension after 14 days.',
      keyTips: [
        'Shake suspension thoroughly before every measurement.',
        'Complete the full prescribed antibiotic course even if fever resolves early.',
      ],
    },
    safety: {
      contraindications: [
        'Known hypersensitivity to cephalosporins or severe beta-lactam allergy',
      ],
      pregnancyLactation:
        'Generally considered low risk in pregnancy (Category B) when clinically indicated; caution during breastfeeding.',
      renalHepaticCaution:
        'Adjust dosing interval/dose if CrCl <20 mL/min; monitor in severe renal impairment.',
    },
  },
  {
    keywords: ['amoxicillin', 'clavulanic'],
    therapeuticClass: 'Beta-Lactam / Beta-Lactamase Inhibitor (Co-amoxiclav)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 25,
      mgPerKgPerDayMax: 45,
      standardRangeLabel: '25–45 mg/kg/day (based on Amoxicillin component)',
      dosesPerDay: 2,
      frequencyLabel: 'BD or TDS (প্রতি ৮–১২ ঘণ্টা পরপর)',
      maxDailyDoseMg: 1500,
      maxSingleDoseMg: 500,
      maxDailyLimitLabel: 'Max 1500 mg Amoxicillin/day (standard)',
      pediatricNotes:
        'Calculated strictly on the Amoxicillin component (e.g., 125 mg/5 mL or 400 mg/5 mL). High-dose otitis media/CAP regimens may require up to 80–90 mg/kg/day.',
    },
    adult: {
      standardDose: '625 mg (500/125 mg) or 1 g (875/125 mg)',
      frequency: 'TDS for 625 mg or BD for 1 g (প্রতি ৮–১২ ঘণ্টা পরপর)',
      maxDailyLimit: '1875–2000 mg/day (max 375 mg clavulanic acid/day)',
      indicationVariations: [
        'Mild–Moderate URTI / Dental / SSTI: 625 mg TDS',
        'Severe LRTI / CAP / Sinusitis: 1 g (875/125 mg) BD',
        'Uncomplicated UTI: 625 mg BD–TDS',
      ],
      renalElderlyNote:
        'Avoid 875/125 mg strength if CrCl <30 mL/min. Extend dosing interval in moderate-to-severe renal impairment.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন; ১৪ দিনের বেশি রিভিউ ছাড়া নয়)',
      byIndication: [
        'URTI / Dental Infection / SSTI: 5–7 days',
        'Acute Otitis Media / Sinusitis / CAP: 7–10 days',
      ],
    },
    administration: {
      mealGuidance:
        'Take at the start of a meal (খাবার শুরুর সময় খেলে গ্যাস্ট্রিক অস্বস্তি কম হয়)',
      reconstitutionNote:
        'PFS Suspension: Reconstitute with boiled & cooled water, refrigerate (2–8°C), shake well before use, and discard after 7 days.',
      keyTips: [
        'Taking with food improves clavulanate tolerance and minimizes GI upset.',
        'Do not substitute two 375 mg tablets for one 625 mg tablet (clavulanate ratio differs).',
      ],
    },
    safety: {
      contraindications: [
        'Penicillin / beta-lactam hypersensitivity',
        'History of Co-amoxiclav-associated cholestatic jaundice or hepatic dysfunction',
      ],
      pregnancyLactation:
        'Generally considered compatible when clinically necessary; monitor breastfed infant for loose stools.',
      renalHepaticCaution:
        'Dose adjustment required when CrCl <30 mL/min; monitor liver function in hepatic impairment.',
    },
  },
  {
    keywords: ['amoxicillin'],
    excludeKeywords: ['clavulanic', 'clavulanate'],
    therapeuticClass: 'Broad-Spectrum Penicillin Antibiotic',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 25,
      mgPerKgPerDayMax: 45,
      standardRangeLabel: '25–45 mg/kg/day in 2–3 divided doses',
      dosesPerDay: 3,
      frequencyLabel: 'TDS — every 8 hours (প্রতি ৮ ঘণ্টা পরপর)',
      maxDailyDoseMg: 1500,
      maxSingleDoseMg: 500,
      maxDailyLimitLabel: 'Max 1500 mg/day (standard)',
      pediatricNotes:
        'High-dose therapy (80–90 mg/kg/day in 2 divided doses) may be prescribed for acute otitis media or community-acquired pneumonia.',
    },
    adult: {
      standardDose: '500 mg',
      frequency: 'TDS — every 8 hours (প্রতি ৮ ঘণ্টা পরপর)',
      maxDailyLimit: '3000 mg/day',
      indicationVariations: [
        'Mild–Moderate URTI / Dental / UTI: 250–500 mg TDS',
        'Severe LRTI / CAP: 500 mg–1 g TDS',
        'H. pylori Eradication (triple therapy): 1 g BD',
      ],
      renalElderlyNote:
        'Extend interval to every 12–24 hours if CrCl <30 mL/min.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন)',
      byIndication: [
        'URTI / Dental Infection: 5–7 days',
        'Streptococcal Pharyngitis / CAP: 7–10 days',
      ],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে নেওয়া যাবে)',
      reconstitutionNote:
        'Dry Syrup / PFS: Reconstitute with boiled & cooled water, shake well before each dose, and discard unused portion after 7–14 days.',
      keyTips: [
        'Maintain even 8-hour intervals for steady antibacterial coverage.',
        'Complete the full prescribed duration.',
      ],
    },
    safety: {
      contraindications: ['History of penicillin or severe beta-lactam allergy'],
      pregnancyLactation: 'Widely considered safe in pregnancy and lactation when indicated.',
      renalHepaticCaution: 'Reduce frequency in moderate-to-severe renal impairment (CrCl <30 mL/min).',
    },
  },
  {
    keywords: ['azithromycin'],
    therapeuticClass: 'Macrolide Antibiotic',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 10,
      mgPerKgPerDayMax: 10,
      standardRangeLabel: '10 mg/kg/day once daily (OD)',
      dosesPerDay: 1,
      frequencyLabel: 'OD — once daily (দিনে ১ বার)',
      maxDailyDoseMg: 500,
      maxSingleDoseMg: 500,
      maxDailyLimitLabel: 'Max 500 mg/day',
      pediatricNotes:
        'For children ≥6 months. Typical course is 10 mg/kg OD for 3 days (or 10 mg/kg Day 1 then 5 mg/kg Days 2–5). Enteric fever may use 10–20 mg/kg/day.',
    },
    adult: {
      standardDose: '500 mg',
      frequency: 'OD — once daily (দিনে ১ বার)',
      maxDailyLimit: '500 mg/day (1 g single dose for specific STI)',
      indicationVariations: [
        'URTI / Bronchitis / CAP: 500 mg OD for 3–5 days',
        'Enteric / Typhoid Fever: 500 mg–1 g OD for 5–7 days',
        'Skin & Soft Tissue Infection: 500 mg Day 1, then 250 mg OD Days 2–5',
      ],
      renalElderlyNote:
        'No routine adjustment in mild-to-moderate renal impairment; use caution in severe renal (GFR <10) or hepatic impairment and elderly with QT-prolongation risk.',
    },
    duration: {
      summary: '3–5 days (সাধারণত ৩–৫ দিন; টাইফয়েডে ৫–৭ দিন)',
      byIndication: [
        'URTI / LRTI / Acute Bronchitis: 3 days (500 mg OD) or 5 days',
        'Enteric Fever: 5–7 days',
      ],
    },
    administration: {
      mealGuidance:
        'Tablets/suspension with or without food; capsules 1h before or 2h after meal (খাবারের আগে বা পরে; অ্যান্টাসিডের সাথে নয়)',
      reconstitutionNote:
        'PFS Suspension: Reconstitute with supplied/boiled cooled water, shake well before each dose, and use within 5–10 days.',
      keyTips: [
        'Separate from aluminum/magnesium antacids by at least 2 hours.',
        'Once-daily dosing improves patient compliance.',
      ],
    },
    safety: {
      contraindications: [
        'Hypersensitivity to azithromycin or other macrolides',
        'History of cholestatic jaundice/hepatic dysfunction with prior azithromycin use',
      ],
      pregnancyLactation:
        'Generally considered compatible in pregnancy and breastfeeding when clearly indicated.',
      renalHepaticCaution:
        'Caution in significant hepatic disease and patients at risk of QT prolongation.',
    },
  },
  {
    keywords: ['cefuroxime'],
    therapeuticClass: '2nd Generation Cephalosporin',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 20,
      mgPerKgPerDayMax: 30,
      standardRangeLabel: '20–30 mg/kg/day in 2 divided doses',
      dosesPerDay: 2,
      frequencyLabel: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
      maxDailyDoseMg: 500,
      maxSingleDoseMg: 250,
      maxDailyLimitLabel: 'Max 500 mg/day (up to 1000 mg in severe otitis/CAP)',
      pediatricNotes:
        'For children ≥3 months. Always administer oral cefuroxime axetil after food to maximize absorption and mask bitter taste.',
    },
    adult: {
      standardDose: '250–500 mg',
      frequency: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
      maxDailyLimit: '1000 mg/day (oral)',
      indicationVariations: [
        'URTI / Pharyngitis / Uncomplicated UTI: 250 mg BD',
        'CAP / Acute Bronchitis / SSTI / Severe Sinusitis: 500 mg BD',
      ],
      renalElderlyNote:
        'Reduce frequency to OD if CrCl <20 mL/min; monitor renal function in elderly patients.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন)',
      byIndication: [
        'URTI / Uncomplicated UTI: 5–7 days',
        'CAP / Otitis Media / Sinusitis: 7–10 days',
      ],
    },
    administration: {
      mealGuidance:
        'Must take AFTER meal for optimal absorption (খাবার পর খেলে শোষণ সবচেয়ে ভালো হয়)',
      reconstitutionNote:
        'PFS Suspension: Reconstitute with boiled & cooled water, refrigerate (2–8°C), shake well, and discard after 10 days.',
      keyTips: [
        'Do not crush tablets (very bitter taste); use suspension for children.',
        'Always take after food.',
      ],
    },
    safety: {
      contraindications: ['Known hypersensitivity to cephalosporins'],
      pregnancyLactation:
        'Generally considered safe in pregnancy when indicated; excreted in low amounts in breast milk.',
      renalHepaticCaution: 'Dose interval adjustment required in severe renal impairment (CrCl <20 mL/min).',
    },
  },
  {
    keywords: ['cefpodoxime'],
    therapeuticClass: '3rd Generation Oral Cephalosporin',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 8,
      mgPerKgPerDayMax: 10,
      standardRangeLabel: '8–10 mg/kg/day in 2 divided doses',
      dosesPerDay: 2,
      frequencyLabel: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
      maxDailyDoseMg: 400,
      maxSingleDoseMg: 200,
      maxDailyLimitLabel: 'Max 400 mg/day',
      pediatricNotes:
        'For children ≥2 months. Give with food for optimal oral bioavailability.',
    },
    adult: {
      standardDose: '100–200 mg',
      frequency: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
      maxDailyLimit: '400 mg/day',
      indicationVariations: [
        'Pharyngitis / Uncomplicated UTI: 100 mg BD',
        'CAP / Acute Sinusitis / SSTI: 200 mg BD',
      ],
      renalElderlyNote: 'Extend interval to every 24 hours if CrCl <30 mL/min.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন)',
      byIndication: ['URTI / UTI: 5–7 days', 'CAP / Sinusitis / SSTI: 7–10 days'],
    },
    administration: {
      mealGuidance: 'Take WITH food (খাবারের সাথে বা খাবার পর নেওয়া উত্তম)',
      reconstitutionNote:
        'PFS Suspension: Reconstitute with boiled & cooled water, refrigerate, shake well, and discard after 14 days.',
      keyTips: ['Separate from antacids or H2-blockers/PPIs by at least 2 hours.'],
    },
    safety: {
      contraindications: ['Known hypersensitivity to cephalosporins'],
      pregnancyLactation: 'Use if clinically indicated; low excretion in breast milk.',
      renalHepaticCaution: 'Extend dosing interval if CrCl <30 mL/min.',
    },
  },
  {
    keywords: ['cephradine', 'cefradine', 'cephalexin', 'cefalexin'],
    therapeuticClass: '1st Generation Cephalosporin',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 25,
      mgPerKgPerDayMax: 50,
      standardRangeLabel: '25–50 mg/kg/day in 2–4 divided doses',
      dosesPerDay: 3,
      frequencyLabel: 'TDS or QID (প্রতি ৬–৮ ঘণ্টা পরপর)',
      maxDailyDoseMg: 2000,
      maxSingleDoseMg: 500,
      maxDailyLimitLabel: 'Max 2000 mg/day (severe up to 4000 mg)',
      pediatricNotes:
        'Commonly used for pediatric SSTI, pharyngitis, and uncomplicated UTI.',
    },
    adult: {
      standardDose: '500 mg',
      frequency: 'BD to QID — every 6–12 hours (প্রতি ৬–১২ ঘণ্টা পরপর)',
      maxDailyLimit: '4000 mg/day',
      indicationVariations: [
        'Mild–Moderate URTI / SSTI / UTI: 500 mg BD or TDS',
        'Severe Infection: 500 mg QID or 1 g BD',
      ],
      renalElderlyNote: 'Reduce dose or extend interval when CrCl <50 mL/min.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন)',
      byIndication: ['SSTI / UTI: 5–7 days', 'Streptococcal Pharyngitis: 10 days'],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে নেওয়া যাবে)',
      reconstitutionNote:
        'Dry Syrup / PFS: Reconstitute with boiled & cooled water, shake well before each dose, and discard after 7–14 days.',
      keyTips: ['Complete full antibiotic course to prevent relapse.'],
    },
    safety: {
      contraindications: ['Hypersensitivity to cephalosporins'],
      pregnancyLactation: 'Generally considered compatible in pregnancy and breastfeeding.',
      renalHepaticCaution: 'Adjust dose in moderate-to-severe renal impairment.',
    },
  },
  {
    keywords: ['flucloxacillin'],
    therapeuticClass: 'Penicillinase-Resistant Penicillin',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 25,
      mgPerKgPerDayMax: 50,
      standardRangeLabel: '25–50 mg/kg/day in 4 divided doses',
      dosesPerDay: 4,
      frequencyLabel: 'QID — every 6 hours (প্রতি ৬ ঘণ্টা পরপর)',
      maxDailyDoseMg: 2000,
      maxSingleDoseMg: 500,
      maxDailyLimitLabel: 'Max 2000 mg/day',
      pediatricNotes: 'First-line oral anti-staphylococcal agent for pediatric skin/soft tissue infections.',
    },
    adult: {
      standardDose: '500 mg',
      frequency: 'QID — every 6 hours (প্রতি ৬ ঘণ্টা পরপর)',
      maxDailyLimit: '4000 mg/day',
      indicationVariations: [
        'Skin & Soft Tissue / Cellulitis / Impetigo: 500 mg QID',
        'Osteomyelitis / Severe Staphylococcal Infection: Up to 1 g QID (under specialist care)',
      ],
      renalElderlyNote: 'Reduce dose if CrCl <10 mL/min; monitor liver enzymes in elderly (>50 yrs) on prolonged courses.',
    },
    duration: {
      summary: '5–7 days (সাধারণত ৫–৭ দিন; সেলুলাইটিসে ৭–১০ দিন)',
      byIndication: ['SSTI / Wound Infection: 5–7 days', 'Severe Soft Tissue Infection: 7–10 days'],
    },
    administration: {
      mealGuidance: 'Take on an EMPTY stomach — 1 hour before or 2 hours after meals (খালি পেটে — খাবার ১ ঘণ্টা আগে বা ২ ঘণ্টা পরে)',
      reconstitutionNote: 'Dry Syrup: Reconstitute with boiled & cooled water, store in refrigerator, and discard after 7 days.',
      keyTips: ['Food significantly reduces oral absorption; empty stomach is essential.'],
    },
    safety: {
      contraindications: ['Penicillin allergy', 'History of flucloxacillin-associated jaundice/hepatitis'],
      pregnancyLactation: 'Generally compatible in pregnancy and lactation when clinically needed.',
      renalHepaticCaution: 'Caution in hepatic impairment and elderly patients; rare cholestatic hepatitis risk.',
    },
  },
  {
    keywords: ['linezolid'],
    therapeuticClass: 'Oxazolidinone Antibiotic (MRSA / VRE)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 30,
      mgPerKgPerDayMax: 30,
      standardRangeLabel: '10 mg/kg every 8 hours (30 mg/kg/day) for <12 yrs; 600 mg BD for ≥12 yrs',
      dosesPerDay: 3,
      frequencyLabel: 'TDS — every 8 hours (<12 yrs) / BD (≥12 yrs)',
      maxDailyDoseMg: 1200,
      maxSingleDoseMg: 600,
      maxDailyLimitLabel: 'Max 1200 mg/day (600 mg/dose)',
      pediatricNotes:
        'Reserved for confirmed or suspected resistant Gram-positive (MRSA/VRE) infections under specialist supervision.',
    },
    adult: {
      standardDose: '600 mg',
      frequency: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
      maxDailyLimit: '1200 mg/day',
      indicationVariations: [
        'Complicated SSTI / MRSA Pneumonia: 600 mg BD (oral or IV)',
        'Uncomplicated SSTI (selected cases): 400 mg BD',
      ],
      renalElderlyNote:
        'No routine renal dose adjustment required; monitor CBC weekly for thrombocytopenia, especially in elderly or renal impairment.',
    },
    duration: {
      summary: '10–14 days (সাধারণত ১০–১৪ দিন; সর্বোচ্চ ২৮ দিন)',
      byIndication: ['MRSA Pneumonia / Complicated SSTI: 10–14 days', 'VRE Infection: 14–28 days with weekly CBC'],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে নেওয়া যাবে)',
      reconstitutionNote: '100% oral bioavailability allows seamless IV-to-oral switch; avoid tyramine-rich foods.',
      keyTips: [
        'Monitor weekly CBC if therapy exceeds 10–14 days.',
        'Avoid serotonergic drugs (SSRIs/SNRIs) due to serotonin syndrome risk.',
      ],
    },
    safety: {
      contraindications: [
        'Concurrent MAO inhibitors (or within 14 days)',
        'Uncontrolled hypertension / concurrent serotonergic agents without monitoring',
      ],
      pregnancyLactation: 'Use only if potential benefit clearly outweighs risk; avoid breastfeeding during therapy.',
      renalHepaticCaution: 'Monitor blood counts closely in severe renal or hepatic impairment.',
    },
  },
  {
    keywords: ['ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
    therapeuticClass: 'Fluoroquinolone Antibiotic',
    pediatric: {
      applicable: false,
      contraindicationBadge:
        'Not Routinely Recommended in Children <18 yrs (শিশুদের ক্ষেত্রে সাধারণত নিষিদ্ধ / বিশেষজ্ঞের পরামর্শ ছাড়া নয়)',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Avoid in children unless no safe alternative (specialist only)',
      dosesPerDay: 2,
      frequencyLabel: 'Specialist-restricted only',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not routinely indicated in pediatrics',
      pediatricNotes:
        'Risk of arthropathy/cartilage toxicity in growing joints; reserved strictly for specific specialist indications when no alternative exists.',
    },
    adult: {
      standardDose: '500 mg (Ciprofloxacin/Levofloxacin) or 400 mg (Moxifloxacin)',
      frequency: 'BD for Ciprofloxacin; OD for Levofloxacin/Moxifloxacin',
      maxDailyLimit: '1500 mg/day (Ciprofloxacin) · 750 mg/day (Levofloxacin) · 400 mg/day (Moxifloxacin)',
      indicationVariations: [
        'UTI / GI Infection: Ciprofloxacin 500 mg BD or Levofloxacin 500 mg OD',
        'CAP / Respiratory Infection: Levofloxacin 500–750 mg OD or Moxifloxacin 400 mg OD',
      ],
      renalElderlyNote:
        'Reduce dose in CrCl <50 mL/min (except Moxifloxacin). Higher risk of tendinitis/tendon rupture and CNS effects in elderly.',
    },
    duration: {
      summary: '5–10 days (সাধারণত ৫–১০ দিন)',
      byIndication: ['Uncomplicated UTI / Acute Diarrhea: 3–5 days', 'CAP / Complicated UTI: 7–10 days'],
    },
    administration: {
      mealGuidance: 'Take with plenty of water; separate from dairy, calcium, iron, zinc & antacids by 2–4 hours',
      reconstitutionNote: 'Maintain adequate hydration during therapy to prevent crystalluria.',
      keyTips: [
        'Do not take simultaneously with antacids, iron, zinc, or calcium supplements.',
        'Discontinue immediately if tendon pain or swelling occurs.',
      ],
    },
    safety: {
      contraindications: [
        'History of fluoroquinolone-associated tendinitis or tendon rupture',
        'Pregnancy, lactation, and routine pediatric use (<18 years)',
      ],
      pregnancyLactation: 'Avoid during pregnancy and breastfeeding.',
      renalHepaticCaution: 'Adjust dose in renal impairment (CrCl <50 mL/min); monitor for QT prolongation.',
    },
  },
  {
    keywords: ['metronidazole'],
    therapeuticClass: 'Nitroimidazole Antimicrobial / Antiprotozoal',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 20,
      mgPerKgPerDayMax: 30,
      standardRangeLabel: '20–30 mg/kg/day in 3 divided doses (amoebiasis: 35–50 mg/kg/day)',
      dosesPerDay: 3,
      frequencyLabel: 'TDS — every 8 hours (প্রতি ৮ ঘণ্টা পরপর)',
      maxDailyDoseMg: 1200,
      maxSingleDoseMg: 400,
      maxDailyLimitLabel: 'Max 1200 mg/day (standard)',
      pediatricNotes: 'For giardiasis typically 15 mg/kg/day TDS for 5–7 days; for amoebic dysentery 35–50 mg/kg/day TDS.',
    },
    adult: {
      standardDose: '400 mg',
      frequency: 'TDS — every 8 hours (প্রতি ৮ ঘণ্টা পরপর)',
      maxDailyLimit: '2400 mg/day',
      indicationVariations: [
        'Anaerobic / Dental Infection / Bacterial Vaginosis: 400 mg TDS for 5–7 days',
        'Amoebic Dysentery: 400–800 mg TDS for 5–10 days',
        'Giardiasis: 400 mg TDS for 5 days (or 2 g OD for 3 days)',
      ],
      renalElderlyNote: 'Reduce dose by 50% in severe hepatic impairment; generally no adjustment in mild renal impairment.',
    },
    duration: {
      summary: '5–7 days (সাধারণত ৫–৭ দিন; অ্যামিবায়াসিসে ৫–১০ দিন)',
      byIndication: ['Giardiasis / Anaerobic / Dental: 5–7 days', 'Amoebiasis: 5–10 days'],
    },
    administration: {
      mealGuidance: 'Take AFTER meal with a full glass of water (খাবার পর খেলে বমি ভাব ও ধাতব স্বাদ কম হয়)',
      reconstitutionNote: 'Suspension: Shake well before each dose; use measuring cup/syringe.',
      keyTips: ['Strictly avoid alcohol during therapy and for 48 hours after completion.'],
    },
    safety: {
      contraindications: ['Hypersensitivity to nitroimidazoles', 'First trimester of pregnancy (avoid high doses)'],
      pregnancyLactation: 'Avoid high-dose regimens in 1st trimester; caution during lactation.',
      renalHepaticCaution: 'Reduce dose in severe hepatic dysfunction due to delayed clearance.',
    },
  },
  {
    keywords: ['paracetamol', 'acetaminophen'],
    therapeuticClass: 'Analgesic & Antipyretic',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 40,
      mgPerKgPerDayMax: 60,
      standardRangeLabel: '10–15 mg/kg/dose every 4–6h (40–60 mg/kg/day)',
      dosesPerDay: 4,
      frequencyLabel: 'Every 6 hours PRN — max 4 doses/day (প্রতি ৬ ঘণ্টা পরপর, সর্বোচ্চ ৪ বার)',
      maxDailyDoseMg: 2000,
      maxSingleDoseMg: 500,
      maxDailyLimitLabel: 'Max 60 mg/kg/day (not exceeding 4000 mg/day in adults)',
      pediatricNotes:
        'Safe first-line antipyretic/analgesic in children. Always verify dropper/syrup concentration (80 mg/mL drops vs 120 mg/5 mL or 250 mg/5 mL suspension).',
    },
    adult: {
      standardDose: '500–1000 mg',
      frequency: 'Every 4–6 hours PRN (প্রয়োজনে প্রতি ৬ ঘণ্টা পরপর, সর্বোচ্চ ৪ বার)',
      maxDailyLimit: '4000 mg/day (max 2000–3000 mg/day in elderly/liver risk)',
      indicationVariations: [
        'Fever / Mild-to-Moderate Pain / Headache: 500 mg–1 g every 6 hours',
        'Osteoarthritis (extended release 665 mg): 2 tablets TDS (max 4 g/day)',
      ],
      renalElderlyNote:
        'Preferred analgesic in renal impairment. Limit daily dose to ≤2–3 g/day in frail elderly, low body weight (<50 kg), or chronic liver disease.',
    },
    duration: {
      summary: '3–5 days PRN (জ্বর/ব্যথা থাকলে সাধারণত ৩–৫ দিন)',
      byIndication: ['Acute Fever / Viral Illness: 2–5 days PRN', 'If fever persists >3 days, physician review is needed'],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে নেওয়া যাবে)',
      reconstitutionNote: 'Syrup/Suspension/Drops: Shake well before each use; measure carefully in mL.',
      keyTips: ['Check other cold/flu medicines to avoid duplicate paracetamol intake.'],
    },
    safety: {
      contraindications: ['Severe hepatic failure or acute liver injury', 'Hypersensitivity to paracetamol'],
      pregnancyLactation: 'First-line analgesic/antipyretic in pregnancy and breastfeeding at lowest effective dose.',
      renalHepaticCaution: 'Reduce max daily dose in hepatic impairment or chronic alcohol use.',
    },
  },
  {
    keywords: ['ibuprofen'],
    therapeuticClass: 'NSAID (Analgesic, Anti-inflammatory, Antipyretic)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 20,
      mgPerKgPerDayMax: 30,
      standardRangeLabel: '5–10 mg/kg/dose every 6–8h (20–30 mg/kg/day)',
      dosesPerDay: 3,
      frequencyLabel: 'TDS — every 8 hours (প্রতি ৮ ঘণ্টা পরপর খাবার পর)',
      maxDailyDoseMg: 1200,
      maxSingleDoseMg: 400,
      maxDailyLimitLabel: 'Max 30 mg/kg/day (up to 1200 mg/day)',
      pediatricNotes: 'For infants ≥6 months (≥5 kg). Avoid in dehydrated children, dengue fever, or chickenpox.',
    },
    adult: {
      standardDose: '400 mg',
      frequency: 'TDS — every 8 hours after meal (খাবার পর দিনে ৩ বার)',
      maxDailyLimit: '1200–2400 mg/day',
      indicationVariations: [
        'Mild–Moderate Pain / Fever / Dysmenorrhea: 400 mg TDS',
        'Inflammatory / Musculoskeletal Pain: 400–600 mg TDS under medical supervision',
      ],
      renalElderlyNote: 'Avoid in moderate-to-severe renal impairment (eGFR <30), active peptic ulcer, or frail elderly without gastroprotection.',
    },
    duration: {
      summary: 'Shortest effective duration — typically 3–5 days (সর্বনিম্ন কার্যকর সময়, সাধারণত ৩–৫ দিন)',
      byIndication: ['Fever / Acute Pain: 2–5 days', 'Suspected Dengue: Strictly avoid NSAIDs'],
    },
    administration: {
      mealGuidance: 'Always take AFTER food (অবশ্যই ভরা পেটে / খাবার পর সেবন করুন)',
      reconstitutionNote: 'Suspension: Shake well before each dose.',
      keyTips: ['Do not use in suspected dengue fever due to bleeding risk.', 'Consider PPI cover in GI-risk adults.'],
    },
    safety: {
      contraindications: ['Active peptic ulcer / GI bleeding', 'Suspected dengue fever', 'Severe renal/cardiac failure', '3rd trimester pregnancy'],
      pregnancyLactation: 'Avoid in pregnancy (especially after 20 weeks / 3rd trimester); compatible during breastfeeding.',
      renalHepaticCaution: 'Avoid in significant renal impairment or dehydration.',
    },
  },
  {
    keywords: ['esomeprazole', 'omeprazole', 'pantoprazole', 'rabeprazole', 'dexlansoprazole', 'lansoprazole'],
    therapeuticClass: 'Proton Pump Inhibitor (PPI)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 0.7,
      mgPerKgPerDayMax: 1.4,
      standardRangeLabel: '0.7–1.4 mg/kg/day OD (typically 10–20 mg OD by weight/age)',
      dosesPerDay: 1,
      frequencyLabel: 'OD — once daily before breakfast (সকালে খাবারের ৩০–৬০ মিনিট আগে)',
      maxDailyDoseMg: 40,
      maxSingleDoseMg: 40,
      maxDailyLimitLabel: 'Max 20–40 mg/day',
      pediatricNotes: 'For children ≥1 year with confirmed GERD/erosive esophagitis under pediatric supervision (10–20 kg: 10 mg OD; >20 kg: 20 mg OD).',
    },
    adult: {
      standardDose: '20–40 mg (Rabeprazole: 20 mg; Dexlansoprazole: 30–60 mg)',
      frequency: 'OD or BD before meals (খাবারের ৩০–৬০ মিনিট আগে)',
      maxDailyLimit: '40–80 mg/day depending on indication',
      indicationVariations: [
        'GERD / Acid Peptic Disease / Gastritis: 20–40 mg OD before breakfast',
        'Erosive Esophagitis / H. pylori Therapy: 20–40 mg BD (with antibiotics for H. pylori)',
        'NSAID-Induced Ulcer Prophylaxis: 20 mg OD',
      ],
      renalElderlyNote: 'No routine renal dose reduction required; avoid unnecessary prolonged high-dose therapy in elderly (monitor Mg, B12, bone health).',
    },
    duration: {
      summary: '2–8 weeks depending on indication (সাধারণত ২–৮ সপ্তাহ)',
      byIndication: ['Dyspepsia / Gastritis: 2–4 weeks', 'GERD / Peptic Ulcer: 4–8 weeks', 'H. pylori Regimen: 14 days'],
    },
    administration: {
      mealGuidance: 'Take 30–60 minutes BEFORE breakfast/meal (খাবারের ৩০–৬০ মিনিট আগে খালি পেটে)',
      reconstitutionNote: 'Swallow enteric-coated tablets/capsules whole — do not crush or chew.',
      keyTips: ['Pre-meal timing activates maximal acid suppression when parietal pumps turn on.'],
    },
    safety: {
      contraindications: ['Hypersensitivity to substituted benzimidazoles'],
      pregnancyLactation: 'Omeprazole/Esomeprazole/Pantoprazole generally considered acceptable when clinically required.',
      renalHepaticCaution: 'Limit Esomeprazole/Omeprazole to 20 mg/day in severe hepatic impairment.',
    },
  },
  {
    keywords: ['domperidone'],
    therapeuticClass: 'Prokinetic & Antiemetic (Dopamine D2 Antagonist)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 0.75,
      mgPerKgPerDayMax: 0.75,
      standardRangeLabel: '0.25 mg/kg/dose up to 3 times daily (max 0.75 mg/kg/day)',
      dosesPerDay: 3,
      frequencyLabel: 'TDS before meals (খাবারের ১৫–৩০ মিনিট আগে দিনে ৩ বার)',
      maxDailyDoseMg: 30,
      maxSingleDoseMg: 10,
      maxDailyLimitLabel: 'Max 30 mg/day (max 0.75 mg/kg/day)',
      pediatricNotes: 'Use lowest effective dose for shortest duration (max 7 days). Measure liquid strictly with calibrated syringe/dropper.',
    },
    adult: {
      standardDose: '10 mg',
      frequency: 'TDS before meals (খাবারের ১৫–৩০ মিনিট আগে দিনে ৩ বার)',
      maxDailyLimit: '30 mg/day',
      indicationVariations: [
        'Nausea / Vomiting / Dyspepsia / Bloating: 10 mg TDS 15–30 min before meals',
      ],
      renalElderlyNote: 'Reduce frequency to OD/BD in severe renal impairment. Caution in elderly >60 yrs due to QT-prolongation risk.',
    },
    duration: {
      summary: 'Up to 7 days (সাধারণত সর্বোচ্চ ৭ দিন)',
      byIndication: ['Acute Nausea / Vomiting: 3–7 days (lowest effective dose)'],
    },
    administration: {
      mealGuidance: 'Take 15–30 minutes BEFORE meals (খাবারের ১৫–৩০ মিনিট আগে)',
      reconstitutionNote: 'Suspension/Drops: Shake well before use.',
      keyTips: ['Do not exceed 30 mg/day in adults due to cardiac QT safety guidelines.'],
    },
    safety: {
      contraindications: ['Moderate-to-severe hepatic impairment', 'Known QT prolongation or concurrent strong CYP3A4 inhibitors', 'GI hemorrhage or mechanical obstruction'],
      pregnancyLactation: 'Avoid in pregnancy unless essential; low levels in breast milk.',
      renalHepaticCaution: 'Contraindicated in moderate/severe hepatic impairment; reduce frequency in severe renal failure.',
    },
  },
  {
    keywords: ['ondansetron'],
    therapeuticClass: '5-HT3 Receptor Antagonist (Antiemetic)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 0.3,
      mgPerKgPerDayMax: 0.45,
      standardRangeLabel: '0.1–0.15 mg/kg/dose every 8 hours (max 4–8 mg/dose)',
      dosesPerDay: 3,
      frequencyLabel: 'Every 8 hours PRN (প্রয়োজনে প্রতি ৮ ঘণ্টা পরপর)',
      maxDailyDoseMg: 16,
      maxSingleDoseMg: 8,
      maxDailyLimitLabel: 'Max 4 mg/dose (<40 kg) · Max 8 mg/dose (≥40 kg)',
      pediatricNotes: 'Effective for acute gastroenteritis-associated vomiting (often single dose 0.15 mg/kg to enable oral rehydration).',
    },
    adult: {
      standardDose: '4–8 mg',
      frequency: 'BD or TDS (প্রতি ৮–১২ ঘণ্টা পরপর)',
      maxDailyLimit: '24 mg/day (max 8 mg/day in severe hepatic impairment)',
      indicationVariations: [
        'Acute Nausea / Vomiting: 4–8 mg every 8–12 hours',
        'Post-operative / Chemotherapy Nausea: 8 mg BD',
      ],
      renalElderlyNote: 'No renal adjustment needed; cap at 8 mg/day in severe hepatic impairment; monitor QT in elderly.',
    },
    duration: {
      summary: '1–3 days PRN (বমি নিয়ন্ত্রণে সাধারণত ১–৩ দিন)',
      byIndication: ['Acute Gastroenteritis Vomiting: 1–2 days alongside ORS'],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে; মুখের ভেতর গলে যাওয়া ট্যাবলেট/সিরাপ)',
      reconstitutionNote: 'Oral Solution/Syrup: Measure exact mL with calibrated spoon/syringe.',
      keyTips: ['Pair with ORS hydration in acute vomiting/diarrhea.'],
    },
    safety: {
      contraindications: ['Congenital long QT syndrome', 'Concurrent apomorphine'],
      pregnancyLactation: 'Avoid routine 1st-trimester use unless clearly needed; generally compatible in lactation.',
      renalHepaticCaution: 'Max 8 mg/day in severe hepatic impairment.',
    },
  },
  {
    keywords: ['montelukast'],
    therapeuticClass: 'Leukotriene Receptor Antagonist (LTRA)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Age-based fixed dose: 6m–5 yrs: 4 mg OD · 6–14 yrs: 5 mg OD · ≥15 yrs: 10 mg OD',
      dosesPerDay: 1,
      frequencyLabel: 'OD at evening/bedtime (প্রতিদিন রাতে ১ বার)',
      maxDailyDoseMg: 10,
      maxSingleDoseMg: 10,
      maxDailyLimitLabel: 'Max 4 mg (<6 yrs) · 5 mg (6–14 yrs) · 10 mg (≥15 yrs)',
      pediatricNotes: 'Fixed age-based dosing (not weight-based). Use 4 mg chewable/granules for 2–5 yrs and 5 mg chewable for 6–14 yrs.',
    },
    adult: {
      standardDose: '10 mg',
      frequency: 'OD in the evening / bedtime (প্রতিদিন রাতে ১টি ট্যাবলেট)',
      maxDailyLimit: '10 mg/day',
      indicationVariations: [
        'Asthma Prophylaxis & Allergic Rhinitis: 10 mg OD in the evening',
        'Exercise-Induced Bronchoconstriction: 10 mg at least 2 hours before exercise',
      ],
      renalElderlyNote: 'No dose adjustment needed in renal impairment, mild-to-moderate hepatic impairment, or elderly.',
    },
    duration: {
      summary: 'Long-term maintenance as advised (অ্যাজমা/অ্যালার্জিতে নিয়মিত চলবে; সাধারণত ১–৩ মাস+)',
      byIndication: ['Allergic Rhinitis: 2–4 weeks or seasonal', 'Chronic Asthma Control: Ongoing daily prophylaxis'],
    },
    administration: {
      mealGuidance: 'With or without food in the evening (খাবারের আগে বা পরে প্রতিদিন রাতে)',
      reconstitutionNote: 'Not for acute asthma attacks — keep reliever inhaler (e.g., Salbutamol) available.',
      keyTips: ['Evening administration aligns with nocturnal airway inflammation.'],
    },
    safety: {
      contraindications: ['Hypersensitivity to montelukast', 'Not for acute bronchospasm relief'],
      pregnancyLactation: 'Generally considered compatible in pregnancy when required for asthma control.',
      renalHepaticCaution: 'Monitor for rare neuropsychiatric changes (mood/sleep changes); no renal adjustment required.',
    },
  },
  {
    keywords: ['cetirizine', 'levocetirizine', 'fexofenadine', 'rupatadine', 'desloratadine', 'loratadine', 'bilastine'],
    therapeuticClass: '2nd Generation Antihistamine',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Age-based fixed dose (e.g., Cetirizine 2.5–5 mg OD; Fexofenadine 30 mg BD for 6–11 yrs)',
      dosesPerDay: 1,
      frequencyLabel: 'OD at bedtime or BD as per molecule (দিনে ১–২ বার)',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Follow age-specific pediatric syrup dose',
      pediatricNotes:
        'Non-sedating/low-sedation antihistamines use age-tiered dosing: e.g., Cetirizine 2–5 yrs 2.5–5 mg OD; Levocetirizine 6m–5 yrs 1.25 mg OD, 6–11 yrs 2.5 mg OD; Fexofenadine 2–11 yrs 30 mg BD.',
    },
    adult: {
      standardDose: '1 Tablet OD (Cetirizine 10 mg · Levocetirizine 5 mg · Fexofenadine 120–180 mg · Rupatadine 10 mg · Bilastine 20 mg)',
      frequency: 'OD — once daily (দিনে ১ বার)',
      maxDailyLimit: '1 standard adult tablet/day',
      indicationVariations: [
        'Allergic Rhinitis / Sneezing / Rhinorrhea: Standard OD dose',
        'Chronic Spontaneous Urticaria: Standard OD dose (Fexofenadine 180 mg OD)',
      ],
      renalElderlyNote: 'Reduce dose or extend interval in moderate-to-severe renal impairment (especially Cetirizine/Levocetirizine).',
    },
    duration: {
      summary: '7–14 days or as needed for allergy symptoms (সাধারণত ৭–১৪ দিন)',
      byIndication: ['Acute Allergic Rhinitis / Urticaria: 7–14 days', 'Perennial Allergy: As advised by physician'],
    },
    administration: {
      mealGuidance: 'Bilastine/Fexofenadine: avoid fruit juices (take with water); others with or without food',
      reconstitutionNote: 'Syrup/Oral Solution: Measure exact mL according to child’s age.',
      keyTips: ['Even 2nd-generation agents may cause mild drowsiness in some patients — evening dosing helps.'],
    },
    safety: {
      contraindications: ['End-stage renal disease (for Cetirizine/Levocetirizine)', 'Hypersensitivity'],
      pregnancyLactation: 'Cetirizine/Loratadine are preferred options when an antihistamine is needed in pregnancy.',
      renalHepaticCaution: 'Halve dose in CrCl 10–49 mL/min for Cetirizine/Levocetirizine.',
    },
  },
  {
    keywords: ['salbutamol', 'albuterol'],
    therapeuticClass: 'Short-Acting Beta-2 Agonist (Bronchodilator)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 0.3,
      mgPerKgPerDayMax: 0.4,
      standardRangeLabel: '0.1 mg/kg/dose TDS–QID (oral syrup: 2–5 yrs 1–2 mg TDS; 6–12 yrs 2 mg TDS–QID)',
      dosesPerDay: 3,
      frequencyLabel: 'TDS — every 8 hours (প্রতি ৮ ঘণ্টা পরপর) or PRN inhaler',
      maxDailyDoseMg: 8,
      maxSingleDoseMg: 2,
      maxDailyLimitLabel: 'Max 8 mg/day (children 6–12 yrs)',
      pediatricNotes: 'Inhaled therapy (MDI with spacer / nebulizer) is preferred over oral syrup due to faster onset and fewer tremor/tachycardia effects.',
    },
    adult: {
      standardDose: '2–4 mg (oral) or 100–200 mcg (1–2 puffs MDI)',
      frequency: 'TDS–QID oral or PRN every 4–6 hours inhaled',
      maxDailyLimit: '16–32 mg/day oral · Max 8 puffs/day MDI (seek urgent care if needed more)',
      indicationVariations: [
        'Acute Bronchospasm / Asthma Relief: 1–2 puffs (100–200 mcg) PRN',
        'Oral Bronchodilator (when inhaler unavailable): 2–4 mg TDS–QID',
      ],
      renalElderlyNote: 'Start at lower dose (2 mg TDS) in elderly and cardiac patients to reduce tremor and tachycardia.',
    },
    duration: {
      summary: 'PRN for acute relief or 5–7 days for acute wheeze (প্রয়োজন অনুযায়ী বা ৫–৭ দিন)',
      byIndication: ['Acute Bronchospasm: PRN relief', 'Frequent SABA use (>2 days/week) signals need for controller ICS'],
    },
    administration: {
      mealGuidance: 'With or without food (খাবারের আগে বা পরে নেওয়া যাবে)',
      reconstitutionNote: 'Inhaler: Shake well before each puff; use spacer in children for better lung delivery.',
      keyTips: ['May cause mild hand tremor or palpitations initially.'],
    },
    safety: {
      contraindications: ['Hypersensitivity to salbutamol'],
      pregnancyLactation: 'Preferred short-acting bronchodilator in pregnancy and breastfeeding.',
      renalHepaticCaution: 'Use caution in ischemic heart disease, arrhythmias, hyperthyroidism, and hypokalemia.',
    },
  },
  {
    keywords: ['albendazole'],
    therapeuticClass: 'Broad-Spectrum Anthelmintic',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: '1–2 yrs: 200 mg single dose · >2 yrs: 400 mg single dose',
      dosesPerDay: 1,
      frequencyLabel: 'Single stat dose (একবার সেবনযোগ্য; প্রয়োজনে ২ সপ্তাহ পর পুনরাবৃত্তি)',
      maxDailyDoseMg: 400,
      maxSingleDoseMg: 400,
      maxDailyLimitLabel: 'Max 400 mg/dose',
      pediatricNotes: 'For children ≥1 year. Chew tablet thoroughly or give suspension.',
    },
    adult: {
      standardDose: '400 mg',
      frequency: 'Single stat dose (একবার সেবনযোগ্য)',
      maxDailyLimit: '400 mg/day (800 mg/day only in systemic hydatid/neurocysticercosis)',
      indicationVariations: [
        'Roundworm / Hookworm / Pinworm: 400 mg single dose (repeat after 2 weeks for pinworm)',
        'Giardiasis / Strongyloidiasis: 400 mg OD for 3–5 days',
      ],
      renalElderlyNote: 'No routine renal adjustment; monitor LFTs only on prolonged multi-week systemic courses.',
    },
    duration: {
      summary: 'Single dose (১ ডোজ; পিনওয়ার্মে ২ সপ্তাহ পর ১টি রিপিট ডোজ)',
      byIndication: ['Routine Deworming: Single stat dose', 'Giardiasis / Strongyloidiasis: 3–5 days'],
    },
    administration: {
      mealGuidance: 'Take with a meal (খাবারের সাথে বা খাবার পর; চুষে/চিবিয়ে খাওয়া যায়)',
      reconstitutionNote: 'Suspension: Shake well before pouring single 10 mL (400 mg) or 5 mL (200 mg) dose.',
      keyTips: ['Treat household contacts simultaneously in pinworm infestation.'],
    },
    safety: {
      contraindications: ['Pregnancy (especially 1st trimester)', 'Children <1 year (unless specialist-directed)'],
      pregnancyLactation: 'Contraindicated in 1st trimester of pregnancy.',
      renalHepaticCaution: 'Caution in pre-existing liver disease during multi-day courses.',
    },
  },
  {
    keywords: ['zinc'],
    therapeuticClass: 'Essential Trace Mineral (Diarrhea Adjunct)',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: '<6 months: 10 mg OD · ≥6 months: 20 mg OD (elemental zinc)',
      dosesPerDay: 1,
      frequencyLabel: 'OD — once daily for 10–14 days (দিনে ১ বার, ১০–১৪ দিন)',
      maxDailyDoseMg: 20,
      maxSingleDoseMg: 20,
      maxDailyLimitLabel: 'Max 20 mg elemental zinc/day (pediatric diarrhea)',
      pediatricNotes: 'WHO/ICDDR,B protocol for acute pediatric diarrhea alongside ORS: 10 mg OD (<6 mo) or 20 mg OD (≥6 mo) for 10–14 days.',
    },
    adult: {
      standardDose: '20 mg elemental zinc',
      frequency: 'OD or BD after meal (খাবার পর দিনে ১–২ বার)',
      maxDailyLimit: '40 mg elemental zinc/day (routine supplementation)',
      indicationVariations: [
        'Acute Diarrhea / Zinc Deficiency: 20 mg OD–BD for 10–14 days',
      ],
      renalElderlyNote: 'Well tolerated; avoid prolonged excess dosing (>40 mg/day) which may impair copper absorption.',
    },
    duration: {
      summary: '10–14 days for acute diarrhea (ডায়রিয়ায় অবশ্যই ১০–১৪ দিন পূর্ণ কোর্স)',
      byIndication: ['Pediatric Acute Diarrhea: 10–14 days (even after diarrhea stops)', 'Nutritional Deficiency: 2–4 weeks'],
    },
    administration: {
      mealGuidance: 'Take AFTER meal to prevent nausea (খাবার পর সেবন করুন)',
      reconstitutionNote: 'Dispersible tablet: dissolve in 1 teaspoon of breast milk or clean water.',
      keyTips: ['Separate from fluoroquinolones, tetracyclines, and iron by at least 2 hours.'],
    },
    safety: {
      contraindications: ['Known hypersensitivity'],
      pregnancyLactation: 'Safe at recommended dietary/therapeutic doses in pregnancy and breastfeeding.',
      renalHepaticCaution: 'Caution in severe renal failure if high doses are used long-term.',
    },
  },
  {
    keywords: ['prednisolone', 'deflazacort'],
    therapeuticClass: 'Systemic Corticosteroid',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: 1,
      mgPerKgPerDayMax: 2,
      standardRangeLabel: '1–2 mg/kg/day OD (Prednisolone; Deflazacort 6 mg ≈ Prednisolone 5 mg)',
      dosesPerDay: 1,
      frequencyLabel: 'OD in the morning after breakfast (সকালে নাশতার পর দিনে ১ বার)',
      maxDailyDoseMg: 40,
      maxSingleDoseMg: 40,
      maxDailyLimitLabel: 'Max 40–60 mg/day (acute asthma/inflammatory)',
      pediatricNotes: 'For acute asthma exacerbation typically 1–2 mg/kg OD for 3–5 days. Deflazacort equivalent dose is ~1.2× Prednisolone.',
    },
    adult: {
      standardDose: '5–40 mg (Prednisolone) or 6–36 mg (Deflazacort)',
      frequency: 'OD in the morning after breakfast (সকালে নাশতার পর)',
      maxDailyLimit: '60 mg/day (acute systemic)',
      indicationVariations: [
        'Acute Asthma / COPD Exacerbation: 30–40 mg OD for 5 days',
        'Inflammatory / Autoimmune Maintenance: Lowest effective morning dose (5–15 mg OD)',
      ],
      renalElderlyNote: 'Monitor blood glucose, BP, and bone density in elderly; taper gradually if used >14 days.',
    },
    duration: {
      summary: '3–7 days for acute flare; taper if >2 weeks (তীব্র সমস্যায় ৩–৭ দিন; দীর্ঘমেয়াদী হলে ধাপে ধাপে কমাতে হবে)',
      byIndication: ['Acute Asthma / Allergic Reaction: 3–5 days', 'Chronic Inflammatory: Taper under physician supervision'],
    },
    administration: {
      mealGuidance: 'Take in the MORNING AFTER breakfast (সকালে ভরা পেটে সেবন করুন)',
      reconstitutionNote: 'Oral Solution: Shake gently and measure exact mL.',
      keyTips: ['Never stop abruptly after >2 weeks of therapy to avoid adrenal crisis.'],
    },
    safety: {
      contraindications: ['Systemic fungal infections', 'Live vaccines during high-dose immunosuppressive therapy'],
      pregnancyLactation: 'Use lowest effective dose when clinically essential; Prednisolone is preferred steroid in pregnancy.',
      renalHepaticCaution: 'Caution in diabetes, hypertension, peptic ulcer, and osteoporosis.',
    },
  },
  {
    keywords: ['amlodipine', 'losartan', 'olmesartan', 'telmisartan', 'valsartan', 'bisoprolol', 'metoprolol', 'atenolol', 'ramipril', 'nebivolol'],
    therapeuticClass: 'Cardiovascular / Antihypertensive Agent',
    pediatric: {
      applicable: false,
      contraindicationBadge: 'Adult Antihypertensive — Pediatric Use Only by Pediatric Cardiologist (শিশুদের ক্ষেত্রে কেবল বিশেষজ্ঞ চিকিৎসকের তত্ত্বাবধানে)',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Adult-focused cardiovascular therapy (specialist-only in children)',
      dosesPerDay: 1,
      frequencyLabel: 'Specialist-supervised only',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not for routine pediatric use',
      pediatricNotes: 'Pediatric hypertension dosing requires pediatric cardiologist/nephrologist evaluation.',
    },
    adult: {
      standardDose: '1 Tablet OD (titrated to BP response)',
      frequency: 'OD — once daily at the same time each day (প্রতিদিন একই সময়ে ১ বার)',
      maxDailyLimit: 'Per molecule maximum (e.g., Amlodipine 10 mg, Losartan 100 mg, Olmesartan 40 mg, Telmisartan 80 mg)',
      indicationVariations: [
        'Essential Hypertension: Start at lowest catalog strength OD; titrate after 2–4 weeks',
        'Angina / Heart Failure / Diabetic Nephropathy: Titrate per physician target',
      ],
      renalElderlyNote: 'Start low and titrate slowly in elderly; monitor serum creatinine and potassium for ARBs/ACE inhibitors.',
    },
    duration: {
      summary: 'Long-term continuous daily therapy (দীর্ঘমেয়াদী নিয়মিত চিকিৎসা — চিকিৎসকের পরামর্শ ছাড়া বন্ধ নয়)',
      byIndication: ['Hypertension / Cardiac Protection: Ongoing daily therapy with regular BP monitoring'],
    },
    administration: {
      mealGuidance: 'With or without food at a consistent time daily (প্রতিদিন একই সময়ে খাবারের আগে বা পরে)',
      reconstitutionNote: 'Do not stop beta-blockers abruptly (risk of rebound angina/hypertension).',
      keyTips: ['Monitor home BP regularly and rise slowly if mild dizziness occurs initially.'],
    },
    safety: {
      contraindications: ['Pregnancy (strictly contraindicated for ARBs & ACE inhibitors)', 'Severe hypotension or cardiogenic shock'],
      pregnancyLactation: 'ARBs/ACE inhibitors are strictly contraindicated in pregnancy; switch to pregnancy-safe alternatives.',
      renalHepaticCaution: 'Monitor renal function & potassium for ARBs/ACEi; start lower dose of Amlodipine in hepatic impairment.',
    },
  },
  {
    keywords: ['atorvastatin', 'rosuvastatin', 'pitavastatin', 'simvastatin', 'fenofibrate'],
    therapeuticClass: 'Lipid-Lowering Agent (Statin / Fibrate)',
    pediatric: {
      applicable: false,
      contraindicationBadge: 'Adult Lipid Therapy — Not for Routine Pediatric Use (শিশুদের জন্য সাধারণত প্রযোজ্য নয়)',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Adult dyslipidemia therapy (familial hypercholesterolemia only under specialist)',
      dosesPerDay: 1,
      frequencyLabel: 'Adult therapy',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not routinely indicated in children',
      pediatricNotes: 'Reserved for specialist-managed familial hypercholesterolemia in children ≥10 years.',
    },
    adult: {
      standardDose: '10–20 mg OD (Rosuvastatin 5–20 mg · Atorvastatin 10–40 mg)',
      frequency: 'OD — once daily, preferably in the evening/bedtime (প্রতিদিন রাতে ১ বার)',
      maxDailyLimit: 'Atorvastatin 80 mg/day · Rosuvastatin 40 mg/day',
      indicationVariations: [
        'Primary Hyperlipidemia / Dyslipidemia: 10–20 mg OD',
        'High-Intensity CV Risk Reduction (ACS / Stroke): Atorvastatin 40–80 mg or Rosuvastatin 20–40 mg OD',
      ],
      renalElderlyNote: 'Start Rosuvastatin at 5 mg OD in Asian/elderly patients and moderate renal impairment (avoid >10 mg if CrCl <30).',
    },
    duration: {
      summary: 'Long-term daily maintenance with periodic lipid profile checks (দীর্ঘমেয়াদী চিকিৎসা)',
      byIndication: ['Dyslipidemia / CV Prevention: Continuous daily therapy; recheck lipid panel every 3–6 months'],
    },
    administration: {
      mealGuidance: 'With or without food, preferably at night (খাবারের আগে বা পরে, সাধারণত রাতে)',
      reconstitutionNote: 'Combine with heart-healthy diet and regular physical activity.',
      keyTips: ['Report unexplained muscle pain, tenderness, or dark urine immediately.'],
    },
    safety: {
      contraindications: ['Active liver disease or unexplained persistent transaminase elevation', 'Pregnancy and breastfeeding'],
      pregnancyLactation: 'Contraindicated in pregnancy and lactation.',
      renalHepaticCaution: 'Check baseline LFTs; adjust Rosuvastatin in severe renal impairment.',
    },
  },
  {
    keywords: ['metformin', 'glimepiride', 'gliclazide', 'sitagliptin', 'vildagliptin', 'linagliptin', 'empagliflozin', 'dapagliflozin'],
    therapeuticClass: 'Oral Antidiabetic / Antihyperglycemic Agent',
    pediatric: {
      applicable: false,
      contraindicationBadge: 'Adult Type 2 Diabetes Therapy (শিশুদের ডায়াবেটিসে কেবল এন্ডোক্রাইনোলজিস্টের পরামর্শে)',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Adult T2DM therapy (specialist pediatric endocrinology only)',
      dosesPerDay: 1,
      frequencyLabel: 'Adult therapy',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not for routine pediatric use',
      pediatricNotes: 'Pediatric diabetes requires endocrinologist-guided insulin or specific specialist therapy.',
    },
    adult: {
      standardDose: '1 Tablet per prescribed strength (e.g., Metformin 500–850 mg · Glimepiride 1–2 mg · Empagliflozin 10 mg)',
      frequency: 'OD or BD as per molecule & glycemic target (প্রতিদিন ১–২ বার)',
      maxDailyLimit: 'Metformin 2000–2550 mg/day · Glimepiride 8 mg/day · Empagliflozin 25 mg/day · Sitagliptin 100 mg/day',
      indicationVariations: [
        'Type 2 Diabetes Mellitus: Start low and titrate according to FBS/2h-PPBS & HbA1c',
        'Cardiorenal Protection (SGLT2i): Empagliflozin/Dapagliflozin 10 mg OD',
      ],
      renalElderlyNote: 'Check eGFR before initiation (Metformin contraindicated if eGFR <30; adjust Sitagliptin if eGFR <45; watch hypoglycemia with sulfonylureas in elderly).',
    },
    duration: {
      summary: 'Long-term continuous glycemic management (দীর্ঘমেয়াদী নিয়মিত চিকিৎসা)',
      byIndication: ['Type 2 Diabetes Mellitus: Ongoing therapy with HbA1c monitoring every 3–6 months'],
    },
    administration: {
      mealGuidance: 'Metformin: WITH/AFTER meal; Sulfonylureas: BEFORE breakfast; DPP-4i/SGLT2i: with or without food',
      reconstitutionNote: 'Maintain hydration (especially with SGLT2 inhibitors) and regular meal timings.',
      keyTips: ['Never skip meals when taking sulfonylureas (Glimepiride/Gliclazide) to prevent hypoglycemia.'],
    },
    safety: {
      contraindications: ['Type 1 diabetes or diabetic ketoacidosis (DKA)', 'Severe renal impairment (eGFR <30 for Metformin)'],
      pregnancyLactation: 'Insulin is first-line in pregnancy; consult endocrinologist/obstetrician.',
      renalHepaticCaution: 'Check renal function periodically; hold Metformin/SGLT2i during acute dehydration or major surgery.',
    },
  },
  {
    keywords: ['diclofenac', 'naproxen', 'aceclofenac', 'ketorolac', 'etoricoxib', 'mefenamic', 'meloxicam'],
    therapeuticClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    pediatric: {
      applicable: false,
      contraindicationBadge: 'Adult NSAID — Avoid Routine Pediatric Use (শিশুদের ক্ষেত্রে সাধারণত প্রযোজ্য নয়)',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Adult analgesic / anti-inflammatory therapy (Paracetamol or Ibuprofen preferred in children)',
      dosesPerDay: 2,
      frequencyLabel: 'Adult therapy',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not for routine pediatric use',
      pediatricNotes: 'For pediatric fever or mild pain, Paracetamol or Ibuprofen is preferred unless specifically prescribed by a specialist.',
    },
    adult: {
      standardDose: '1 Tablet/Capsule per catalog strength (e.g., Naproxen 250–500 mg · Aceclofenac 100 mg · Etoricoxib 60–90 mg · Ketorolac 10 mg)',
      frequency: 'OD (Etoricoxib) or BD after meals (খাবার পর দিনে ১–২ বার)',
      maxDailyLimit: 'Lowest effective dose for shortest duration (Ketorolac max 5 days / 40 mg oral)',
      indicationVariations: [
        'Acute Musculoskeletal / Dental / Post-op Pain: Standard dose after food',
        'Osteoarthritis / Rheumatoid Arthritis: Lowest effective daily dose with PPI gastroprotection',
      ],
      renalElderlyNote: 'Avoid in elderly >65 yrs with renal impairment, peptic ulcer history, or cardiovascular disease; pair with a PPI if needed.',
    },
    duration: {
      summary: 'Shortest duration — typically 3–7 days (সর্বনিম্ন সময়, সাধারণত ৩–৭ দিন; Ketorolac সর্বোচ্চ ৫ দিন)',
      byIndication: ['Acute Pain / Inflammation: 3–5 days', 'Chronic Arthritis: Periodic review with PPI cover'],
    },
    administration: {
      mealGuidance: 'Strictly AFTER meals with water (অবশ্যই খাবার পর ভরা পেটে সেবন করুন)',
      reconstitutionNote: 'Avoid combining two different NSAIDs at the same time.',
      keyTips: ['Strictly avoid in suspected dengue fever or active gastritis/peptic ulcer.'],
    },
    safety: {
      contraindications: ['Active GI ulcer/bleeding', 'Severe renal, hepatic, or heart failure', 'Suspected dengue fever', '3rd trimester pregnancy'],
      pregnancyLactation: 'Avoid in pregnancy (especially 3rd trimester); use caution during lactation.',
      renalHepaticCaution: 'Monitor renal function and blood pressure; avoid if eGFR <30 mL/min.',
    },
  },
  {
    keywords: ['pregabalin', 'gabapentin'],
    therapeuticClass: 'Neuropathic Pain Agent / Anticonvulsant',
    pediatric: {
      applicable: false,
      contraindicationBadge: 'Adult Neuropathic Pain Therapy — Specialist Only in Pediatrics',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Adult neuropathic pain & epilepsy adjunct',
      dosesPerDay: 2,
      frequencyLabel: 'Specialist-only in children',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not for routine pediatric use',
      pediatricNotes: 'Pediatric use is restricted to pediatric neurologists for specific seizure disorders.',
    },
    adult: {
      standardDose: 'Pregabalin 50–75 mg BD (or 75 mg at night) · Gabapentin 300 mg OD–TDS',
      frequency: 'OD at bedtime initially, then BD–TDS (শুরুতে রাতে ১ বার, পরে দিনে ২ বার)',
      maxDailyLimit: 'Pregabalin 600 mg/day · Gabapentin 3600 mg/day',
      indicationVariations: [
        'Diabetic / Peripheral Neuropathy / Sciatica: Start 50–75 mg at night; titrate to 75–150 mg BD',
        'Fibromyalgia / Post-herpetic Neuralgia: 75–150 mg BD',
      ],
      renalElderlyNote: 'Mandatory dose reduction in renal impairment (CrCl <60 mL/min); start low in elderly due to dizziness and fall risk.',
    },
    duration: {
      summary: '2–8 weeks+ as clinically indicated (চিকিৎসকের পরামর্শ অনুযায়ী; হঠাৎ বন্ধ করা যাবে না)',
      byIndication: ['Neuropathic Pain: Reassess efficacy after 2–4 weeks; taper over ≥1 week when stopping'],
    },
    administration: {
      mealGuidance: 'With or without food; bedtime dosing minimizes initial drowsiness (খাবারের আগে বা পরে; রাতে নেওয়া সুবিধাজনক)',
      reconstitutionNote: 'Taper gradually over at least 7 days when discontinuing.',
      keyTips: ['May cause dizziness or drowsiness — caution while driving.'],
    },
    safety: {
      contraindications: ['Hypersensitivity', 'Abrupt discontinuation'],
      pregnancyLactation: 'Avoid unless clearly necessary; discuss risk–benefit in pregnancy.',
      renalHepaticCaution: 'Strictly adjust dose by CrCl (renally excreted unchanged).',
    },
  },
  {
    keywords: ['calcium', 'vitamin d', 'cholecalciferol'],
    therapeuticClass: 'Bone & Mineral Supplement',
    pediatric: {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Age-based daily supplementation (Vitamin D3 400 IU/day; Calcium per pediatric RDA)',
      dosesPerDay: 1,
      frequencyLabel: 'OD or BD after meal (খাবার পর দিনে ১–২ বার)',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Follow pediatric RDA by age',
      pediatricNotes: 'Use pediatric liquid/drops formulation for infants and young children.',
    },
    adult: {
      standardDose: 'Calcium 500 mg + Vitamin D3 200–400 IU (or Vit D3 20,000–40,000 IU weekly for deficiency)',
      frequency: 'OD or BD after meals (খাবার পর দিনে ১–২ বার)',
      maxDailyLimit: '1000–1200 mg elemental calcium/day (diet + supplements)',
      indicationVariations: [
        'Osteoporosis / Pregnancy / Lactation Support: Calcium 500 mg + Vit D3 OD–BD',
        'Vitamin D Deficiency (high-dose D3): 20,000–50,000 IU once weekly for 6–8 weeks',
      ],
      renalElderlyNote: 'Monitor serum calcium in renal impairment or history of calcium kidney stones.',
    },
    duration: {
      summary: '1–3 months or ongoing maintenance (সাধারণত ১–৩ মাস বা প্রয়োজন অনুযায়ী)',
      byIndication: ['Pregnancy / Lactation / Osteoporosis: Ongoing supplementation as advised'],
    },
    administration: {
      mealGuidance: 'Take AFTER meal for best absorption (খাবার পর সেবন করুন)',
      reconstitutionNote: 'Separate from iron, levothyroxine, and fluoroquinolone/tetracycline antibiotics by at least 2 hours.',
      keyTips: ['Drink adequate water to minimize constipation or stone risk.'],
    },
    safety: {
      contraindications: ['Hypercalcemia', 'Severe hypercalciuria or active calcium nephrolithiasis'],
      pregnancyLactation: 'Widely recommended in pregnancy and lactation within standard daily limits.',
      renalHepaticCaution: 'Monitor calcium and phosphate in chronic kidney disease.',
    },
  },
];

function matchBuiltinGenericRule(genericName: string): BuiltinGenericRule | null {
  const norm = genericName.trim().toLowerCase();
  if (!norm) return null;

  for (const rule of BUILTIN_GENERIC_RULES) {
    const allPresent = rule.keywords.every((kw) => norm.includes(kw));
    if (!allPresent) continue;
    if (rule.excludeKeywords && rule.excludeKeywords.some((ex) => norm.includes(ex))) {
      continue;
    }
    return rule;
  }
  return null;
}

interface ParsedSolidStrength {
  value: number;
  unit: 'mg' | 'g' | 'mcg' | 'iu' | '%';
  mgEquivalent: number | null;
  display: string;
}

function parseSolidOrUnitStrength(strength?: string): ParsedSolidStrength | null {
  const raw = String(strength ?? '').trim();
  if (!raw) return null;

  const pctMatch = raw.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const val = Number(pctMatch[1]);
    if (Number.isFinite(val) && val > 0) {
      return { value: val, unit: '%', mgEquivalent: null, display: `${val}%` };
    }
  }

  const unitMatch = raw.match(/(\d+(?:\.\d+)?)\s*(mg|g|gm|mcg|µg|ug|iu)\b/i);
  if (!unitMatch) return null;
  const val = Number(unitMatch[1]);
  if (!Number.isFinite(val) || val <= 0) return null;
  const rawUnit = unitMatch[2].toLowerCase();

  if (rawUnit === 'g' || rawUnit === 'gm') {
    return { value: val, unit: 'g', mgEquivalent: val * 1000, display: `${val} g` };
  }
  if (rawUnit === 'mcg' || rawUnit === 'µg' || rawUnit === 'ug') {
    return { value: val, unit: 'mcg', mgEquivalent: val / 1000, display: `${val} mcg` };
  }
  if (rawUnit === 'iu') {
    return { value: val, unit: 'iu', mgEquivalent: null, display: `${val} IU` };
  }
  return { value: val, unit: 'mg', mgEquivalent: val, display: `${val} mg` };
}

function classifyForm(dosageForm: string, strength: string): {
  isLiquid: boolean;
  isDrops: boolean;
  isTopical: boolean;
  isOphthalmicOticNasal: boolean;
  isInhaler: boolean;
  isInjection: boolean;
  isSuppository: boolean;
  isTabletOrCap: boolean;
  formLabel: string;
} {
  const formLower = dosageForm.toLowerCase();
  const combined = `${formLower} ${strength.toLowerCase()}`;
  const isOphthalmicOticNasal = /\b(eye|ear|nasal|ophthalmic|otic)\b/i.test(combined);
  const isTopical = /\b(cream|ointment|gel|lotion|shampoo|paste|topical|dusting\s+powder)\b/i.test(
    combined
  );
  const isInhaler = /\b(inhaler|mdi|dpi|spray|nebuli|puff|rotacap|cozycap|respicap)\b/i.test(
    combined
  );
  const isInjection = /\b(inj|injection|iv|im|ampoule|vial|infusion|prefilled)\b/i.test(combined);
  const isSuppository = /\b(suppository|supp|pessary)\b/i.test(combined);
  const isLiquid =
    !isOphthalmicOticNasal &&
    !isTopical &&
    !isInjection &&
    isLiquidDosageForm(dosageForm, strength);
  const isDrops = /\b(drops?|pediatric\s+drops?|paediatric\s+drops?)\b/i.test(combined);
  const isTabletOrCap =
    !isLiquid &&
    !isTopical &&
    !isOphthalmicOticNasal &&
    !isInhaler &&
    !isInjection &&
    !isSuppository;

  const formLabel = dosageForm.trim() || (isLiquid ? 'Oral Liquid' : 'Tablet / Capsule');

  return {
    isLiquid,
    isDrops,
    isTopical,
    isOphthalmicOticNasal,
    isInhaler,
    isInjection,
    isSuppository,
    isTabletOrCap,
    formLabel,
  };
}

function isLikelyAdultOnlyClass(genericName: string, therapeuticClass: string, isLiquid: boolean): boolean {
  if (isLiquid) return false;
  const corpus = `${genericName} ${therapeuticClass}`.toLowerCase();
  return /\b(antihypertensive|statin|lipid|hyperlipid|antidiabet|hypoglycem|sulfonylurea|sglt2|dpp-?4|cardiac|antiarrhythm|anticoagulant|antiplatelet|beta-?blocker|calcium\s+channel|arb|ace\s+inhibitor|antidepressant|ssri|snri|antipsychotic|benzodiazepine|sedative|hypnotic|erectile|bph|prostate|urolog|bisphosphonate|gout|fluoroquinolone|tetracycline|cox-?2|nsaid)\b/i.test(
    corpus
  );
}

function inferClassProfile(genericName: string, therapeuticClass: string, approvedIndications: string): {
  isAntibiotic: boolean;
  isChronic: boolean;
  isPrnSymptom: boolean;
  dosesPerDay: number;
  frequencyLabel: string;
  adultFrequency: string;
  durationSummary: string;
  mealGuidance: string;
} {
  const corpus = `${genericName} ${therapeuticClass} ${approvedIndications}`.toLowerCase();

  const isAntibiotic =
    /\b(antibiotic|antibacterial|antimicrobial|cephalosporin|penicillin|macrolide|quinolone|carbapenem|aminoglycoside|infection|urti|lrti|uti|typhoid|pneumonia|otitis|sinusitis|ssti|cellulitis|pharyngitis|tonsillitis)\b/i.test(
      corpus
    );
  const isChronic =
    /\b(hypertension|diabetes|dyslipidemia|cholesterol|cardiac|heart|angina|epilepsy|thyroid|asthma\s+prophylaxis|arthritis|chronic|neuropathy|depression|anxiety)\b/i.test(
      corpus
    );
  const isPrnSymptom =
    /\b(pain|fever|analgesic|antipyretic|nsaid|allergy|antihistamine|cough|cold|nausea|vomiting|antiemetic|antispasmodic|diarrhea|constipation|acidity|gerd|ulcer|gastritis)\b/i.test(
      corpus
    );

  if (isAntibiotic) {
    return {
      isAntibiotic: true,
      isChronic: false,
      isPrnSymptom: false,
      dosesPerDay: 2,
      frequencyLabel: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর) or as prescribed',
      adultFrequency: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
      durationSummary: '5–10 days — complete full course (সাধারণত ৫–১০ দিন পূর্ণ কোর্স)',
      mealGuidance: 'Take after meal or as directed on pack insert (সাধারণত খাবার পর)',
    };
  }

  if (isChronic) {
    return {
      isAntibiotic: false,
      isChronic: true,
      isPrnSymptom: false,
      dosesPerDay: 1,
      frequencyLabel: 'OD — once daily (দিনে ১ বার)',
      adultFrequency: 'OD — once daily (দিনে ১ বার; চিকিৎসকের পরামর্শ অনুযায়ী)',
      durationSummary: 'Ongoing maintenance therapy (চিকিৎসকের পরামর্শ অনুযায়ী নিয়মিত চলবে)',
      mealGuidance: 'Take at the same time daily with water (প্রতিদিন একই সময়ে নিয়মিত সেবন করুন)',
    };
  }

  if (isPrnSymptom) {
    return {
      isAntibiotic: false,
      isChronic: false,
      isPrnSymptom: true,
      dosesPerDay: 2,
      frequencyLabel: 'BD–TDS as needed (প্রতি ৮–১২ ঘণ্টা পরপর)',
      adultFrequency: 'BD or TDS as needed (দিনে ২–৩ বার)',
      durationSummary: '3–7 days or until symptom relief (সাধারণত ৩–৭ দিন বা লক্ষণ উপশম পর্যন্ত)',
      mealGuidance: 'Take after meal unless specified pre-meal (সাধারণত খাবার পর)',
    };
  }

  return {
    isAntibiotic: false,
    isChronic: false,
    isPrnSymptom: false,
    dosesPerDay: 2,
    frequencyLabel: 'BD — every 12 hours (প্রতি ১২ ঘণ্টা পরপর)',
    adultFrequency: 'OD or BD as prescribed (দিনে ১–২ বার)',
    durationSummary: '5–14 days or per physician prescription (সাধারণত ৫–১৪ দিন বা চিকিৎসকের পরামর্শ অনুযায়ী)',
    mealGuidance: 'Take after meal with water unless otherwise advised (সাধারণত খাবার পর)',
  };
}

function roundNice(n: number): number {
  if (n >= 10) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}

function buildPediatricFromLiquidCatalog(
  liquid: ParsedLiquidStrength,
  profile: ReturnType<typeof inferClassProfile>,
  genericName: string
): DoseCalculationResult['pediatric'] {
  const dosesPerDay = profile.dosesPerDay;

  if (liquid.mgPerMl && liquid.mgPerMl > 0) {
    // Standard Bangladesh pediatric liquid presentations are formulated so a ~15–25 kg child
    // receives ~1 reference measuring unit (5 mL for syrup/suspension, or denominatorMl for drops) per dose.
    const refUnitMl = liquid.isDrops ? liquid.denominatorMl || 1 : 5;
    const refUnitMg = liquid.mgPerMl * refUnitMl;
    const refWeightMin = liquid.isDrops ? 8 : 15;
    const refWeightMax = liquid.isDrops ? 12 : 25;

    const singlePerKgMin = refUnitMg / refWeightMax;
    const singlePerKgMax = refUnitMg / refWeightMin;

    const mgPerKgPerDayMin = roundNice(singlePerKgMin * dosesPerDay);
    const mgPerKgPerDayMax = roundNice(singlePerKgMax * dosesPerDay);
    const maxSingleDoseMg = roundNice(refUnitMg * (liquid.isDrops ? 1.5 : 2));
    const maxDailyDoseMg = roundNice(maxSingleDoseMg * dosesPerDay);

    return {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin,
      mgPerKgPerDayMax,
      standardRangeLabel: `${mgPerKgPerDayMin}–${mgPerKgPerDayMax} mg/kg/day (catalog liquid reference from ${liquid.unitLabel})`,
      dosesPerDay,
      frequencyLabel: profile.frequencyLabel,
      maxDailyDoseMg,
      maxSingleDoseMg,
      maxDailyLimitLabel: `Max ${maxDailyDoseMg} mg/day (${maxSingleDoseMg} mg/dose)`,
      pediatricNotes: `Standard Catalog Reference Dose for ${genericName} (${liquid.unitLabel}) computed for exact mL arithmetic. Confirm exact mg/kg/day target with the prescribing physician or BDNF/pack insert.`,
    };
  }

  return {
    applicable: true,
    contraindicationBadge: '',
    mgPerKgPerDayMin: null,
    mgPerKgPerDayMax: null,
    standardRangeLabel: liquid.isDrops
      ? 'Age/weight-guided calibrated drops (verify pack insert)'
      : '2.5–5 mL (½–1 tsp) per dose according to age & weight',
    dosesPerDay,
    frequencyLabel: profile.frequencyLabel,
    maxDailyDoseMg: null,
    maxSingleDoseMg: null,
    maxDailyLimitLabel: 'Do not exceed physician-prescribed daily volume',
    pediatricNotes: `Standard Catalog Reference Dose for ${genericName} liquid formulation. Enter concentration as "mg/5mL" in Strength for automatic mL calculation.`,
  };
}

/**
 * Deterministic universal client-side dose calculator fallback.
 * Guarantees ALL products in the DIL Products catalog work reliably even if the live AI API
 * fails, times out, or returns an unexpected/HTML response.
 */
export function buildCatalogFallbackDoseCalculation(
  input: DoseFallbackInput
): DoseCalculationResult {
  const genericName = input.genericName.trim();
  const brandName = input.brandName?.trim() || undefined;
  const strength = input.strength?.trim() || '';
  const dosageForm = input.dosageForm?.trim() || '';
  const therapeuticClass = input.therapeuticClass?.trim() || '';
  const approvedIndications = input.approvedIndications?.trim() || '';
  const targetIndication = input.indication?.trim() || '';

  const cacheKey = buildDoseCacheKey({
    genericName,
    strength,
    dosageForm,
    weightKg: input.weightKg,
    indication: targetIndication,
    renalElderlyCaution: input.renalElderlyCaution,
  });

  const builtin = matchBuiltinGenericRule(genericName);
  const parsedIndications = parseCommaList(approvedIndications)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (builtin) {
    const indicationVariations = [...builtin.adult.indicationVariations];
    if (
      targetIndication &&
      !indicationVariations.some((v) =>
        v.toLowerCase().includes(targetIndication.toLowerCase())
      )
    ) {
      indicationVariations.unshift(
        `${targetIndication}: ${builtin.adult.standardDose} — ${builtin.adult.frequency}`
      );
    }

    return {
      cacheKey,
      genericName,
      brandName,
      strength: strength || undefined,
      dosageForm: dosageForm || undefined,
      indication: targetIndication || undefined,
      therapeuticClass: therapeuticClass || builtin.therapeuticClass,
      pediatric: { ...builtin.pediatric },
      adult: {
        ...builtin.adult,
        indicationVariations: indicationVariations.slice(0, 5),
      },
      duration: { ...builtin.duration },
      administration: { ...builtin.administration },
      safety: { ...builtin.safety },
      source: 'catalog-fallback',
      sourceLabel: STANDARD_CATALOG_REFERENCE_LABEL,
      fallbackReason: input.fallbackReason,
      generatedAt: new Date().toISOString(),
    };
  }

  // Universal deterministic catalog calculation for ANY product not in built-in rules
  const formInfo = classifyForm(dosageForm, strength);
  const liquidInfo = parseLiquidStrength(strength, dosageForm);
  const solidStrength = parseSolidOrUnitStrength(strength);
  const profile = inferClassProfile(genericName, therapeuticClass, approvedIndications);
  const adultOnly = isLikelyAdultOnlyClass(genericName, therapeuticClass, formInfo.isLiquid);

  // 1. Pediatric section
  let pediatric: DoseCalculationResult['pediatric'];
  if (adultOnly) {
    pediatric = {
      applicable: false,
      contraindicationBadge:
        'Adult Formulation — Pediatric Use Requires Specialist Confirmation (শিশুদের ক্ষেত্রে চিকিৎসকের পরামর্শ আবশ্যক)',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Adult-focused formulation; confirm pediatric safety before use',
      dosesPerDay: profile.dosesPerDay,
      frequencyLabel: 'Specialist-confirmed only',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Not routinely indicated in children',
      pediatricNotes: `${brandName || genericName} (${therapeuticClass || formInfo.formLabel}) is typically prescribed for adults. Verify pediatric eligibility and exact dosing in BDNF/pack insert.`,
    };
  } else if (formInfo.isLiquid) {
    pediatric = buildPediatricFromLiquidCatalog(liquidInfo, profile, genericName);
  } else if (formInfo.isTopical) {
    pediatric = {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: 'Apply a thin layer to the affected area (আক্রান্ত স্থানে পাতলা করে প্রলেপ দিন)',
      dosesPerDay: 2,
      frequencyLabel: 'BD — twice daily (দিনে ২ বার)',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'External topical use only; avoid large broken skin areas',
      pediatricNotes: `Standard Catalog Reference Dose for ${formInfo.formLabel}. Use sparingly in infants/children and avoid occlusive dressings unless advised.`,
    };
  } else if (formInfo.isOphthalmicOticNasal) {
    pediatric = {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: '1–2 drops into affected eye/ear/nostril (আক্রান্ত স্থানে ১–২ ফোঁটা)',
      dosesPerDay: 3,
      frequencyLabel: 'BD–QID as directed (দিনে ২–৪ বার)',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Local drop instillation only',
      pediatricNotes: `Standard Catalog Reference Dose for ${formInfo.formLabel}. Confirm pediatric age threshold on the product insert.`,
    };
  } else if (formInfo.isInhaler) {
    pediatric = {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: '1–2 puffs / actuations via spacer (স্পেসারসহ ১–২ পাফ)',
      dosesPerDay: 2,
      frequencyLabel: 'BD or PRN as prescribed (দিনে ২ বার বা প্রয়োজনে)',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Follow prescribed puff limit',
      pediatricNotes: `Standard Catalog Reference Dose for ${formInfo.formLabel}. Use with an age-appropriate spacer in children.`,
    };
  } else if (formInfo.isInjection) {
    pediatric = {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: `Weight-based hospital IV/IM dosing (${strength || formInfo.formLabel})`,
      dosesPerDay: profile.dosesPerDay,
      frequencyLabel: 'Hospital / physician-supervised parenteral schedule',
      maxDailyDoseMg: null,
      maxSingleDoseMg: null,
      maxDailyLimitLabel: 'Verify exact weight-based parenteral dose on ampoule/vial insert',
      pediatricNotes: `Parenteral formulations (${strength || formInfo.formLabel}) must be dosed by exact mg/kg under hospital/physician supervision.`,
    };
  } else {
    pediatric = {
      applicable: true,
      contraindicationBadge: '',
      mgPerKgPerDayMin: null,
      mgPerKgPerDayMax: null,
      standardRangeLabel: solidStrength
        ? `Age/weight-adjusted pediatric dose (adult unit strength: ${solidStrength.display}; prefer syrup/suspension for young children)`
        : `Age/weight-adjusted pediatric dose (prefer pediatric liquid form for children <12 yrs)`,
      dosesPerDay: profile.dosesPerDay,
      frequencyLabel: profile.frequencyLabel,
      maxDailyDoseMg: solidStrength?.mgEquivalent ? roundNice(solidStrength.mgEquivalent * profile.dosesPerDay) : null,
      maxSingleDoseMg: solidStrength?.mgEquivalent ?? null,
      maxDailyLimitLabel: solidStrength
        ? `Do not exceed adult dose (${solidStrength.display}/dose)`
        : 'Confirm weight-based pediatric dose with physician',
      pediatricNotes: `Standard Catalog Reference Dose for ${genericName} (${formInfo.formLabel}). If a DIL Suspension/Syrup strength is available below, tap "Use Strength" for exact mL calculation.`,
    };
  }

  // 2. Adult section
  let adultStandardDose: string;
  let adultMaxDailyLimit: string;
  if (formInfo.isTopical) {
    adultStandardDose = `Thin layer of ${strength ? `${strength} ` : ''}${formInfo.formLabel}`;
    adultMaxDailyLimit = '2–3 applications/day (external use only)';
  } else if (formInfo.isOphthalmicOticNasal) {
    adultStandardDose = `1–2 drops (${strength || formInfo.formLabel})`;
    adultMaxDailyLimit = 'Per prescribed ophthalmic/otic/nasal frequency';
  } else if (formInfo.isInhaler) {
    adultStandardDose = `1–2 puffs / actuations (${strength || formInfo.formLabel})`;
    adultMaxDailyLimit = 'Per prescribed daily actuation limit';
  } else if (formInfo.isLiquid) {
    adultStandardDose = liquidInfo.unitLabel
      ? `5–10 mL (${liquidInfo.unitLabel})`
      : `5–10 mL (1–2 tsp)`;
    adultMaxDailyLimit =
      liquidInfo.mgPerMl && liquidInfo.mgPerMl > 0
        ? `${roundNice(liquidInfo.mgPerMl * 10 * profile.dosesPerDay)} mg/day (reference)`
        : 'Per pack insert maximum daily volume';
  } else if (formInfo.isInjection) {
    adultStandardDose = `1 Vial / Ampoule (${strength || formInfo.formLabel}) IV/IM`;
    adultMaxDailyLimit = 'Per specialist/hospital protocol';
  } else if (formInfo.isSuppository) {
    adultStandardDose = `1 Suppository (${strength || formInfo.formLabel}) rectally`;
    adultMaxDailyLimit = 'Max 2–3 suppositories/day unless otherwise directed';
  } else {
    adultStandardDose = strength
      ? `1 ${formInfo.formLabel} (${strength})`
      : `1 ${formInfo.formLabel} (per catalog strength)`;
    adultMaxDailyLimit =
      solidStrength && solidStrength.unit !== '%'
        ? `${roundNice(solidStrength.value * Math.max(profile.dosesPerDay, 2))} ${solidStrength.unit}/day (catalog reference)`
        : 'Do not exceed physician-prescribed daily limit';
  }

  const indicationVariations: string[] = [];
  if (targetIndication) {
    indicationVariations.push(
      `${targetIndication}: ${adultStandardDose} — ${profile.adultFrequency}`
    );
  }
  for (const ind of parsedIndications) {
    if (
      targetIndication &&
      ind.toLowerCase() === targetIndication.toLowerCase()
    ) {
      continue;
    }
    indicationVariations.push(
      `${ind}: ${adultStandardDose} (${profile.adultFrequency})`
    );
    if (indicationVariations.length >= 4) break;
  }
  if (indicationVariations.length === 0) {
    indicationVariations.push(
      `Standard Approved Use: ${adultStandardDose} — ${profile.adultFrequency}`
    );
  }

  const durationByIndication =
    parsedIndications.length > 0
      ? parsedIndications
          .slice(0, 4)
          .map((ind) => `${ind}: ${profile.durationSummary}`)
      : [`General Course: ${profile.durationSummary}`];

  const reconstitutionNote = formInfo.isLiquid
    ? 'Shake bottle well before each dose; if Powder for Suspension (PFS), reconstitute with boiled & cooled water up to the mark and use within 7–14 days.'
    : formInfo.isTopical
    ? 'Clean and dry the affected area before applying a thin layer; wash hands after use.'
    : formInfo.isInhaler
    ? 'Shake inhaler well before actuation; rinse mouth with water after steroid inhalers.'
    : formInfo.isInjection
    ? 'For administration by qualified healthcare personnel only; verify diluent and IV/IM route.'
    : `Swallow ${formInfo.formLabel} with a glass of water; check pack insert if enteric-coated or sustained-release (do not crush).`;

  return {
    cacheKey,
    genericName,
    brandName,
    strength: strength || undefined,
    dosageForm: dosageForm || undefined,
    indication: targetIndication || undefined,
    therapeuticClass: therapeuticClass || 'Catalog Reference Product',
    pediatric,
    adult: {
      standardDose: adultStandardDose,
      frequency: profile.adultFrequency,
      maxDailyLimit: adultMaxDailyLimit,
      indicationVariations,
      renalElderlyNote: input.renalElderlyCaution
        ? 'Renal/Elderly Caution Active: Start at the lowest effective catalog strength and verify CrCl/eGFR dose adjustment with the prescribing physician (কিডনি বা বয়স্ক রোগীর ক্ষেত্রে সর্বনিম্ন কার্যকর মাত্রা ও চিকিৎসকের পরামর্শ জরুরি).'
        : 'Assess renal/hepatic function in elderly patients and adjust dose if CrCl <30–50 mL/min as per pack insert.',
    },
    duration: {
      summary: profile.durationSummary,
      byIndication: durationByIndication,
    },
    administration: {
      mealGuidance: profile.mealGuidance,
      reconstitutionNote,
      keyTips: [
        `Reference based on Drug International Limited catalog entry (${[brandName, strength, dosageForm].filter(Boolean).join(' · ') || genericName}).`,
        'Verify exact indication-specific titration against the official product insert or BDNF.',
      ],
    },
    safety: {
      contraindications: [
        `Known hypersensitivity to ${genericName} or any excipient in the formulation`,
        'Review concurrent medications for potential drug–drug interactions',
      ],
      pregnancyLactation:
        'Evaluate risk–benefit during pregnancy and breastfeeding; confirm safety category with a registered physician.',
      renalHepaticCaution:
        'Monitor renal and hepatic function in impaired or elderly patients; adjust interval/dose per product prescribing information.',
    },
    source: 'catalog-fallback',
    sourceLabel: STANDARD_CATALOG_REFERENCE_LABEL,
    fallbackReason: input.fallbackReason,
    generatedAt: new Date().toISOString(),
  };
}
