import { DiseaseGuideBN, KnowledgeChapter, Product } from '../types';
import {
  normalizeDiseaseGuideKey,
  parseSheetDescriptionBn,
} from './api';

export interface MatchedProductItem {
  product: Product;
  matchedGenerics?: string[];
}

export interface ClientDiseaseGuideInput {
  indicationName: string;
  category: string;
  specialists: string[];
  keyGenerics: string[];
  matchedProducts: MatchedProductItem[];
  matchedChapter: KnowledgeChapter | null;
  sheetDescriptionBn?: string;
}

// ============================================================================
// BILINGUAL CLINICAL SYNONYMS FOR MEDICAL KNOWLEDGE CHAPTER MATCHING
// ============================================================================

interface ClinicalConceptGroup {
  triggers: string[];
  chapterTerms: string[];
}

const CLINICAL_CONCEPT_GROUPS: ClinicalConceptGroup[] = [
  {
    triggers: ['uti', 'urinary tract', 'cystitis', 'pyelonephritis', 'urethritis', 'dysuria'],
    chapterTerms: ['uti', 'urinary', 'মূত্রনালী', 'মূত্রনালি', 'প্রস্রাব', 'ইউটিআই', 'সিস্টাইটিস', 'পাইলোনেফ্রাইটিস'],
  },
  {
    triggers: ['pneumonia', 'cap', 'hap', 'lrti', 'lower respiratory', 'bronchopneumonia'],
    chapterTerms: ['pneumonia', 'নিউমোনিয়া', 'নিউমোনিয়া', 'ফুসফুসের সংক্রমণ', 'ফুসফুস', 'এলআরটিআই'],
  },
  {
    triggers: ['pcos', 'pcod', 'polycystic ovary', 'polycystic ovarian'],
    chapterTerms: ['pcos', 'pcod', 'পিসিওএস', 'পিসিওডি', 'পলিসিস্টিক', 'ডিম্বাশয়', 'ডিম্বাশয়'],
  },
  {
    triggers: ['gerd', 'pud', 'peptic ulcer', 'gastritis', 'acid reflux', 'dyspepsia', 'heartburn', 'hyperacidity', 'h. pylori', 'helicobacter'],
    chapterTerms: ['gerd', 'pud', 'peptic', 'গ্যাস্ট্রিক', 'অ্যাসিডিটি', 'এসিডিটি', 'আলসার', 'বুকজ্বালা', 'বুক জ্বালা', 'রিফ্লাক্স', 'পাকস্থলী'],
  },
  {
    triggers: ['hypertension', 'htn', 'high blood pressure', 'essential hypertension', 'hypertensive'],
    chapterTerms: ['hypertension', 'htn', 'উচ্চ রক্তচাপ', 'হাইপারটেনশন', 'ব্লাড প্রেসার', 'রক্তচাপ'],
  },
  {
    triggers: ['diabetes', 't2dm', 't1dm', 'diabetic', 'hyperglycemia', 'mellitus', 'gdm'],
    chapterTerms: ['diabetes', 'dm', 'ডায়াবেটিস', 'ডায়াবেটিস', 'বহুমূত্র', 'ইনসুলিন', 'রক্তে শর্করা', 'ব্লাড সুগার'],
  },
  {
    triggers: ['asthma', 'bronchial asthma', 'copd', 'chronic obstructive', 'bronchitis', 'wheezing', 'bronchospasm'],
    chapterTerms: ['asthma', 'copd', 'হাঁপানি', 'অ্যাজমা', 'এজমা', 'শ্বাসকষ্ট', 'সিওপিডি', 'ব্রঙ্কাইটিস'],
  },
  {
    triggers: ['migraine', 'tension headache', 'cluster headache', 'headache'],
    chapterTerms: ['migraine', 'মাইগ্রেন', 'মাথাব্যথা', 'মাথা ব্যথা'],
  },
  {
    triggers: ['anemia', 'anaemia', 'iron deficiency', 'megaloblastic', 'thalassemia'],
    chapterTerms: ['anemia', 'anaemia', 'রক্তস্বল্পতা', 'রক্তশূন্যতা', 'অ্যানিমিয়া', 'এনিমিয়া', 'থ্যালাসেমিয়া', 'হিমোগ্লোবিন'],
  },
  {
    triggers: ['dengue', 'dengue fever', 'dhf'],
    chapterTerms: ['dengue', 'ডেঙ্গু'],
  },
  {
    triggers: ['typhoid', 'enteric fever', 'paratyphoid', 'salmonella'],
    chapterTerms: ['typhoid', 'টাইফয়েড', 'টাইফয়েড', 'এন্টেরিক'],
  },
  {
    triggers: ['thyroid', 'hypothyroidism', 'hyperthyroidism', 'goiter', 'goitre', 'graves', 'hashimoto'],
    chapterTerms: ['thyroid', 'থাইরয়েড', 'থাইরয়েড', 'হাইপোথাইরয়েড', 'হাইপোথাইরয়েড', 'হাইপারথাইরয়েড', 'গলগণ্ড'],
  },
  {
    triggers: ['osteoarthritis', 'rheumatoid arthritis', 'arthritis', 'gout', 'hyperuricemia', 'spondylitis', 'joint pain', 'back pain', 'sciatica'],
    chapterTerms: ['arthritis', 'gout', 'আর্থ্রাইটিস', 'অস্টিওআর্থ্রাইটিস', 'বাত', 'গাউট', 'ইউরিক এসিড', 'জয়েন্ট', 'হাঁটু ব্যথা', 'কোমর ব্যথা'],
  },
  {
    triggers: ['diarrhea', 'diarrhoea', 'dysentery', 'gastroenteritis', 'ibs', 'irritable bowel', 'constipation', 'amebiasis', 'amoebiasis', 'giardiasis'],
    chapterTerms: ['diarrhea', 'ibs', 'ডায়রিয়া', 'ডায়রিয়া', 'আমাশয়', 'আমাশয়', 'আইবিএস', 'কোষ্ঠকাঠিন্য', 'পাতলা পায়খানা', 'পায়খানা'],
  },
  {
    triggers: ['tuberculosis', 'pulmonary tb', 'tb'],
    chapterTerms: ['tuberculosis', 'যক্ষ্মা', 'টিবি'],
  },
  {
    triggers: ['hepatitis', 'fatty liver', 'nafld', 'cirrhosis', 'jaundice', 'hepatic', 'cholelithiasis', 'gallstone'],
    chapterTerms: ['hepatitis', 'liver', 'ফ্যাটি লিভার', 'হেপাটাইটিস', 'জন্ডিস', 'সিরোসিস', 'লিভার', 'পিত্তথলি'],
  },
  {
    triggers: ['stroke', 'cva', 'ischemic stroke', 'epilepsy', 'seizure', 'parkinson', 'neuropathy', 'vertigo', 'bell palsy', 'dementia', 'alzheimer'],
    chapterTerms: ['stroke', 'epilepsy', 'স্ট্রোক', 'মৃগীরোগ', 'মৃগী', 'এপিলেপ্সি', 'পারকিনসন', 'নিউরোপ্যাথি', 'মাথা ঘোরা', 'ভার্টিগো', 'স্নায়ু'],
  },
  {
    triggers: ['heart failure', 'chf', 'ihd', 'cad', 'coronary', 'angina', 'myocardial infarction', 'arrhythmia', 'atrial fibrillation', 'dyslipidemia', 'hyperlipidemia', 'cholesterol'],
    chapterTerms: ['heart', 'angina', 'cholesterol', 'হৃদরোগ', 'হার্ট ফেইলিউর', 'হার্ট অ্যাটাক', 'কোলেস্টেরল', 'লিপিড', 'অ্যানজাইনা', 'অ্যারিথমিয়া'],
  },
  {
    triggers: ['ckd', 'chronic kidney', 'aki', 'renal failure', 'nephrotic', 'nephrolithiasis', 'kidney stone', 'renal calculi'],
    chapterTerms: ['ckd', 'kidney', 'renal', 'কিডনি', 'পাথর', 'রেনাল', 'নেফ্রোটিক'],
  },
  {
    triggers: ['depression', 'anxiety', 'gad', 'panic', 'insomnia', 'schizophrenia', 'bipolar', 'ocd', 'stress'],
    chapterTerms: ['depression', 'anxiety', 'insomnia', 'বিষণ্ণতা', 'বিষণ্নতা', 'উদ্বেগ', 'অনিদ্রা', 'ঘুম', 'মানসিক', 'ডিপ্রেশন'],
  },
  {
    triggers: ['eczema', 'dermatitis', 'psoriasis', 'fungal', 'tinea', 'ringworm', 'candidiasis', 'scabies', 'acne', 'urticaria', 'alopecia', 'vitiligo', 'cellulitis', 'impetigo'],
    chapterTerms: ['eczema', 'psoriasis', 'fungal', 'acne', 'scabies', 'একজিমা', 'সোরিয়াসিস', 'সোরিয়াসিস', 'ফাঙ্গাল', 'দাদ', 'খোসপাঁচড়া', 'স্ক্যাবিস', 'ব্রণ', 'অ্যালার্জি', 'চর্মরোগ', 'আর্টিকেরিয়া'],
  },
  {
    triggers: ['allergic rhinitis', 'rhinitis', 'sinusitis', 'tonsillitis', 'pharyngitis', 'otitis', 'urti', 'common cold', 'cough', 'laryngitis'],
    chapterTerms: ['rhinitis', 'sinusitis', 'tonsillitis', 'otitis', 'সাইনোসাইটিস', 'টনসিল', 'রাইনাইটিস', 'সর্দি', 'কাশি', 'গলা ব্যথা', 'কান পাকা', 'কান ব্যথা'],
  },
  {
    triggers: ['conjunctivitis', 'glaucoma', 'cataract', 'dry eye', 'blepharitis', 'uveitis', 'stye'],
    chapterTerms: ['conjunctivitis', 'glaucoma', 'cataract', 'চোখ ওঠা', 'কনজাংটিভাইটিস', 'গ্লুকোমা', 'ছানি', 'ড্রাই আই', 'চোখ'],
  },
  {
    triggers: ['bph', 'benign prostatic', 'prostatitis', 'erectile dysfunction'],
    chapterTerms: ['bph', 'prostate', 'প্রোস্টেট', 'বিপিএইচ'],
  },
  {
    triggers: ['pregnancy', 'preeclampsia', 'eclampsia', 'menorrhagia', 'dysmenorrhea', 'vaginitis', 'leucorrhea', 'infertility', 'menopause', 'endometriosis', 'fibroid', 'uti in pregnancy'],
    chapterTerms: ['pregnancy', 'preeclampsia', 'menopause', 'গর্ভাবস্থা', 'গর্ভকালীন', 'মাসিক', 'সাদা স্রাব', 'বন্ধ্যাত্ব', 'মেনোপজ', 'এন্ডোমেট্রিওসিস', 'জরায়ু'],
  },
  {
    triggers: ['osteoporosis', 'osteopenia', 'vitamin d', 'rickets', 'hypocalcemia', 'muscle cramp'],
    chapterTerms: ['osteoporosis', 'vitamin d', 'অস্টিওপোরোসিস', 'হাড় ক্ষয়', 'হাড় ক্ষয়', 'ক্যালসিয়াম', 'ভিটামিন ডি'],
  },
  {
    triggers: ['malaria', 'kala-azar', 'chikungunya', 'influenza', 'covid', 'sepsis', 'helminthiasis', 'worm'],
    chapterTerms: ['malaria', 'sepsis', 'ম্যালেরিয়া', 'ম্যালেরিয়া', 'চিকুনগুনিয়া', 'ইনফ্লুয়েঞ্জা', 'কৃমি', 'সেপসিস'],
  },
  {
    triggers: ['hemorrhoids', 'piles', 'anal fissure', 'fistula'],
    chapterTerms: ['piles', 'hemorrhoid', 'পাইলস', 'অর্শ', 'ফিশার'],
  },
];

const STOP_WORDS = new Set([
  'and',
  'or',
  'of',
  'in',
  'the',
  'with',
  'for',
  'to',
  'by',
  'due',
  'type',
  'acute',
  'chronic',
  'severe',
  'mild',
  'moderate',
  'primary',
  'secondary',
  'disease',
  'disorder',
  'syndrome',
  'condition',
  'infection',
  'infections',
  'pain',
  'fever',
  'inflammation',
  'management',
  'treatment',
  'therapy',
  'general',
  'other',
  'unspecified',
  'associated',
  'related',
]);

function normalizeForMatch(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/['’"`]/g, '')
    .replace(/[^a-z0-9\u0980-\u09FF]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSignificant(text: string): string[] {
  return normalizeForMatch(text)
    .split(' ')
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok));
}

function includesWholeOrPhrase(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false;
  if (needle.length <= 3) {
    // Require token boundary for short acronyms like UTI, TB, HTN, DM, BPH, CKD, IBS, CAP
    return ` ${haystack} `.includes(` ${needle} `);
  }
  return haystack.includes(needle);
}

/**
 * Matches an Indication (name, category, key generics) against synced `Medical_Knowledge` chapters.
 * Returns the highest-confidence matched chapter, or null when no chapter is a clear clinical match.
 */
export function findMatchingMedicalKnowledgeChapter(
  indicationName: string,
  category: string,
  keyGenerics: string[],
  chapters: KnowledgeChapter[]
): KnowledgeChapter | null {
  if (!chapters || chapters.length === 0) return null;
  const activeChapters = chapters.filter((ch) => {
    const status = String(ch.Status ?? '').trim().toLowerCase();
    return !status || status === 'active';
  });
  if (activeChapters.length === 0) return null;

  const normInd = normalizeForMatch(indicationName);
  const normCat = normalizeForMatch(category);
  if (!normInd) return null;

  const indTokens = tokenizeSignificant(normInd);
  const genericTokens = keyGenerics
    .map((g) => normalizeForMatch(g).split(' ')[0])
    .filter((t) => t && t.length >= 4);

  // Find triggered bilingual concept groups for this indication
  const matchedConceptTerms = new Set<string>();
  for (const group of CLINICAL_CONCEPT_GROUPS) {
    const isHit = group.triggers.some((trig) =>
      includesWholeOrPhrase(normInd, normalizeForMatch(trig))
    );
    if (isHit) {
      group.chapterTerms.forEach((term) => matchedConceptTerms.add(normalizeForMatch(term)));
    }
  }

  let bestChapter: KnowledgeChapter | null = null;
  let bestScore = 0;

  for (const ch of activeChapters) {
    const title = normalizeForMatch(ch.Title_BN);
    const chCat = normalizeForMatch(ch.Category);
    const summary = normalizeForMatch(ch.Short_Summary_BN);
    const takeaway = normalizeForMatch(ch.Key_Takeaway_BN);
    const full = normalizeForMatch(ch.Full_Content_BN);

    let score = 0;
    let hasStrongSubjectSignal = false;

    // 1. Exact full indication phrase in title or summary
    if (normInd.length >= 3 && includesWholeOrPhrase(title, normInd)) {
      score += 90;
      hasStrongSubjectSignal = true;
    } else if (normInd.length >= 4 && includesWholeOrPhrase(summary, normInd)) {
      score += 48;
      hasStrongSubjectSignal = true;
    }

    // 2. Bilingual concept synonym match (e.g. UTI -> মূত্রনালী/ইউটিআই, Pneumonia -> নিউমোনিয়া, PCOS -> পিসিওএস)
    let conceptHitsInTitle = 0;
    let conceptHitsInBody = 0;
    matchedConceptTerms.forEach((term) => {
      if (!term) return;
      if (includesWholeOrPhrase(title, term)) {
        conceptHitsInTitle += 1;
      } else if (includesWholeOrPhrase(summary, term) || includesWholeOrPhrase(takeaway, term)) {
        conceptHitsInBody += 1;
      } else if (includesWholeOrPhrase(full, term)) {
        conceptHitsInBody += 0.5;
      }
    });

    if (conceptHitsInTitle > 0) {
      score += 62 + Math.min(conceptHitsInTitle - 1, 2) * 14;
      hasStrongSubjectSignal = true;
    } else if (conceptHitsInBody >= 1) {
      score += 34 + Math.min(conceptHitsInBody, 3) * 8;
      hasStrongSubjectSignal = true;
    }

    // 3. Direct English/Bengali significant token overlap with chapter Title_BN and summary
    let titleTokenMatches = 0;
    let summaryTokenMatches = 0;
    for (const tok of indTokens) {
      if (includesWholeOrPhrase(title, tok)) {
        titleTokenMatches += 1;
      } else if (includesWholeOrPhrase(summary, tok)) {
        summaryTokenMatches += 1;
      }
    }

    if (titleTokenMatches > 0) {
      score += titleTokenMatches * 34;
      hasStrongSubjectSignal = true;
    }
    if (summaryTokenMatches > 0) {
      score += summaryTokenMatches * 16;
      if (summaryTokenMatches >= 2 || (indTokens.length === 1 && summaryTokenMatches === 1)) {
        hasStrongSubjectSignal = true;
      }
    }

    // 4. Category alignment bonus (supportive signal, not enough alone)
    if (normCat && chCat) {
      if (chCat === normCat || chCat.includes(normCat) || normCat.includes(chCat)) {
        score += 14;
      } else {
        const catTokens = tokenizeSignificant(normCat);
        const catOverlap = catTokens.some((t) => includesWholeOrPhrase(chCat, t));
        if (catOverlap) score += 9;
      }
    }

    // 5. Key generics mentioned inside chapter body/summary
    if (genericTokens.length > 0 && (full || summary)) {
      let genericHits = 0;
      for (const gen of genericTokens) {
        if (includesWholeOrPhrase(summary, gen) || includesWholeOrPhrase(full, gen)) {
          genericHits += 1;
          if (genericHits >= 3) break;
        }
      }
      score += genericHits * 8;
    }

    if (hasStrongSubjectSignal && score >= 40 && score > bestScore) {
      bestScore = score;
      bestChapter = ch;
    }
  }

  return bestChapter;
}

// ============================================================================
// CATEGORY-AWARE BENGALI CLINICAL KNOWLEDGE TEMPLATES (100% OFFLINE COVERAGE)
// ============================================================================

interface CategoryClinicalTemplate {
  keywords: string[];
  categoryBn: string;
  overviewSuffix: string;
  causes: string[];
  symptoms: string[];
  management: string[];
}

const CATEGORY_CLINICAL_TEMPLATES: CategoryClinicalTemplate[] = [
  {
    keywords: ['infect', 'antibiot', 'antimicrob', 'bacterial', 'viral', 'fungal', 'parasit', 'sepsis', 'fever'],
    categoryBn: 'সংক্রামক রোগ ও অ্যান্টি-ইনফেক্টিভ চিকিৎসা',
    overviewSuffix:
      'এটি জীবাণুজনিত (ব্যাকটেরিয়া, ভাইরাস, ফাঙ্গাস বা পরজীবী) একটি সংক্রামক ক্লিনিক্যাল অবস্থা, যেখানে সঠিক সময়ে নির্ভুল অ্যান্টি-ইনফেক্টিভ চিকিৎসা শুরু করা অত্যন্ত গুরুত্বপূর্ণ।',
    causes: [
      'ব্যাকটেরিয়া, ভাইরাস বা ছত্রাকের সংক্রমণ এবং রোগ প্রতিরোধ ক্ষমতা কমে যাওয়া।',
      'দূষিত পানি, অপরিচ্ছন্ন পরিবেশ বা সংক্রমিত ব্যক্তির সরাসরি সংস্পর্শ।',
      'অনিয়ন্ত্রিত ডায়াবেটিস, অপুষ্টি বা অসম্পূর্ণ অ্যান্টিবায়োটিক কোর্স গ্রহণ।',
    ],
    symptoms: [
      'জ্বর, শরীর ব্যথা, দুর্বলতা ও আক্রান্ত স্থানে প্রদাহ বা অস্বস্তি।',
      'সংক্রমণের ধরন অনুযায়ী কাশি, প্রস্রাবে জ্বালাপোড়া, পাতলা পায়খানা বা ত্বকের ক্ষত।',
      'সময়মতো চিকিৎসা না হলে সংক্রমণ তীব্র আকার ধারণ করতে পারে।',
    ],
    management: [
      'চিকিৎসকের পরামর্শ অনুযায়ী সঠিক ডোজ ও পূর্ণ মেয়াদে নির্ধারিত অ্যান্টি-ইনফেক্টিভ ওষুধ সম্পন্ন করা।',
      'পর্যাপ্ত বিশ্রাম, নিরাপদ পানি ও তরল খাবার গ্রহণ এবং পরিচ্ছন্নতা বজায় রাখা।',
      'অপ্রয়োজনীয় বা অর্ধসমাপ্ত অ্যান্টিবায়োটিক ব্যবহার এড়িয়ে অ্যান্টিবায়োটিক রেজিস্ট্যান্স প্রতিরোধ করা।',
    ],
  },
  {
    keywords: ['cardio', 'heart', 'hypertens', 'vascular', 'lipid', 'coronary', 'cardiac'],
    categoryBn: 'হৃদরোগ ও রক্তসংবহনতন্ত্র (কার্ডিওলজি)',
    overviewSuffix:
      'এটি হৃদপিণ্ড ও রক্তনালী সম্পর্কিত একটি গুরুত্বপূর্ণ ক্লিনিক্যাল অবস্থা, যা দীর্ঘমেয়াদী নিয়ন্ত্রণ ও নিয়মিত ফলো-আপের মাধ্যমে জটিলতামুক্ত রাখা সম্ভব।',
    causes: [
      'উচ্চ রক্তচাপ, রক্তে অতিরিক্ত কোলেস্টেরল এবং অনিয়ন্ত্রিত ডায়াবেটিস।',
      'ধূমপান, অতিরিক্ত লবণ ও চর্বিযুক্ত খাবার, স্থূলতা এবং কায়িক পরিশ্রমের অভাব।',
      'বংশগত প্রবণতা, বয়স বৃদ্ধি এবং দীর্ঘমেয়াদী মানসিক চাপ।',
    ],
    symptoms: [
      'বুক ব্যথা, বুক ধড়ফড় করা বা শ্বাসকষ্ট অনুভূত হওয়া।',
      'মাথা ঘোরা, অতিরিক্ত ক্লান্তি বা পায়ে পানি জমে ফুলে যাওয়া।',
      'অনেক ক্ষেত্রে প্রাথমিক পর্যায়ে স্পষ্ট লক্ষণ নাও থাকতে পারে (নীরব ঝুঁকি)।',
    ],
    management: [
      'নিয়মিত রক্তচাপ, লিপিড প্রোফাইল ও ইসিজি (ECG) পরীক্ষা করে চিকিৎসা চালিয়ে যাওয়া।',
      'কম লবণ ও স্বাস্থ্যকর খাদ্যাভ্যাস, প্রতিদিন অন্তত ৩০ মিনিট হাঁটা এবং ধূমপান সম্পূর্ণ বর্জন।',
      'চিকিৎসকের পরামর্শ ছাড়া কোনো কার্ডিয়াক ওষুধ হঠাৎ বন্ধ না করা।',
    ],
  },
  {
    keywords: ['gastro', 'gi', 'liver', 'hepat', 'acid', 'ulcer', 'bowel', 'stomach', 'digest'],
    categoryBn: 'পরিপাকতন্ত্র ও লিভার (গ্যাস্ট্রোএন্টারোলজি)',
    overviewSuffix:
      'এটি পাকস্থলী, অন্ত্র বা লিভার সম্পর্কিত একটি প্রচলিত ক্লিনিক্যাল সমস্যা, যেখানে সঠিক ওষুধ ও খাদ্যাভ্যাস পরিবর্তনের মাধ্যমে দ্রুত আরোগ্য ও দীর্ঘমেয়াদী উপশম পাওয়া যায়।',
    causes: [
      'অনিয়মিত খাদ্যাভ্যাস, অতিরিক্ত তেল-মসলাযুক্ত খাবার ও দীর্ঘক্ষণ খালি পেটে থাকা।',
      'এইচ. পাইলোরি (H. pylori) বা অন্ত্রের সংক্রমণ এবং ব্যথানাশক (NSAIDs) ওষুধের দীর্ঘ ব্যবহার।',
      'ধূমপান, মানসিক চাপ, স্থূলতা বা ফ্যাটি লিভারের প্রবণতা।',
    ],
    symptoms: [
      'পেটের উপরিভাগে জ্বালাপোড়া বা ব্যথা, বুকজ্বালা ও অ্যাসিড রিফ্লাক্স।',
      'পেট ফাঁপা, বমি ভাব, ক্ষুধামন্দা বা মলত্যাগের অভ্যাসে পরিবর্তন।',
      'লিভার বা পিত্তথলির সমস্যায় জন্ডিস বা ডান দিকের পেটে ব্যথা হতে পারে।',
    ],
    management: [
      'সময়মতো সহজপাচ্য ও সুষম খাবার খাওয়া এবং ভাজাপোড়া, ক্যাফেইন ও ধূমপান পরিহার করা।',
      'চিকিৎসকের নির্দেশনা অনুযায়ী নির্ধারিত সময়ে (যেমন খাবারের আগে) গ্যাস্ট্রো-প্রোটেক্টিভ ওষুধ সেবন।',
      'রক্তবমি, কালো পায়খানা বা অতিরিক্ত ওজন কমলে দ্রুত গ্যাস্ট্রোএন্টারোলজিস্টের শরণাপন্ন হওয়া।',
    ],
  },
  {
    keywords: ['respirat', 'pulmon', 'chest', 'asthma', 'copd', 'cough', 'lung', 'allergy'],
    categoryBn: 'শ্বাসতন্ত্র ও বক্ষব্যাধি (পালমোনোলজি)',
    overviewSuffix:
      'এটি শ্বাসনালী ও ফুসফুস সম্পর্কিত একটি ক্লিনিক্যাল অবস্থা, যা সময়মতো ডায়াগনোসিস, ট্রিগার এড়িয়ে চলা এবং সঠিক ওষুধের মাধ্যমে কার্যকরভাবে নিয়ন্ত্রণ করা যায়।',
    causes: [
      'ধুলোবালি, ধোঁয়া, অ্যালার্জেন এবং বায়ুদূষণের সংস্পর্শ।',
      'ভাইরাল বা ব্যাকটেরিয়াল শ্বাসতন্ত্রের সংক্রমণ এবং ধূমপান।',
      'বংশগত অ্যালার্জির প্রবণতা ও আবহাওয়ার হঠাৎ পরিবর্তন।',
    ],
    symptoms: [
      'কাশি (শুষ্ক বা কফসহ), শ্বাসকষ্ট ও বুকে চাপ বা বাঁশির মতো শব্দ (Wheezing)।',
      'রাতের বেলা বা ভোরে শ্বাসকষ্ট ও কাশির তীব্রতা বৃদ্ধি পাওয়া।',
      'সংক্রমণ থাকলে জ্বর ও সাধারণ দুর্বলতা দেখা দেওয়া।',
    ],
    management: [
      'ধুলো, ধোঁয়া, ঠান্ডা বাতাস ও চিহ্নিত অ্যালার্জেন থেকে দূরে থাকা।',
      'চিকিৎসকের নির্দেশনা অনুযায়ী সঠিক নিয়মে ইনহেলার, ব্রঙ্কোডাইলেটর বা নির্ধারিত ওষুধ ব্যবহার।',
      'শ্বাসকষ্ট তীব্র হলে বা ঠোঁট-নখ নীলচে হয়ে গেলে জরুরি চিকিৎসা গ্রহণ।',
    ],
  },
  {
    keywords: ['gyn', 'obs', 'women', 'pregnan', 'menstru', 'ovary', 'uter', 'fertility'],
    categoryBn: 'স্ত্রীরোগ ও প্রসূতিবিদ্যা (গাইনোকোলজি)',
    overviewSuffix:
      'এটি নারীদের প্রজনন স্বাস্থ্য ও হরমোন সম্পর্কিত একটি গুরুত্বপূর্ণ ক্লিনিক্যাল অবস্থা, যার সঠিক মূল্যায়ন ও সময়মতো চিকিৎসায় জটিলতা প্রতিরোধ করা যায়।',
    causes: [
      'হরমোনজনিত ভারসাম্যহীনতা (ইস্ট্রোজেন, প্রোজেস্টেরন বা ইনসুলিন রেজিস্ট্যান্স)।',
      'প্রজননতন্ত্রে সংক্রমণ, পুষ্টি ও আয়রনের ঘাটতি বা অনিয়ন্ত্রিত ওজন।',
      'মানসিক চাপ, অনিয়মিত জীবনযাপন এবং বংশগত প্রবণতা।',
    ],
    symptoms: [
      'অনিয়মিত মাসিক, অতিরিক্ত রক্তস্রাব বা তলপেটে ব্যথা।',
      'দুর্বলতা, হরমোনজনিত পরিবর্তন বা অস্বাভাবিক স্রাব।',
      'গর্ভকালীন অবস্থায় রক্তচাপ বৃদ্ধি, পায়ে পানি আসা বা অতিরিক্ত বমি ভাব।',
    ],
    management: [
      'সুষম খাদ্য, স্বাস্থ্যকর ওজন বজায় রাখা এবং নিয়মিত শারীরিক ব্যায়াম করা।',
      'চিকিৎসকের পরামর্শ অনুযায়ী হরমোন, আয়রন-ফলিক এসিড বা নির্ধারিত চিকিৎসা সম্পন্ন করা।',
      'গর্ভকালীন যেকোনো ওষুধ অবশ্যই গাইনোকোলজিস্টের পরামর্শ ছাড়া গ্রহণ না করা।',
    ],
  },
  {
    keywords: ['neuro', 'brain', 'nerve', 'epilep', 'migraine', 'psych', 'mental', 'sleep', 'depress', 'anxiet'],
    categoryBn: 'স্নায়ুরোগ ও মানসিক স্বাস্থ্য (নিউরোলজি / সাইকিয়াট্রি)',
    overviewSuffix:
      'এটি মস্তিষ্ক, স্নায়ুতন্ত্র বা মানসিক স্বাস্থ্য সম্পর্কিত একটি সংবেদনশীল ক্লিনিক্যাল অবস্থা, যেখানে নিয়মিত ফলো-আপ, সঠিক ডোজ ও জীবনযাত্রার শৃঙ্খলা অত্যন্ত জরুরি।',
    causes: [
      'স্নায়ুকোষের সংকেত বা নিউরোট্রান্সমিটারের ভারসাম্যহীনতা।',
      'উচ্চ রক্তচাপ, ডায়াবেটিস (নিউরোপ্যাথি), ভিটামিন বি-১২ ঘাটতি বা মস্তিষ্কে রক্তপ্রবাহের বাধা।',
      'দীর্ঘমেয়াদী মানসিক চাপ, পর্যাপ্ত ঘুমের অভাব ও বংশগত কারণ।',
    ],
    symptoms: [
      'মাথাব্যথা, মাথা ঘোরা, হাত-পায়ে ঝিনঝিন করা বা অবশ ভাব।',
      'খিঁচুনি, স্মৃতিশক্তি বা মনোযোগ কমে যাওয়া, কিংবা অস্থিরতা ও ঘুমের সমস্যা।',
      'হঠাৎ মুখ বেঁকে যাওয়া, কথা জড়িয়ে যাওয়া বা শরীরের এক পাশ দুর্বল হলে জরুরি অবস্থা।',
    ],
    management: [
      'নিয়মিত ঘুমের রুটিন, মানসিক চাপ নিয়ন্ত্রণ ও সুষম পুষ্টি বজায় রাখা।',
      'চিকিৎসকের নির্ধারিত নিউরো/সাইকিয়াট্রিক ওষুধ নিয়মমাফিক গ্রহণ করা এবং নিজে থেকে হঠাৎ বন্ধ না করা।',
      'হঠাৎ তীব্র স্নায়বিক লক্ষণ দেখা দিলে অবিলম্বে বিশেষজ্ঞ হাসপাতালে নেওয়া।',
    ],
  },
  {
    keywords: ['endocrin', 'diabet', 'thyroid', 'hormon', 'metabol'],
    categoryBn: 'হরমোন ও মেটাবলিক রোগ (এন্ডোক্রাইনোলজি)',
    overviewSuffix:
      'এটি শরীরের হরমোন ও বিপাকক্রিয়া সম্পর্কিত একটি দীর্ঘমেয়াদী ক্লিনিক্যাল অবস্থা, যা নিয়মিত ল্যাব মনিটরিং, সুশৃঙ্খল খাদ্যাভ্যাস ও সঠিক ওষুধের মাধ্যমে সম্পূর্ণ নিয়ন্ত্রণে রাখা যায়।',
    causes: [
      'হরমোন নিঃসরণের ঘাটতি বা আধিক্য (যেমন ইনসুলিন বা থাইরয়েড হরমোন)।',
      'বংশগত প্রবণতা, অতিরিক্ত ওজন ও শারীরিক পরিশ্রমের অভাব।',
      'অটোইমিউন প্রক্রিয়া ও অনিয়ন্ত্রিত খাদ্যাভ্যাস।',
    ],
    symptoms: [
      'অতিরিক্ত ক্লান্তি, ওজনের অস্বাভাবিক পরিবর্তন ও তৃষ্ণা বা ক্ষুধা বেড়ে যাওয়া।',
      'ঘন ঘন প্রস্রাব, ঘুমের ব্যাঘাত, চুল পড়া বা হৃদস্পন্দনের পরিবর্তন।',
      'নিয়ন্ত্রণহীন অবস্থায় চোখ, কিডনি ও স্নায়ুর দীর্ঘমেয়াদী জটিলতা দেখা দিতে পারে।',
    ],
    management: [
      'নিয়মিত ব্লাড গ্লুকোজ / HbA1c বা থাইরয়েড প্রোফাইল (TSH, FT4) পরীক্ষা করা।',
      'পরিমিত শর্করা, আঁশযুক্ত খাবার ও প্রতিদিন নিয়মিত হাঁটা বা ব্যায়াম।',
      'নির্ধারিত ডোজে ওষুধ বা ইনসুলিন নিয়মমাফিক গ্রহণ এবং চিকিৎসকের ফলো-আপ বজায় রাখা।',
    ],
  },
  {
    keywords: ['dermat', 'skin', 'eczema', 'acne', 'psoriasis', 'allerg', 'hair'],
    categoryBn: 'চর্ম ও অ্যালার্জিজনিত রোগ (ডার্মাটোলজি)',
    overviewSuffix:
      'এটি ত্বক, চুল বা নখ সম্পর্কিত একটি ক্লিনিক্যাল অবস্থা, যেখানে সঠিক টপিক্যাল ও সিস্টেমিক চিকিৎসার পাশাপাশি ত্বকের নিয়মিত যত্ন দ্রুত আরোগ্য নিশ্চিত করে।',
    causes: [
      'ফাঙ্গাল, ব্যাকটেরিয়াল বা পরজীবী সংক্রমণ এবং অতিরিক্ত ঘাম ও আর্দ্রতা।',
      'অ্যালার্জি, রাসায়নিক পদার্থের সংস্পর্শ ও ত্বকের প্রাকৃতিক সুরক্ষা স্তরের দুর্বলতা।',
      'হরমোনজনিত পরিবর্তন, বংশগত প্রবণতা ও মানসিক চাপ।',
    ],
    symptoms: [
      'ত্বকে চুলকানি, লালচে ভাব, র‍্যাশ, ফুসকুড়ি বা আঁশ ওঠা।',
      'ত্বক শুষ্ক হয়ে ফেটে যাওয়া, জ্বালাপোড়া বা ক্ষত তৈরি হওয়া।',
      'দীর্ঘমেয়াদী সংক্রমণে ত্বকের রঙ পরিবর্তন বা ব্যথা হতে পারে।',
    ],
    management: [
      'আক্রান্ত স্থান পরিষ্কার ও শুষ্ক রাখা এবং চুলকানো থেকে বিরত থাকা।',
      'চিকিৎসকের পরামর্শ ছাড়া স্টেরয়েড মলম ব্যবহার না করা এবং পূর্ণ মেয়াদে নির্ধারিত ওষুধ চালানো।',
      'নিজের তোয়ালে, কাপড় ও প্রসাধনী আলাদা রাখা যাতে সংক্রমণ না ছড়ায়।',
    ],
  },
  {
    keywords: ['ortho', 'musculo', 'bone', 'joint', 'pain', 'rheum', 'spine', 'arthr'],
    categoryBn: 'অস্থি, সন্ধি ও ব্যথাজনিত রোগ (অর্থোপেডিক্স / রিউমাটোলজি)',
    overviewSuffix:
      'এটি হাড়, জয়েন্ট বা মাংসপেশি সম্পর্কিত একটি ক্লিনিক্যাল অবস্থা, যেখানে প্রদাহ ও ব্যথা নিয়ন্ত্রণের পাশাপাশি জয়েন্টের কর্মক্ষমতা রক্ষা করা মূল লক্ষ্য।',
    causes: [
      'বয়সজনিত জয়েন্টের ক্ষয়, ক্যালসিয়াম ও ভিটামিন ডি-এর ঘাটতি।',
      'আঘাত, ভারী কাজ, ভুল ভঙ্গিতে বসা বা অতিরিক্ত ওজনের চাপ।',
      'অটোইমিউন প্রদাহ বা রক্তে ইউরিক এসিডের মাত্রা বৃদ্ধি।',
    ],
    symptoms: [
      'জয়েন্ট, কোমর বা মাংসপেশিতে ব্যথা, ফোলা ও নড়াচড়ায় অসুবিধা।',
      'সকালে ঘুম থেকে ওঠার পর জয়েন্ট শক্ত হয়ে থাকা (Morning Stiffness)।',
      'দীর্ঘস্থায়ী ব্যথায় দৈনন্দিন কাজকর্মে সীমাবদ্ধতা সৃষ্টি হওয়া।',
    ],
    management: [
      'চিকিৎসকের পরামর্শে ব্যথানাশক, গ্যাস্ট্রো-প্রোটেকশন এবং প্রয়োজনীয় সাপ্লিমেন্ট গ্রহণ।',
      'ওজন নিয়ন্ত্রণ, সঠিক দেহভঙ্গি এবং ফিজিওথেরাপি বা হালকা স্ট্রেচিং ব্যায়াম।',
      'দীর্ঘদিন নিজে থেকে ব্যথানাশক (NSAIDs) না খেয়ে বিশেষজ্ঞের তত্ত্বাবধানে চিকিৎসা নেওয়া।',
    ],
  },
  {
    keywords: ['urol', 'nephro', 'kidney', 'renal', 'urinary', 'prostate'],
    categoryBn: 'কিডনি ও মূত্রতন্ত্র (নেফ্রোলজি / ইউরোলজি)',
    overviewSuffix:
      'এটি কিডনি ও মূত্রনালী সম্পর্কিত একটি গুরুত্বপূর্ণ ক্লিনিক্যাল অবস্থা, যেখানে দ্রুত রোগ নির্ণয় ও সঠিক চিকিৎসায় কিডনির কার্যক্ষমতা সুরক্ষিত রাখা সম্ভব।',
    causes: [
      'মূত্রনালীতে ব্যাকটেরিয়ার সংক্রমণ, কম পানি পান ও প্রস্রাব আটকে রাখা।',
      'দীর্ঘমেয়াদী অনিয়ন্ত্রিত ডায়াবেটিস, উচ্চ রক্তচাপ বা ব্যথানাশক ওষুধের অপব্যবহার।',
      'বয়সজনিত প্রোস্টেট বৃদ্ধি বা কিডনিতে পাথর জমে যাওয়া।',
    ],
    symptoms: [
      'প্রস্রাবে জ্বালাপোড়া, ঘন ঘন প্রস্রাব বা প্রস্রাবের প্রবাহ কমে যাওয়া।',
      'কোমর বা তলপেটে ব্যথা, প্রস্রাবের রঙ পরিবর্তন বা ফেনা হওয়া।',
      'কিডনি জটিলতায় চোখ-মুখ বা পা ফুলে যাওয়া এবং অতিরিক্ত দুর্বলতা।',
    ],
    management: [
      'চিকিৎসকের পরামর্শ অনুযায়ী পর্যাপ্ত নিরাপদ পানি পান (কিডনি ফেইলিউরে সীমিত তরল)।',
      'রক্তচাপ ও ডায়াবেটিস নিয়ন্ত্রণে রাখা এবং অপ্রয়োজনীয় নেফ্রোটক্সিক ওষুধ বর্জন করা।',
      'প্রস্রাব পরীক্ষা (Urine R/E, C/S) ও সিরাম ক্রিয়েটিনিন অনুযায়ী নির্দিষ্ট চিকিৎসা গ্রহণ।',
    ],
  },
  {
    keywords: ['ent', 'ear', 'nose', 'throat', 'sinus', 'tonsil', 'ophthalm', 'eye', 'ocular', 'dental'],
    categoryBn: 'নাক-কান-গলা / চক্ষু / ডেন্টাল ক্লিনিক্যাল বিভাগ',
    overviewSuffix:
      'এটি সংবেদনশীল অঙ্গ (নাক-কান-গলা, চোখ বা দাঁত) সম্পর্কিত একটি ক্লিনিক্যাল অবস্থা, যেখানে সঠিক স্থানীয় ও সিস্টেমিক চিকিৎসায় দ্রুত উপশম পাওয়া যায়।',
    causes: [
      'ব্যাকটেরিয়াল বা ভাইরাল সংক্রমণ এবং অ্যালার্জিজনিত প্রদাহ।',
      'ধুলোবালি, ঠান্ডা পরিবেশ বা সঠিক পরিচ্ছন্নতার অভাব।',
      'অনিরাপদ ড্রপ বা ঘরোয়া পদ্ধতির অসতর্ক ব্যবহার।',
    ],
    symptoms: [
      'আক্রান্ত স্থানে ব্যথা, লালচে ভাব, ফোলা বা অস্বস্তি অনুভূত হওয়া।',
      'স্রাব নির্গত হওয়া, গিলতে কষ্ট হওয়া, দৃষ্টি ঝাপসা হওয়া বা শ্রবণে অসুবিধা।',
      'সংক্রমণ বাড়লে জ্বর বা মাথাব্যথা দেখা দিতে পারে।',
    ],
    management: [
      'চিকিৎসকের পরামর্শ অনুযায়ী সঠিক ড্রপ, স্প্রে বা নির্ধারিত ওষুধ নিয়মমাফিক ব্যবহার।',
      'আক্রান্ত স্থান পরিষ্কার রাখা এবং অযাচিত স্টেরয়েড ড্রপ বা ঘরোয়া তেল ব্যবহার না করা।',
      'লক্ষণ দ্রুত না কমলে বা তীব্র ব্যথা/দৃষ্টি সমস্যা হলে অবিলম্বে বিশেষজ্ঞ দেখানো।',
    ],
  },
  {
    keywords: ['pediat', 'child', 'infant', 'neonat', 'nutrit', 'vitamin', 'hemat'],
    categoryBn: 'শিশুরোগ ও পুষ্টি/রক্তরোগ বিভাগ',
    overviewSuffix:
      'এটি শিশু বা পুষ্টি-রক্তসংক্রান্ত একটি সংবেদনশীল ক্লিনিক্যাল অবস্থা, যেখানে ওজনভিত্তিক নির্ভুল ডোজ ও সতর্ক পর্যবেক্ষণ অত্যন্ত গুরুত্বপূর্ণ।',
    causes: [
      'সংক্রমণ, অপর্যাপ্ত পুষ্টি বা প্রয়োজনীয় ভিটামিন ও খনিজের ঘাটতি।',
      'রোগ প্রতিরোধ ক্ষমতার দুর্বলতা ও পরিবেশগত সংস্পর্শ।',
      'জন্মগত বা বংশগত প্রবণতা।',
    ],
    symptoms: [
      'দুর্বলতা, খাওয়ার অরুচি, জ্বর বা ওজন বৃদ্ধিতে ধীরগতি।',
      'ফ্যাকাশে ভাব, অস্থিরতা বা নির্দিষ্ট অঙ্গভিত্তিক উপসর্গ।',
      'পানিশূন্যতা বা শ্বাসকষ্ট দেখা দিলে দ্রুত মূল্যায়ন প্রয়োজন।',
    ],
    management: [
      'শিশুদের ক্ষেত্রে অবশ্যই শরীরের ওজন (mg/kg/day) অনুযায়ী নির্ভুল ডোজ নির্ধারণ করা।',
      'সুষম পুষ্টিকর খাবার, পর্যাপ্ত তরল ও নিরাপদ পরিচ্ছন্নতা নিশ্চিত করা।',
      'কোনো বিপদচিহ্ন (তীব্র জ্বর, খিঁচুনি, শ্বাসকষ্ট বা নিস্তেজ ভাব) দেখলে দ্রুত চিকিৎসকের শরণাপন্ন হওয়া।',
    ],
  },
];

function getCategoryTemplate(category: string, indicationName: string): CategoryClinicalTemplate {
  const combined = `${category} ${indicationName}`.toLowerCase();
  for (const tpl of CATEGORY_CLINICAL_TEMPLATES) {
    if (tpl.keywords.some((kw) => combined.includes(kw))) {
      return tpl;
    }
  }
  return {
    keywords: [],
    categoryBn: category || 'সাধারণ ক্লিনিক্যাল চিকিৎসা',
    overviewSuffix:
      'এটি একটি গুরুত্বপূর্ণ ক্লিনিক্যাল অবস্থা, যা সময়মতো রোগ নির্ণয়, সঠিক ওষুধ নির্বাচন এবং চিকিৎসকের নিয়মিত ফলো-আপের মাধ্যমে কার্যকরভাবে নিয়ন্ত্রণ করা যায়।',
    causes: [
      'নির্দিষ্ট জীবাণুজনিত সংক্রমণ, প্রদাহ বা শারীরবৃত্তীয় ভারসাম্যহীনতা।',
      'অনিয়মিত জীবনযাপন, পরিবেশগত ঝুঁকি বা সহ-রোগ (যেমন ডায়াবেটিস বা উচ্চ রক্তচাপ)।',
      'বংশগত প্রবণতা এবং সময়মতো প্রাথমিক চিকিৎসা না নেওয়া।',
    ],
    symptoms: [
      'আক্রান্ত অঙ্গ বা তন্ত্রে ব্যথা, অস্বস্তি বা কার্যকারিতা কমে যাওয়া।',
      'সাধারণ দুর্বলতা, ক্লান্তি এবং রোগের তীব্রতা অনুযায়ী আনুষঙ্গিক উপসর্গ।',
      'দীর্ঘস্থায়ী হলে দৈনন্দিন স্বাভাবিক জীবনযাত্রায় ব্যাঘাত ঘটা।',
    ],
    management: [
      'সঠিক ক্লিনিক্যাল মূল্যায়ন ও প্রয়োজনীয় পরীক্ষার পর চিকিৎসকের পরামর্শে পূর্ণ মেয়াদে ওষুধ গ্রহণ।',
      'স্বাস্থ্যকর খাদ্যাভ্যাস, পর্যাপ্ত বিশ্রাম ও ঝুঁকিপূর্ণ উপাদান এড়িয়ে চলা।',
      'লক্ষণ বেড়ে গেলে বা নতুন জটিলতা দেখা দিলে দ্রুত বিশেষজ্ঞ চিকিৎসকের পরামর্শ নেওয়া।',
    ],
  };
}

function extractBulletsFromBengaliText(raw?: string, maxItems = 4): string[] {
  const cleaned = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!cleaned) return [];
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const bullets: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(?:[-•*▪▸➤]|(?:\d+|[০-৯]+)[.)])\s+(.+)$/);
    if (match && match[1]) {
      const text = match[1].trim();
      if (text.length >= 10 && text.length <= 240) {
        bullets.push(text);
        if (bullets.length >= maxItems) break;
      }
    }
  }
  return bullets;
}

export function formatProductPriceCompact(prod: Product): string {
  const single = String(prod.Single_Price ?? '').trim();
  const box = String(prod.Box_Price ?? prod.MRP_BDT ?? '').trim();
  const parts: string[] = [];
  if (single && single !== '0' && single !== '-') {
    parts.push(`৳${single}/ইউনিট`);
  }
  if (box && box !== '0' && box !== '-') {
    parts.push(`৳${box}/বক্স`);
  }
  return parts.join(' · ');
}

function buildTopBrandHighlights(matchedProducts: MatchedProductItem[], maxCount = 5): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { product } of matchedProducts) {
    const brand = String(product.Brand_Name || product.Product_Name || '').trim();
    if (!brand) continue;
    const strength = String(product.Strength ?? '').trim();
    const form = String(product.Dosage_Form ?? '').trim();
    const generic = String(product.Generic_Name ?? '').trim();
    const dedupeKey = `${brand.toLowerCase()}|${strength.toLowerCase()}|${form.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const priceStr = formatProductPriceCompact(product);
    const label = [brand, strength, form].filter(Boolean).join(' ');
    const meta = [generic, priceStr].filter(Boolean).join(' · ');
    lines.push(meta ? `${label} (${meta})` : label);
    if (lines.length >= maxCount) break;
  }
  return lines;
}

/**
 * Builds a complete, clean, copyable Bengali Disease Guide instantaneously on the client.
 * Guaranteed 100% offline/online coverage for all 500 indications with zero API failure possibility.
 */
export function buildClientDiseaseGuideBN(input: ClientDiseaseGuideInput): DiseaseGuideBN {
  const indicationName = String(input.indicationName ?? '').trim();
  const category = String(input.category ?? '').trim() || 'General';
  const key = normalizeDiseaseGuideKey(indicationName);

  // 1. If Google Sheet Description_BN already contains a complete structured JSON guide, use it directly
  const fromSheet = parseSheetDescriptionBn(indicationName, input.sheetDescriptionBn);
  if (
    fromSheet &&
    !fromSheet.rawSheetText &&
    fromSheet.overview &&
    fromSheet.causesAndRiskFactors.length > 0 &&
    fromSheet.keySymptoms.length > 0
  ) {
    return fromSheet;
  }

  const tpl = getCategoryTemplate(category, indicationName);
  const chapter = input.matchedChapter;
  const specialists = input.specialists.filter(Boolean);
  const generics = input.keyGenerics.filter(Boolean);
  const brandHighlights = buildTopBrandHighlights(input.matchedProducts, 5);

  const chapterSummary = String(chapter?.Short_Summary_BN ?? '').trim();
  const chapterTakeaway = String(chapter?.Key_Takeaway_BN ?? '').trim();
  const chapterBullets = extractBulletsFromBengaliText(chapter?.Full_Content_BN, 3);
  const rawSheetText = fromSheet?.rawSheetText ? fromSheet.rawSheetText.trim() : '';

  // Compose rich Bengali Overview
  const overviewParts: string[] = [];
  if (rawSheetText) {
    overviewParts.push(rawSheetText);
  } else if (chapterSummary) {
    overviewParts.push(chapterSummary);
    overviewParts.push(
      `${indicationName} (${tpl.categoryBn}) বিভাগে নিয়মিত চিকিৎসা করা হয় এবং সঠিক সময়ে নির্ভুল থেরাপি রোগীর দ্রুত আরোগ্য নিশ্চিত করে।`
    );
  } else {
    overviewParts.push(
      `${indicationName} হলো ${tpl.categoryBn} বিভাগের একটি গুরুত্বপূর্ণ ক্লিনিক্যাল ইন্ডিকেশন। ${tpl.overviewSuffix}`
    );
  }

  // Causes & Risk Factors
  const causesAndRiskFactors = [...tpl.causes];
  if (specialists.length > 0) {
    causesAndRiskFactors.push(
      `সংশ্লিষ্ট বিশেষজ্ঞ বিভাগ: ${specialists.slice(0, 5).join(', ')}।`
    );
  }

  // Key Symptoms (enrich with matched Medical Knowledge chapter bullet points when relevant)
  const keySymptoms =
    chapterBullets.length >= 2
      ? [...chapterBullets, ...tpl.symptoms.slice(0, 2)]
      : [...tpl.symptoms];

  // Management & Prevention (always embed Key Generics & Medical Knowledge Key Takeaway)
  const managementAndPrevention = [...tpl.management];
  if (generics.length > 0) {
    managementAndPrevention.unshift(
      `মূল ব্যবহৃত জেনেরিকসমূহ: ${generics.slice(0, 8).join(', ')}${
        generics.length > 8 ? ` (+ আরও ${generics.length - 8}টি)` : ''
      }।`
    );
  }
  if (chapterTakeaway) {
    managementAndPrevention.push(`ক্লিনিক্যাল মূল বার্তা (${chapter?.Chapter_No}): ${chapterTakeaway}`);
  }

  const specialistWarning =
    specialists.length > 0
      ? `সঠিক রোগ নির্ণয় ও ডোজ নির্ধারণের জন্য অবশ্যই রেজিস্টার্ড চিকিৎসক বা ${specialists
          .slice(0, 3)
          .join(', ')} বিশেষজ্ঞের পরামর্শ অনুসরণ করতে হবে।`
      : 'সঠিক রোগ নির্ণয় ও নিরাপদ ওষুধের ডোজ নির্ধারণের জন্য অবশ্যই রেজিস্টার্ড চিকিৎসকের পরামর্শ গ্রহণ করতে হবে।';

  // MPO Detailing Focus tailored directly to target specialists, key generics, and DI brands
  const mpoDetailingFocus: string[] = [];
  if (specialists.length > 0) {
    mpoDetailingFocus.push(
      `টার্গেট স্পেশালিস্ট ফোকাস: ${specialists
        .slice(0, 5)
        .join(', ')} চিকিৎসকদের চেম্বারে ${indicationName} কেস নিয়ে নিয়মিত ক্লিনিক্যাল আলোচনা করুন।`
    );
  }
  if (generics.length > 0) {
    mpoDetailingFocus.push(
      `মূল জেনেরিক পজিশনিং: ${generics
        .slice(0, 6)
        .join(', ')} — রোগীর উপসর্গ ও কমপ্লায়েন্স অনুযায়ী সঠিক স্ট্রেংথ ও ডোজেজ ফর্ম তুলে ধরুন।`
    );
  }
  if (brandHighlights.length > 0) {
    mpoDetailingFocus.push(
      `ড্রাগ ইন্টারন্যাশনাল (DI) ব্র্যান্ড অপশন: ${brandHighlights.join(' | ')}।`
    );
  } else {
    mpoDetailingFocus.push(
      `ড্রাগ ইন্টারন্যাশনাল (DI) পোর্টফোলিও: Generics ট্যাব থেকে সংশ্লিষ্ট মলিকিউল ও সমতুল্য ব্র্যান্ড যাচাই করে ডাক্তারের সাথে ডিটেইলিং করুন।`
    );
  }
  if (chapter) {
    mpoDetailingFocus.push(
      `রেফারেন্স অধ্যায়: Knowledge Hub-এর ${chapter.Chapter_No} (${chapter.Title_BN}) অধ্যায়টি পড়ে কল-প্রিপারেশন আরও সমৃদ্ধ করুন।`
    );
  }

  const titleBn = chapter?.Title_BN
    ? `${chapter.Title_BN} (${indicationName})`
    : `${indicationName} — বাংলা ক্লিনিক্যাল গাইড`;

  return {
    indicationKey: key,
    indicationName,
    titleBn,
    overview: overviewParts.join(' '),
    causesAndRiskFactors,
    keySymptoms,
    managementAndPrevention,
    specialistWarning,
    mpoDetailingFocus,
    source: rawSheetText ? 'sheet' : chapter ? 'knowledge' : 'local',
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// OPTIONAL CLIENT-SIDE GEMINI ENHANCEMENT (ONLY WHEN VITE_GEMINI_API_KEY IS SET)
// ============================================================================

export function hasClientGeminiKey(): boolean {
  const key = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
  return key.length > 10;
}

export async function enhanceDiseaseGuideWithClientGemini(params: {
  indicationName: string;
  category: string;
  specialists: string[];
  keyGenerics: string[];
  matchedProducts: MatchedProductItem[];
  matchedChapter: KnowledgeChapter | null;
}): Promise<DiseaseGuideBN | null> {
  const apiKey = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
  if (!apiKey) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  try {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const topBrands = buildTopBrandHighlights(params.matchedProducts, 6);
    const prompt = [
      `You are a senior clinical medical educator in Bangladesh preparing a concise, accurate, pure-Bengali (বিশুদ্ধ বাংলা) clinical reference guide for Medical Promotion Officers (MPOs) of Drug International Limited.`,
      `Indication: ${params.indicationName}`,
      `Category: ${params.category}`,
      params.specialists.length > 0 ? `Relevant Specialists: ${params.specialists.join(', ')}` : '',
      params.keyGenerics.length > 0 ? `Key Generics: ${params.keyGenerics.slice(0, 12).join(', ')}` : '',
      topBrands.length > 0 ? `Available Drug International Brands: ${topBrands.join('; ')}` : '',
      params.matchedChapter
        ? `Related Bengali Medical Knowledge Chapter (${params.matchedChapter.Chapter_No}): ${params.matchedChapter.Title_BN} — ${params.matchedChapter.Short_Summary_BN}`
        : '',
      `Return valid JSON strictly matching the schema. Write naturally in clear, professional Bengali (medical terms/brand/generic names may remain in English where standard in Bangladesh clinical practice). Keep every bullet crisp and directly actionable for field MPOs.`,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titleBn: { type: Type.STRING },
            overview: { type: Type.STRING },
            causesAndRiskFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keySymptoms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            managementAndPrevention: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            specialistWarning: { type: Type.STRING },
            mpoDetailingFocus: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'titleBn',
            'overview',
            'causesAndRiskFactors',
            'keySymptoms',
            'managementAndPrevention',
            'mpoDetailingFocus',
          ],
        },
      },
    });

    const rawText = String(response.text ?? '').trim();
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as Partial<DiseaseGuideBN>;
    const overview = String(parsed.overview ?? '').trim();
    const causes = Array.isArray(parsed.causesAndRiskFactors)
      ? parsed.causesAndRiskFactors.map((s) => String(s ?? '').trim()).filter(Boolean)
      : [];
    const symptoms = Array.isArray(parsed.keySymptoms)
      ? parsed.keySymptoms.map((s) => String(s ?? '').trim()).filter(Boolean)
      : [];
    const management = Array.isArray(parsed.managementAndPrevention)
      ? parsed.managementAndPrevention.map((s) => String(s ?? '').trim()).filter(Boolean)
      : [];
    const detailing = Array.isArray(parsed.mpoDetailingFocus)
      ? parsed.mpoDetailingFocus.map((s) => String(s ?? '').trim()).filter(Boolean)
      : [];

    if (!overview || causes.length === 0 || symptoms.length === 0) {
      return null;
    }

    return {
      indicationKey: normalizeDiseaseGuideKey(params.indicationName),
      indicationName: params.indicationName,
      titleBn: String(parsed.titleBn || params.indicationName).trim(),
      overview,
      causesAndRiskFactors: causes,
      keySymptoms: symptoms,
      managementAndPrevention: management,
      specialistWarning: parsed.specialistWarning
        ? String(parsed.specialistWarning).trim()
        : undefined,
      mpoDetailingFocus: detailing,
      source: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Never surface an error to the user — caller falls back silently to built-in Bengali guide
    return null;
  }
}

export function formatEnhancedGuideForCopy(
  guide: DiseaseGuideBN,
  matchedChapter: KnowledgeChapter | null,
  matchedProducts: MatchedProductItem[]
): string {
  const lines: string[] = [];
  const header =
    guide.titleBn && guide.titleBn.toLowerCase() !== guide.indicationName.toLowerCase()
      ? `${guide.titleBn}`
      : guide.indicationName;

  lines.push(`ক্লিনিক্যাল নির্দেশিকা: ${header}`);
  lines.push('');

  if (matchedChapter) {
    lines.push(`সম্পর্কিত Medical Knowledge অধ্যায়: ${matchedChapter.Chapter_No} — ${matchedChapter.Title_BN}`);
    if (matchedChapter.Short_Summary_BN) {
      lines.push(matchedChapter.Short_Summary_BN.trim());
    }
    lines.push('');
  }

  if (guide.overview) {
    lines.push('১. রোগটি কী? (সংজ্ঞা ও সংক্ষিপ্ত বিবরণ):');
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
      lines.push(`বিশেষজ্ঞ পরামর্শ: ${guide.specialistWarning}`);
    }
    lines.push('');
  }

  const brandHighlights = buildTopBrandHighlights(matchedProducts, 6);
  if (brandHighlights.length > 0) {
    lines.push('উপলব্ধ ড্রাগ ইন্টারন্যাশনাল (DI) ব্র্যান্ডসমূহ:');
    brandHighlights.forEach((b) => lines.push(`• ${b}`));
    lines.push('');
  }

  if (guide.mpoDetailingFocus.length > 0) {
    lines.push('৫. MPO ডিটেইলিং ফোকাস:');
    guide.mpoDetailingFocus.forEach((item) => lines.push(`• ${item}`));
  }

  return lines.join('\n').trim();
}
