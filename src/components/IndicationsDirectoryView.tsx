import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  Filter,
  HeartPulse,
  Layers,
  Pill,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Stethoscope,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StickyBackBar } from './StickyBackBar';
import { WatchNowButton } from './WatchNowButton';
import { DiseaseGuideBN, Indication, Product } from '../types';
import {
  getEffectiveIndications,
  isActiveRecord,
  loadCachedDiseaseGuide,
  matchProductsForIndicationRecord,
  matchSpecialistName,
  normalizeProductGroup,
  parseClinicalIndications,
  parseCommaList,
  parsePreferredGenerics,
  productMatchesPreferredGeneric,
  saveCachedDiseaseGuide,
  scriptMatchesGenericGroup,
} from '../services/api';
import {
  buildClientDiseaseGuideBN,
  enhanceDiseaseGuideWithClientGemini,
  findMatchingMedicalKnowledgeChapter,
  formatEnhancedGuideForCopy,
  formatProductPriceCompact,
  hasClientGeminiKey,
} from '../services/diseaseGuideClient';

import { useDebouncedValue, useWindowedList } from '../hooks/useWindowedList';

interface IndicationsDirectoryViewProps {
  embedded?: boolean;
}

type DirectorySection = 'indications' | 'specialists';
type IndicationDrawerTab = 'guide' | 'specialists' | 'generics';

const WINDOW_PAGE_SIZE = 20;

interface IndicationCardProps {
  indication: Indication;
  category: string;
  specialists: string[];
  generics: string[];
  onOpen: (ind: Indication) => void;
}

const IndicationCard: React.FC<IndicationCardProps> = React.memo(
  ({ indication, category, specialists, generics, onOpen }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(indication)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(indication);
        }
      }}
      className="group cursor-pointer rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] p-4 flex flex-col justify-between transition-colors focus-visible:outline-2 focus-visible:outline-[#0E7C7B]"
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-[#0D2B45]/50 dark:text-[#EBF4FA]/50 truncate">
            {indication.Indication_ID || '—'}
          </span>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EBF4FA] text-[#0E7C7B] dark:bg-[#0E7C7B]/20 dark:text-[#8EEAE8] truncate max-w-[65%]">
            {category}
          </span>
        </div>

        <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white group-hover:text-[#0E7C7B] dark:group-hover:text-[#149A99] transition-colors mt-1.5 leading-snug">
          {indication.Indication_Name}
        </h2>

        {generics.length > 0 && (
          <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1.5 truncate">
            {generics.slice(0, 4).join(', ')}
            {generics.length > 4 ? ` +${generics.length - 4}` : ''}
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-[#0D2B45]/70 dark:text-[#EBF4FA]/75 tabular-nums min-w-0 truncate">
          <span className="font-semibold text-[#0D2B45] dark:text-white">
            {specialists.length} specialist{specialists.length === 1 ? '' : 's'}
          </span>
          <span className="mx-1.5 text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
          <span className="font-semibold text-[#0E7C7B] dark:text-[#149A99]">
            {generics.length} generic{generics.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <WatchNowButton
            videoUrl={indication.Video_URL}
            fallbackUrl={indication.YouTube_URL}
            size="compact"
          />
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] group-hover:translate-x-0.5 transition-transform whitespace-nowrap shrink-0">
            <span>Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  )
);
IndicationCard.displayName = 'IndicationCard';

export const IndicationsDirectoryView: React.FC<IndicationsDirectoryViewProps> = ({
  embedded = false,
}) => {
  const {
    dataset,
    setActiveTab,
    openProductBrief,
    openSpecialistDetail,
    openKnowledgeChapter,
    selectedSpecialistId,
    setSelectedSpecialistId,
    startDetailingFlow,
    pushToast,
  } = useApp();

  const [section, setSection] = useState<DirectorySection>('indications');
  const [searchQuery, setSearchQuery] = useState('');
  const [specialistSearch, setSpecialistSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedIndicationId, setSelectedIndicationId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<IndicationDrawerTab>('guide');
  const [drawerGenericFilter, setDrawerGenericFilter] = useState<string | null>(null);
  const [specialistGenericFilter, setSpecialistGenericFilter] = useState<string | null>(null);

  // Bengali Disease Guide state (instant client-side guide + optional cached/Gemini enhancement)
  const [enhancedGuide, setEnhancedGuide] = useState<DiseaseGuideBN | null>(null);
  const [isEnhancingGuide, setIsEnhancingGuide] = useState(false);
  const [copiedGuide, setCopiedGuide] = useState(false);
  const guideRequestSeqRef = useRef(0);

  const { indications: allIndications, isDerivedFallback } = useMemo(
    () => getEffectiveIndications(dataset),
    [dataset]
  );

  // Only display active indications by default (matching Status !== Inactive)
  const activeIndications = useMemo(
    () =>
      allIndications.filter((ind) =>
        isActiveRecord(ind as unknown as Record<string, unknown>)
      ),
    [allIndications]
  );

  // Active Specialists / Departments
  const activeDepartments = useMemo(
    () =>
      dataset.Departments.filter((dept) =>
        isActiveRecord(dept as unknown as Record<string, unknown>)
      ).sort((a, b) => a.Department_Name.localeCompare(b.Department_Name)),
    [dataset.Departments]
  );

  const enrichedDepartments = useMemo(() => {
    return activeDepartments.map((dept) => {
      const generics = parsePreferredGenerics(dept.Preferred_Generics);
      const indications = parseClinicalIndications(dept.Clinical_Indications);
      return {
        department: dept,
        generics,
        indications,
      };
    });
  }, [activeDepartments]);

  const filteredDepartments = useMemo(() => {
    const q = specialistSearch.trim().toLowerCase();
    if (!q) return enrichedDepartments;
    return enrichedDepartments.filter(({ department, generics, indications }) => {
      return (
        String(department.Department_Name ?? '').toLowerCase().includes(q) ||
        String(department.Department_ID ?? '').toLowerCase().includes(q) ||
        generics.some((g) => g.toLowerCase().includes(q)) ||
        indications.some((ind) => ind.toLowerCase().includes(q))
      );
    });
  }, [enrichedDepartments, specialistSearch]);

  const selectedDepartmentEntry = useMemo(() => {
    if (!selectedSpecialistId) return null;
    const target = selectedSpecialistId.trim().toLowerCase();
    return (
      enrichedDepartments.find(
        ({ department }) =>
          department.Department_ID.trim().toLowerCase() === target ||
          department.Department_Name.trim().toLowerCase() === target ||
          matchSpecialistName(department.Department_Name, selectedSpecialistId)
      ) || null
    );
  }, [enrichedDepartments, selectedSpecialistId]);

  const matchedProductsForSpecialist = useMemo(() => {
    if (!selectedDepartmentEntry) return [];
    const { generics } = selectedDepartmentEntry;
    if (generics.length === 0) return [];
    const seen = new Set<string>();
    const results: Product[] = [];
    for (const prod of dataset.Products) {
      if (generics.some((g) => productMatchesPreferredGeneric(prod, g))) {
        const key = prod.Product_ID || `${prod.Brand_Name}-${prod.Strength}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(prod);
        }
      }
    }
    return results;
  }, [selectedDepartmentEntry, dataset.Products]);

  const visibleSpecialistProducts = useMemo(() => {
    if (!specialistGenericFilter) return matchedProductsForSpecialist;
    return matchedProductsForSpecialist.filter((prod) =>
      productMatchesPreferredGeneric(prod, specialistGenericFilter)
    );
  }, [matchedProductsForSpecialist, specialistGenericFilter]);

  useEffect(() => {
    setSpecialistGenericFilter(null);
    if (selectedSpecialistId) {
      setSelectedIndicationId(null);
      setSection('specialists');
    }
  }, [selectedSpecialistId]);

  // Unique categories with counts sorted by count descending then alphabetically
  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ind of activeIndications) {
      const cat = String(ind.Category ?? '').trim() || 'General';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [activeIndications]);

  // Debounce indication search by 150ms for lag-free typing across all 500 indications
  const debouncedSearch = useDebouncedValue(searchQuery, 150);

  // Enrich each indication with parsed lists + precomputed search haystack
  const enrichedIndications = useMemo(() => {
    return activeIndications.map((ind) => {
      const specialists = parseCommaList(ind.Relevant_Specialists);
      const generics = parseCommaList(ind.Key_Generics);
      const category = String(ind.Category ?? '').trim() || 'General';
      const haystack = [
        ind.Indication_ID,
        ind.Indication_Name,
        category,
        ind.Relevant_Specialists,
        ind.Key_Generics,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');
      return {
        indication: ind,
        category,
        specialists,
        generics,
        haystack,
      };
    });
  }, [activeIndications]);

  const filteredIndications = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const catLower = selectedCategory.toLowerCase();
    return enrichedIndications.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category.toLowerCase() !== catLower) {
        return false;
      }
      if (!q) return true;
      return item.haystack.includes(q);
    });
  }, [enrichedIndications, debouncedSearch, selectedCategory]);

  // Render first 30 matching indication cards immediately (<100ms), auto-append 30 on scroll
  const {
    visibleItems: visibleIndications,
    hasMore: hasMoreIndications,
    remainingCount: remainingIndications,
    loadMore: loadMoreIndications,
    showAll: showAllIndications,
    sentinelRef: indicationsSentinelRef,
  } = useWindowedList(
    filteredIndications,
    `${debouncedSearch}|${selectedCategory}`,
    WINDOW_PAGE_SIZE
  );

  const selectedEntry = useMemo(() => {
    if (!selectedIndicationId) return null;
    return (
      enrichedIndications.find(
        (e) =>
          (e.indication.Indication_ID || e.indication.Indication_Name) === selectedIndicationId
      ) || null
    );
  }, [enrichedIndications, selectedIndicationId]);

  // Compute matched DIL products only for the open indication drawer (fast & accurate)
  const matchedProductsForDrawer = useMemo(() => {
    if (!selectedEntry) return [];
    return matchProductsForIndicationRecord(dataset.Products, selectedEntry.indication);
  }, [selectedEntry, dataset.Products]);

  // Match synced Medical_Knowledge Bengali chapter (e.g. UTI -> MK-23, Pneumonia -> MK-35, PCOS -> MK-31)
  const matchedKnowledgeChapter = useMemo(() => {
    if (!selectedEntry) return null;
    return findMatchingMedicalKnowledgeChapter(
      selectedEntry.indication.Indication_Name,
      selectedEntry.category,
      selectedEntry.generics,
      dataset.Medical_Knowledge || []
    );
  }, [selectedEntry, dataset.Medical_Knowledge]);

  // Instant 100% offline/online structured Bengali Disease Guide for all 500 indications
  const builtInDiseaseGuide = useMemo(() => {
    if (!selectedEntry) return null;
    return buildClientDiseaseGuideBN({
      indicationName: selectedEntry.indication.Indication_Name,
      category: selectedEntry.category,
      specialists: selectedEntry.specialists,
      keyGenerics: selectedEntry.generics,
      matchedProducts: matchedProductsForDrawer,
      matchedChapter: matchedKnowledgeChapter,
      sheetDescriptionBn: selectedEntry.indication.Description_BN,
    });
  }, [selectedEntry, matchedProductsForDrawer, matchedKnowledgeChapter]);

  // Unique top Drug International brands (with prices) for quick display inside বিস্তারিত
  const topMatchedBrandsForGuide = useMemo(() => {
    const seen = new Set<string>();
    const results: Product[] = [];
    for (const { product } of matchedProductsForDrawer) {
      const brand = String(product.Brand_Name || product.Product_Name || '').trim();
      if (!brand) continue;
      const dedupeKey = `${brand.toLowerCase()}|${String(product.Strength ?? '').toLowerCase()}|${String(product.Dosage_Form ?? '').toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      results.push(product);
      if (results.length >= 6) break;
    }
    return results;
  }, [matchedProductsForDrawer]);

  // Active guide is ALWAYS immediately available (cached AI guide if present, else instant built-in Bengali guide)
  const activeDiseaseGuide = enhancedGuide || builtInDiseaseGuide;

  // Per-generic match count inside the open drawer so each Key Generic chip shows its DIL brand count
  const drawerGenericCounts = useMemo(() => {
    if (!selectedEntry) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const g of selectedEntry.generics) {
      const count = dataset.Products.filter((p) => productMatchesPreferredGeneric(p, g)).length;
      map.set(g.toLowerCase(), count);
    }
    return map;
  }, [selectedEntry, dataset.Products]);

  // Filtered product list inside drawer if user clicked a specific Key Generic chip
  const visibleDrawerProducts = useMemo(() => {
    if (!drawerGenericFilter) return matchedProductsForDrawer;
    return matchedProductsForDrawer.filter(({ product }) =>
      productMatchesPreferredGeneric(product, drawerGenericFilter)
    );
  }, [matchedProductsForDrawer, drawerGenericFilter]);

  // Reset drawer state & hydrate any cached AI-enhanced guide when switching indications
  useEffect(() => {
    guideRequestSeqRef.current += 1;
    setDrawerGenericFilter(null);
    setCopiedGuide(false);
    setIsEnhancingGuide(false);

    if (!selectedEntry) {
      setEnhancedGuide(null);
      return;
    }

    const cached = loadCachedDiseaseGuide(selectedEntry.indication.Indication_Name);
    if (cached && cached.source === 'ai') {
      setEnhancedGuide(cached);
    } else {
      setEnhancedGuide(null);
    }
  }, [selectedEntry]);

  // Cleanup in-flight enhancement sequence on unmount
  useEffect(() => {
    return () => {
      guideRequestSeqRef.current += 1;
    };
  }, []);

  // Optional client-side Gemini enhancement on রিফ্রেশ করুন (falls back silently to built-in Bengali guide, never shows error)
  const handleRefreshDiseaseGuide = useCallback(async () => {
    if (!selectedEntry) return;
    const requestSeq = ++guideRequestSeqRef.current;
    setCopiedGuide(false);

    if (hasClientGeminiKey() && (typeof navigator === 'undefined' || navigator.onLine)) {
      setIsEnhancingGuide(true);
      const aiGuide = await enhanceDiseaseGuideWithClientGemini({
        indicationName: selectedEntry.indication.Indication_Name,
        category: selectedEntry.category,
        specialists: selectedEntry.specialists,
        keyGenerics: selectedEntry.generics,
        matchedProducts: matchedProductsForDrawer,
        matchedChapter: matchedKnowledgeChapter,
      });

      if (requestSeq !== guideRequestSeqRef.current) return;
      setIsEnhancingGuide(false);

      if (aiGuide) {
        saveCachedDiseaseGuide(selectedEntry.indication.Indication_Name, aiGuide);
        setEnhancedGuide(aiGuide);
        pushToast({
          type: 'success',
          title: 'বাংলা গাইড হালনাগাদ হয়েছে',
          message: `${selectedEntry.indication.Indication_Name} গাইড সফলভাবে সমৃদ্ধ করা হয়েছে।`,
        });
        return;
      }
    }

    // Offline or no client Gemini key or API fallback: refresh from latest synced local data cleanly
    setEnhancedGuide(null);
    pushToast({
      type: 'info',
      title: 'ক্লিনিক্যাল গাইড হালনাগাদ সম্পন্ন',
      message: `${selectedEntry.indication.Indication_Name} এর সর্বশেষ বাংলা রেফারেন্স দেখানো হচ্ছে।`,
    });
  }, [selectedEntry, matchedProductsForDrawer, matchedKnowledgeChapter, pushToast]);

  // Close open drawers on Escape key
  useEffect(() => {
    if (!selectedEntry && !selectedDepartmentEntry) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEntry) setSelectedIndicationId(null);
        if (selectedDepartmentEntry) setSelectedSpecialistId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedEntry, selectedDepartmentEntry, setSelectedSpecialistId]);

  const handleCopyGuide = async () => {
    if (!activeDiseaseGuide) return;
    const formatted = formatEnhancedGuideForCopy(
      activeDiseaseGuide,
      matchedKnowledgeChapter,
      matchedProductsForDrawer
    );
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedGuide(true);
      pushToast({
        type: 'success',
        title: 'কপি সম্পন্ন হয়েছে',
        message: `${activeDiseaseGuide.indicationName} বাংলা গাইড ক্লিপবোর্ডে কপি করা হয়েছে।`,
      });
      window.setTimeout(() => setCopiedGuide(false), 2500);
    } catch {
      pushToast({
        type: 'warning',
        title: 'কপি করা যায়নি',
        message: 'ব্রাউজার ক্লিপবোর্ড অ্যাক্সেস পাওয়া যায়নি।',
      });
    }
  };

  const getMatchingDetailingInfo = (prod: Product, specialists: string[]) => {
    const targetGeneric = String(prod.Generic_Name || prod.Brand_Name || prod.Product_Name || '').trim();
    const matchingScripts = dataset.Doctor_Product_Detailing.filter((script) =>
      scriptMatchesGenericGroup(script, targetGeneric, [prod])
    );
    const specialistScript =
      specialists.length > 0
        ? matchingScripts.find((s) =>
            specialists.some((sp) => matchSpecialistName(s.Specialist, sp))
          )
        : undefined;
    return {
      totalScripts: matchingScripts.length,
      hasSpecialistMatch: Boolean(specialistScript),
      matchedSpecialistName: specialistScript?.Specialist || specialists[0],
    };
  };

  const handleOpenIndication = useCallback((ind: Indication) => {
    setDrawerTab('guide');
    setSelectedIndicationId(ind.Indication_ID || ind.Indication_Name);
  }, []);

  return (
    <div className="space-y-4">
      {!embedded && (
        <StickyBackBar
          title="Indications & Specialists"
          subtitle={`${activeIndications.length} indications · ${activeDepartments.length} specialists`}
        />
      )}

      {/* Standalone Page Header + Section Switcher */}
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-[#0D2B45] dark:text-white tracking-tight">
              Indications &amp; Specialists
            </h1>
            <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
              Clinical conditions with Bengali Disease Guides, Specialists, Key Generics, and matching Drug International Limited products.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Indications and specialists tabs"
            className="inline-flex items-center p-1 rounded-xl bg-[#EBF4FA] dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 self-start md:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={section === 'indications'}
              onClick={() => setSection('indications')}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                section === 'indications'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4 hidden sm:block" />
              <span>Indications</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                ({activeIndications.length})
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'specialists'}
              onClick={() => setSection('specialists')}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                section === 'specialists'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <Stethoscope className="w-4 h-4 hidden sm:block" />
              <span>Specialists</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                ({activeDepartments.length})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Subtle Fallback Info Banner when derived from Departments.Clinical_Indications */}
      {section === 'indications' && isDerivedFallback && activeIndications.length > 0 && (
        <div className="rounded-2xl bg-[#EBF4FA] dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="text-[#0D2B45]/80 dark:text-[#EBF4FA]/80">
            <span className="font-semibold text-[#0D2B45] dark:text-white">
              Showing derived indications from Specialists.
            </span>{' '}
            Include <span className="font-mono">&ldquo;Indications&rdquo;</span> in your Google Apps Script{' '}
            <span className="font-mono">Code.gs</span> to sync directly from the live Indications tab.
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="inline-flex items-center gap-1 font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>View Code.gs Guide</span>
          </button>
        </div>
      )}

      {section === 'indications' ? (
        <>
      {/* Search Bar & Category Filter Controls */}
      <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search
              className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search indication name, category, specialist, or generic..."
              aria-label="Search indications directory"
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex items-center flex-1 sm:flex-initial">
              <Filter
                className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] absolute left-3 pointer-events-none"
                aria-hidden="true"
              />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter indications by category"
                className="w-full sm:w-auto min-h-[44px] pl-8 pr-8 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm font-medium text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] cursor-pointer"
              >
                <option value="ALL">All Categories ({activeIndications.length})</option>
                {categoryStats.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.count})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-mono tabular-nums text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 whitespace-nowrap">
              {filteredIndications.length} of {activeIndications.length} shown
            </span>
          </div>
        </div>

        {/* Scrollable Quick Category Filter Strip */}
        {categoryStats.length > 1 && (
          <div
            role="tablist"
            aria-label="Indication categories"
            className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'ALL'}
              onClick={() => setSelectedCategory('ALL')}
              className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:bg-[#EBF4FA] dark:hover:bg-[#133859]'
              }`}
            >
              All ({activeIndications.length})
            </button>
            {categoryStats.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  key={cat.name}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                      : 'bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:bg-[#EBF4FA] dark:hover:bg-[#133859]'
                  }`}
                >
                  {cat.name}{' '}
                  <span className="opacity-70 font-mono tabular-nums">({cat.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Indications Card Grid */}
      {activeIndications.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center">
          <ClipboardList className="w-8 h-8 text-[#0E7C7B] dark:text-[#149A99] mx-auto mb-2" />
          <p className="text-base font-display font-semibold text-[#0D2B45] dark:text-white">
            No clinical indications loaded yet
          </p>
          <p className="text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
            Sync your Google Sheet with the <span className="font-mono">Indications</span> tab or populate{' '}
            <span className="font-mono">Departments.Clinical_Indications</span>.
          </p>
        </div>
      ) : filteredIndications.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center">
          <p className="text-base font-display font-semibold text-[#0D2B45] dark:text-white">
            No matching indications found
          </p>
          <p className="text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
            Try another indication keyword, specialist, generic, or clear your category filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
            }}
            className="mt-4 min-h-[40px] px-4 py-2 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleIndications.map((item, idx) => {
              const keyId = item.indication.Indication_ID || item.indication.Indication_Name;
              return (
                <IndicationCard
                  key={`ind-card-${keyId}-${idx}`}
                  indication={item.indication}
                  category={item.category}
                  specialists={item.specialists}
                  generics={item.generics}
                  onOpen={handleOpenIndication}
                />
              );
            })}
          </div>

          {hasMoreIndications && (
            <div
              ref={indicationsSentinelRef}
              className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5"
            >
              <span className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 tabular-nums">
                Showing {visibleIndications.length} of {filteredIndications.length} indications
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadMoreIndications}
                  className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 hover:border-[#0E7C7B] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
                >
                  Load {Math.min(WINDOW_PAGE_SIZE, remainingIndications)} More
                </button>
                <button
                  type="button"
                  onClick={showAllIndications}
                  className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
                >
                  Show All ({filteredIndications.length})
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </>
      ) : (
        /* =================================================================== */
        /* SPECIALISTS DIRECTORY TAB                                           */
        /* =================================================================== */
        <div className="space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xl">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={specialistSearch}
                onChange={(e) => setSpecialistSearch(e.target.value)}
                placeholder="Search specialist department, preferred generic, or clinical indication..."
                aria-label="Search specialists directory"
                className="w-full min-h-[44px] pl-9 pr-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>
            <span className="text-xs font-mono tabular-nums text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 whitespace-nowrap">
              {filteredDepartments.length} of {activeDepartments.length} specialists
            </span>
          </div>

          {filteredDepartments.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center">
              <Stethoscope className="w-8 h-8 text-[#0E7C7B] dark:text-[#149A99] mx-auto mb-2" />
              <p className="text-base font-display font-semibold text-[#0D2B45] dark:text-white">
                No matching specialists found
              </p>
              <p className="text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                Try another department name, generic, or indication keyword.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDepartments.map(({ department, generics, indications }, idx) => (
                <button
                  key={`spec-card-${department.Department_ID}-${idx}`}
                  type="button"
                  onClick={() => setSelectedSpecialistId(department.Department_ID)}
                  className="group text-left cursor-pointer rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] p-4 flex flex-col justify-between transition-colors active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                        {department.Department_ID}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#EBF4FA] text-[#0E7C7B] dark:bg-[#0E7C7B]/20 dark:text-[#8EEAE8]">
                        Specialist
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white group-hover:text-[#0E7C7B] dark:group-hover:text-[#149A99] transition-colors mt-1.5 leading-snug">
                      {department.Department_Name}
                    </h2>
                    {generics.length > 0 && (
                      <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1.5 truncate">
                        {generics.slice(0, 4).join(', ')}
                        {generics.length > 4 ? ` +${generics.length - 4}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-[#0D2B45]/70 dark:text-[#EBF4FA]/75 tabular-nums">
                      <span className="font-semibold text-[#0D2B45] dark:text-white">
                        {indications.length} indication{indications.length === 1 ? '' : 's'}
                      </span>
                      <span className="mx-1.5 text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                      <span className="font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                        {generics.length} generic{generics.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] shrink-0">
                      <span>Open</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* INDICATION DETAIL 3-TAB SLIDE-OVER DRAWER                           */}
      {/* =================================================================== */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="indication-drawer-title"
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => setSelectedIndicationId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl h-[100dvh] sm:h-full bg-[#F4F8FC] dark:bg-[#071522] sm:border-l border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Mobile Sticky Top Back Bar */}
            <div className="sm:hidden shrink-0 bg-[#0B2239] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 pt-safe border-b border-white/10">
              <button
                type="button"
                onClick={() => setSelectedIndicationId(null)}
                className="min-h-[44px] -ml-1 px-2.5 rounded-xl text-white hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5 active:scale-[0.97]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <span className="text-xs font-mono text-[#7CE0DF] truncate">
                {selectedEntry.category}
              </span>
            </div>

            {/* Drawer Header + 3-Tab Navigation */}
            <div className="bg-white dark:bg-[#0D2235] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 shrink-0">
              <div className="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                      {selectedEntry.indication.Indication_ID || 'IND'}
                    </span>
                    <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                    <span className="px-2 py-0.5 rounded-md font-semibold bg-[#EBF4FA] text-[#0D2B45] dark:bg-[#133859] dark:text-[#EBF4FA]">
                      {selectedEntry.category}
                    </span>
                    {selectedEntry.indication.Status && (
                      <span className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                        {selectedEntry.indication.Status}
                      </span>
                    )}
                  </div>
                  <h2
                    id="indication-drawer-title"
                    className="text-lg sm:text-xl font-display font-bold text-[#0D2B45] dark:text-white mt-1 leading-snug"
                  >
                    {selectedEntry.indication.Indication_Name}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIndicationId(null)}
                  aria-label="Close indication details"
                  className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#0D2B45]/65 hover:text-[#0D2B45] dark:text-[#EBF4FA]/65 dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859] transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 3-Tab Switcher — Zero truncation on 360px phones */}
              <div className="px-3.5 sm:px-5 pb-3">
                <div
                  role="tablist"
                  aria-label="Indication detail sections"
                  className="flex items-center gap-1 p-1 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === 'guide'}
                    onClick={() => setDrawerTab('guide')}
                    className={`flex-none sm:flex-1 min-h-[40px] sm:min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      drawerTab === 'guide'
                        ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                        : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 hidden sm:block shrink-0" />
                    <span>বিস্তারিত</span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === 'specialists'}
                    onClick={() => setDrawerTab('specialists')}
                    className={`flex-1 min-h-[40px] sm:min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      drawerTab === 'specialists'
                        ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                        : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 hidden sm:block shrink-0" />
                    <span className="tabular-nums">
                      Specialists ({selectedEntry.specialists.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === 'generics'}
                    onClick={() => setDrawerTab('generics')}
                    className={`flex-1 min-h-[40px] sm:min-h-[38px] px-1.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      drawerTab === 'generics'
                        ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                        : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5 hidden sm:block shrink-0" />
                    <span className="tabular-nums">
                      Generics ({matchedProductsForDrawer.length})
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 sm:py-5 pb-10 pb-safe space-y-4">
              {/* =========================================================== */}
              {/* TAB 1: বিস্তারিত (DISEASE GUIDE) — INSTANT CLIENT BENGALI   */}
              {/* =========================================================== */}
              {drawerTab === 'guide' && activeDiseaseGuide && (
                <div className="space-y-3.5">
                  {/* Action Toolbar: Copy & Refresh */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#0D2B45] dark:text-white">
                        বিস্তারিত (Disease Guide)
                      </div>
                      <div className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                        {isEnhancingGuide
                          ? 'বাংলা ক্লিনিক্যাল গাইড হালনাগাদ হচ্ছে...'
                          : activeDiseaseGuide.source === 'sheet'
                          ? 'Google Sheet (Description_BN) · অফলাইন রেডি'
                          : activeDiseaseGuide.source === 'ai'
                          ? 'সংরক্ষিত সমৃদ্ধ বাংলা গাইড · অফলাইন রেডি'
                          : matchedKnowledgeChapter
                          ? `Medical Knowledge (${matchedKnowledgeChapter.Chapter_No}) + ক্লিনিক্যাল ডাটা`
                          : 'ক্লিনিক্যাল রেফারেন্স · তাৎক্ষণিক অফলাইন অ্যাক্সেস'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCopyGuide}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#EBF4FA] hover:bg-[#dcecf7] dark:bg-[#133859] dark:hover:bg-[#1C4A73] text-[#0D2B45] dark:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedGuide ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#8EEAE8]" />
                            <span>কপি হয়েছে</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>কপি করুন</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRefreshDiseaseGuide()}
                        disabled={isEnhancingGuide}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-55 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isEnhancingGuide ? 'animate-spin' : ''}`}
                        />
                        <span>রিফ্রেশ করুন</span>
                      </button>
                    </div>
                  </div>

                  {/* Matched Medical Knowledge Chapter Card with 1-Tap Open */}
                  {matchedKnowledgeChapter && (
                    <section className="rounded-2xl bg-emerald-50/90 dark:bg-[#0A2935] border border-[#0E7C7B]/30 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-2 py-0.5 rounded-md bg-[#0E7C7B] text-white text-[11px] font-mono font-bold shrink-0">
                            {matchedKnowledgeChapter.Chapter_No}
                          </span>
                          <span className="text-[11px] font-semibold text-[#0E7C7B] dark:text-[#8EEAE8] truncate">
                            Medical Knowledge অধ্যায় পাওয়া গেছে
                          </span>
                        </div>
                        {matchedKnowledgeChapter.Read_Time && (
                          <span className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 shrink-0">
                            {matchedKnowledgeChapter.Read_Time}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-display font-bold text-[#0D2B45] dark:text-white leading-snug">
                        {matchedKnowledgeChapter.Title_BN}
                      </h3>

                      {matchedKnowledgeChapter.Short_Summary_BN && (
                        <p className="text-xs sm:text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                          {matchedKnowledgeChapter.Short_Summary_BN}
                        </p>
                      )}

                      {matchedKnowledgeChapter.Key_Takeaway_BN && (
                        <div className="rounded-xl bg-white/85 dark:bg-[#071522]/75 border border-[#0E7C7B]/20 px-3 py-2 text-xs text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                          <span className="font-bold text-[#0E7C7B] dark:text-[#8EEAE8]">
                            মূল বার্তা:{' '}
                          </span>
                          {matchedKnowledgeChapter.Key_Takeaway_BN}
                        </div>
                      )}

                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIndicationId(null);
                            openKnowledgeChapter(
                              'medical_knowledge',
                              matchedKnowledgeChapter.Chapter_No
                            );
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0E7C7B] hover:bg-[#0B6665] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>সম্পূর্ণ অধ্যায় পড়ুন ({matchedKnowledgeChapter.Chapter_No})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <WatchNowButton
                          videoUrl={matchedKnowledgeChapter.Video_URL}
                          fallbackUrl={matchedKnowledgeChapter.YouTube_URL}
                          size="compact"
                        />
                      </div>
                    </section>
                  )}

                  {/* Quick Clinical Snapshot: Specialists, Key Generics & Available DI Brands with Prices */}
                  <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        <span>ড্রাগ ইন্টারন্যাশনাল (DI) ক্লিনিক্যাল রেফারেন্স</span>
                      </h3>
                      <span className="text-[11px] font-mono tabular-nums text-[#0E7C7B] dark:text-[#8EEAE8]">
                        {matchedProductsForDrawer.length} DI SKU
                      </span>
                    </div>

                    {/* Target Specialists & Key Generics Compact Rows */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] p-2.5 space-y-1">
                        <div className="text-[11px] font-bold text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                          টার্গেট স্পেশালিস্ট ({selectedEntry.specialists.length})
                        </div>
                        <div className="text-[#0D2B45] dark:text-white leading-relaxed">
                          {selectedEntry.specialists.length > 0
                            ? selectedEntry.specialists.slice(0, 5).join(', ') +
                              (selectedEntry.specialists.length > 5
                                ? ` (+${selectedEntry.specialists.length - 5})`
                                : '')
                            : 'সংশ্লিষ্ট চিকিৎসক বিভাগ'}
                        </div>
                      </div>

                      <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] p-2.5 space-y-1">
                        <div className="text-[11px] font-bold text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                          মূল জেনেরিকসমূহ ({selectedEntry.generics.length})
                        </div>
                        <div className="text-[#0D2B45] dark:text-white leading-relaxed">
                          {selectedEntry.generics.length > 0
                            ? selectedEntry.generics.slice(0, 5).join(', ') +
                              (selectedEntry.generics.length > 5
                                ? ` (+${selectedEntry.generics.length - 5})`
                                : '')
                            : 'নির্ধারিত জেনেরিক নেই'}
                        </div>
                      </div>
                    </div>

                    {/* Available Drug International Brands with Prices */}
                    {topMatchedBrandsForGuide.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                            উপলব্ধ DI ব্র্যান্ড ও মূল্য
                          </span>
                          {matchedProductsForDrawer.length > topMatchedBrandsForGuide.length && (
                            <button
                              type="button"
                              onClick={() => setDrawerTab('generics')}
                              className="text-[11px] font-semibold text-[#0E7C7B] dark:text-[#8EEAE8] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>সবগুলো দেখুন ({matchedProductsForDrawer.length})</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {topMatchedBrandsForGuide.map((prod) => {
                            const brandName = prod.Brand_Name || prod.Product_Name;
                            const priceLabel = formatProductPriceCompact(prod);
                            return (
                              <button
                                key={`guide-brand-${prod.Product_ID}-${brandName}`}
                                type="button"
                                onClick={() => openProductBrief(prod.Product_ID)}
                                className="text-left rounded-xl bg-[#F4F8FC] dark:bg-[#071522] hover:bg-[#EBF4FA] dark:hover:bg-[#102A42] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 px-3 py-2 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[#0D2B45] dark:text-white truncate">
                                    {brandName} {prod.Strength}
                                  </span>
                                  {prod.Dosage_Form && (
                                    <span className="text-[10px] font-medium text-[#0E7C7B] dark:text-[#8EEAE8] shrink-0">
                                      {prod.Dosage_Form}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                  <span className="text-[11px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                                    {prod.Generic_Name}
                                  </span>
                                  {priceLabel && (
                                    <span className="text-[10px] font-mono font-semibold text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 whitespace-nowrap shrink-0">
                                      {priceLabel}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* 5 Structured Pure-Bengali Clinical Cards */}
                  <div className="space-y-3.5">
                    {/* Card 1: রোগটি কী? (সংজ্ঞা / Overview) */}
                    <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 border-l-4 border-l-[#0E7C7B] p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#EBF4FA] dark:bg-[#0E7C7B]/25 text-[#0E7C7B] dark:text-[#8EEAE8] text-xs font-bold inline-flex items-center justify-center shrink-0">
                          ১
                        </span>
                        <h3 className="text-sm font-bold text-[#0D2B45] dark:text-white">
                          রোগটি কী?{' '}
                          <span className="font-normal text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                            (সংজ্ঞা / Overview)
                          </span>
                        </h3>
                      </div>
                      <p className="text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed whitespace-pre-line">
                        {activeDiseaseGuide.overview}
                      </p>
                    </section>

                    {/* Card 2: প্রধান কারণ ও ঝুঁকির দিক (Causes & Risk Factors) */}
                    {activeDiseaseGuide.causesAndRiskFactors.length > 0 && (
                      <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] text-xs font-bold inline-flex items-center justify-center shrink-0">
                            ২
                          </span>
                          <h3 className="text-sm font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>প্রধান কারণ ও ঝুঁকির দিক</span>
                            <span className="font-normal text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                              (Causes &amp; Risk Factors)
                            </span>
                          </h3>
                        </div>
                        <ul className="space-y-1.5 text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                          {activeDiseaseGuide.causesAndRiskFactors.map((item, idx) => (
                            <li key={`cause-${idx}`} className="flex items-start gap-2">
                              <span
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] mt-2 shrink-0"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Card 3: মূল লক্ষণসমূহ (Key Symptoms) */}
                    {activeDiseaseGuide.keySymptoms.length > 0 && (
                      <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] text-xs font-bold inline-flex items-center justify-center shrink-0">
                            ৩
                          </span>
                          <h3 className="text-sm font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                            <HeartPulse className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                            <span>মূল লক্ষণসমূহ</span>
                            <span className="font-normal text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                              (Key Symptoms)
                            </span>
                          </h3>
                        </div>
                        <ul className="space-y-1.5 text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                          {activeDiseaseGuide.keySymptoms.map((item, idx) => (
                            <li key={`sym-${idx}`} className="flex items-start gap-2">
                              <span
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] mt-2 shrink-0"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Card 4: প্রাথমিক করণীয়, প্রতিকার ও চিকিৎসা নীতি (Management & Prevention) */}
                    {(activeDiseaseGuide.managementAndPrevention.length > 0 ||
                      activeDiseaseGuide.specialistWarning) && (
                      <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] text-xs font-bold inline-flex items-center justify-center shrink-0">
                            ৪
                          </span>
                          <h3 className="text-sm font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                            <ShieldAlert className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                            <span>প্রাথমিক করণীয়, প্রতিকার ও চিকিৎসা নীতি</span>
                            <span className="font-normal text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                              (Management &amp; Prevention)
                            </span>
                          </h3>
                        </div>
                        <ul className="space-y-1.5 text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                          {activeDiseaseGuide.managementAndPrevention.map((item, idx) => (
                            <li key={`mgmt-${idx}`} className="flex items-start gap-2">
                              <span
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] mt-2 shrink-0"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>

                        {activeDiseaseGuide.specialistWarning && (
                          <div className="mt-2 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">বিশেষজ্ঞ পরামর্শ: </span>
                              <span>{activeDiseaseGuide.specialistWarning}</span>
                            </div>
                          </div>
                        )}
                      </section>
                    )}

                    {/* Card 5: MPO ডিটেইলিং ফোকাস (Clinical Discussion Point) */}
                    {activeDiseaseGuide.mpoDetailingFocus.length > 0 && (
                      <section className="rounded-2xl bg-[#0D2B45] dark:bg-[#0A293B] text-white border border-[#0E7C7B]/40 p-4 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-[#0E7C7B] text-white text-xs font-bold inline-flex items-center justify-center shrink-0">
                            ৫
                          </span>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <Stethoscope className="w-4 h-4 text-[#7CE0DF]" />
                            <span>MPO ডিটেইলিং ফোকাস</span>
                            <span className="font-normal text-xs text-[#EBF4FA]/75">
                              (Clinical Discussion Point)
                            </span>
                          </h3>
                        </div>
                        <ul className="space-y-2 text-sm text-[#EBF4FA]/95 leading-relaxed">
                          {activeDiseaseGuide.mpoDetailingFocus.map((item, idx) => (
                            <li key={`mpo-${idx}`} className="flex items-start gap-2">
                              <span
                                aria-hidden="true"
                                className="w-1.5 h-1.5 rounded-full bg-[#7CE0DF] mt-2 shrink-0"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================== */}
              {/* TAB 2: RELEVANT SPECIALISTS                                 */}
              {/* =========================================================== */}
              {drawerTab === 'specialists' && (
                <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                      <span>Relevant Specialists ({selectedEntry.specialists.length})</span>
                    </h3>
                    <span className="text-[11px] text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                      Click to open specialty
                    </span>
                  </div>

                  {selectedEntry.specialists.length === 0 ? (
                    <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                      No specialists mapped for this indication.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedEntry.specialists.map((specName, sIdx) => (
                        <button
                          key={`sp-${specName}-${sIdx}`}
                          type="button"
                          onClick={() => {
                            setSelectedIndicationId(null);
                            openSpecialistDetail(specName);
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] hover:bg-[#0D2B45] hover:text-white dark:hover:bg-[#0E7C7B] text-[#0D2B45] dark:text-[#EBF4FA] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span>{specName}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* =========================================================== */}
              {/* TAB 3: KEY GENERICS & MATCHING DIL PRODUCTS                 */}
              {/* =========================================================== */}
              {drawerTab === 'generics' && (
                <div className="space-y-4">
                  {/* Key Generics */}
                  <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        <span>Key Generics ({selectedEntry.generics.length})</span>
                      </h3>
                      {drawerGenericFilter ? (
                        <button
                          type="button"
                          onClick={() => setDrawerGenericFilter(null)}
                          className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                        >
                          Show All Generics
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                          Click to filter products
                        </span>
                      )}
                    </div>

                    {selectedEntry.generics.length === 0 ? (
                      <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                        No key generics listed for this indication.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedEntry.generics.map((genericName, gIdx) => {
                          const isActive =
                            drawerGenericFilter !== null &&
                            drawerGenericFilter.toLowerCase() === genericName.toLowerCase();
                          const matchCount = drawerGenericCounts.get(genericName.toLowerCase()) || 0;
                          return (
                            <button
                              key={`kg-${genericName}-${gIdx}`}
                              type="button"
                              onClick={() =>
                                setDrawerGenericFilter((prev) =>
                                  prev && prev.toLowerCase() === genericName.toLowerCase()
                                    ? null
                                    : genericName
                                )
                              }
                              aria-pressed={isActive}
                              className={`min-h-[36px] px-3 py-1 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                                isActive
                                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white border-[#0D2B45] dark:border-[#0E7C7B]'
                                  : matchCount > 0
                                  ? 'bg-[#F4F8FC] dark:bg-[#0A1F33] text-[#0D2B45] dark:text-white border-[#0E7C7B]/25 hover:border-[#0E7C7B]'
                                  : 'bg-white dark:bg-[#071522] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0D2B45]/35'
                              }`}
                            >
                              <span>{genericName}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : matchCount > 0
                                    ? 'bg-[#0E7C7B]/15 text-[#095C5B] dark:bg-[#149A99]/25 dark:text-[#8EEAE8]'
                                    : 'bg-[#0D2B45]/8 dark:bg-[#EBF4FA]/10 text-[#0D2B45]/50 dark:text-[#EBF4FA]/50'
                                }`}
                              >
                                {matchCount}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Matching Drug International Limited Products */}
                  <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 overflow-hidden">
                    <div className="px-4 py-3.5 bg-[#EBF4FA]/75 dark:bg-[#0A1C2D] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#149A99]">
                          Matching Drug International Limited Products
                        </h3>
                        <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5 tabular-nums">
                          {drawerGenericFilter
                            ? `Filtered to "${drawerGenericFilter}" · ${visibleDrawerProducts.length} product${
                                visibleDrawerProducts.length === 1 ? '' : 's'
                              }`
                            : `${visibleDrawerProducts.length} matched product${
                                visibleDrawerProducts.length === 1 ? '' : 's'
                              } via Key Generics & Approved Indications`}
                        </p>
                      </div>

                      {drawerGenericFilter && (
                        <button
                          type="button"
                          onClick={() => setDrawerGenericFilter(null)}
                          className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                        >
                          Clear Generic Filter
                        </button>
                      )}
                    </div>

                    {visibleDrawerProducts.length === 0 ? (
                      <div className="p-6 text-center space-y-1.5">
                        <p className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                          No matching Drug International Limited products found
                        </p>
                        <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                          {drawerGenericFilter
                            ? `No DIL product rows matched "${drawerGenericFilter}" in Products.Generic_Name.`
                            : 'Checked Key_Generics against Products.Generic_Name and medical keywords against Products.Approved_Indications.'}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                        {visibleDrawerProducts.map(
                          ({ product: prod, matchedViaGeneric, matchedViaIndication }, pIdx) => {
                            const brandName =
                              prod.Brand_Name || prod.Product_Name || prod.Product_ID;
                            const groupCode = normalizeProductGroup(prod.Product_Group);
                            const detailingInfo = getMatchingDetailingInfo(
                              prod,
                              selectedEntry.specialists
                            );

                            return (
                              <div
                                key={`drawer-prod-${prod.Product_ID}-${pIdx}`}
                                className="p-4 hover:bg-[#F4F8FC]/80 dark:hover:bg-[#133859]/25 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openProductBrief(prod.Product_ID)}
                                      className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white hover:text-[#0E7C7B] dark:hover:text-[#149A99] hover:underline text-left cursor-pointer"
                                    >
                                      {brandName}
                                    </button>
                                    {groupCode && (
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#0D2B45]/10 text-[#0D2B45] dark:bg-[#133859] dark:text-[#EBF4FA]">
                                        G-{groupCode}
                                      </span>
                                    )}
                                    {matchedViaGeneric && (
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[#0E7C7B]/15 text-[#095C5B] dark:bg-[#149A99]/25 dark:text-[#8EEAE8]">
                                        Key Generic
                                      </span>
                                    )}
                                    {!matchedViaGeneric && matchedViaIndication && (
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#EBF4FA] text-[#0D2B45]/75 dark:bg-[#133859]/80 dark:text-[#EBF4FA]/80">
                                        Approved Indication
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                    <span className="font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                                      {prod.Generic_Name || '—'}
                                    </span>
                                    {prod.Strength && (
                                      <>
                                        <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                                        <span className="font-semibold text-[#0D2B45]/85 dark:text-[#EBF4FA]/85">
                                          {prod.Strength}
                                        </span>
                                      </>
                                    )}
                                    {prod.Dosage_Form && (
                                      <>
                                        <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                                        <span className="text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
                                          {prod.Dosage_Form}
                                        </span>
                                      </>
                                    )}
                                    {prod.Pack_Size && (
                                      <>
                                        <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                                        <span className="font-mono text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
                                          Pack: {prod.Pack_Size}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {prod.Approved_Indications && (
                                    <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 line-clamp-2 leading-relaxed">
                                      {prod.Approved_Indications}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedIndicationId(null);
                                      startDetailingFlow({
                                        genericName: prod.Generic_Name || '',
                                        productId: prod.Product_ID,
                                        specialist: detailingInfo.matchedSpecialistName,
                                        subTab: 'detailing',
                                      });
                                    }}
                                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                                      detailingInfo.totalScripts > 0
                                        ? 'bg-[#0E7C7B] hover:bg-[#095C5B] text-white'
                                        : 'bg-[#EBF4FA] hover:bg-[#dcecf7] dark:bg-[#133859] dark:hover:bg-[#1C4A73] text-[#0D2B45] dark:text-white'
                                    }`}
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>
                                      {detailingInfo.hasSpecialistMatch
                                        ? 'Specialist Script'
                                        : detailingInfo.totalScripts > 0
                                        ? `Detailing (${detailingInfo.totalScripts})`
                                        : 'Detailing'}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SPECIALIST DETAIL DRAWER                                            */}
      {/* =================================================================== */}
      {selectedDepartmentEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="specialist-drawer-title"
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => setSelectedSpecialistId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl h-[100dvh] sm:h-full bg-[#F4F8FC] dark:bg-[#071522] sm:border-l border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Mobile Sticky Top Back Bar */}
            <div className="sm:hidden shrink-0 bg-[#0B2239] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 pt-safe border-b border-white/10">
              <button
                type="button"
                onClick={() => setSelectedSpecialistId(null)}
                className="min-h-[44px] -ml-1 px-2.5 rounded-xl text-white hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5 active:scale-[0.97]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <span className="text-xs font-mono text-[#7CE0DF] truncate">
                {selectedDepartmentEntry.department.Department_ID}
              </span>
            </div>

            {/* Header */}
            <div className="bg-white dark:bg-[#0D2235] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-4 sm:px-5 py-4 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                    {selectedDepartmentEntry.department.Department_ID}
                  </span>
                  <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                  <span className="text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 tabular-nums">
                    {matchedProductsForSpecialist.length} matching DIL product
                    {matchedProductsForSpecialist.length === 1 ? '' : 's'}
                  </span>
                </div>
                <h2
                  id="specialist-drawer-title"
                  className="text-lg sm:text-xl font-display font-bold text-[#0D2B45] dark:text-white mt-1 leading-snug"
                >
                  {selectedDepartmentEntry.department.Department_Name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSpecialistId(null)}
                aria-label="Close specialist details"
                className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#0D2B45]/65 hover:text-[#0D2B45] dark:text-[#EBF4FA]/65 dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859] transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 pb-10 pb-safe space-y-4">
              {/* Clinical Indications */}
              {selectedDepartmentEntry.indications.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#149A99]">
                    Clinical Indications ({selectedDepartmentEntry.indications.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDepartmentEntry.indications.map((indName, iIdx) => {
                      const matchedInd = activeIndications.find(
                        (item) =>
                          item.Indication_Name.trim().toLowerCase() === indName.trim().toLowerCase()
                      );
                      return (
                        <button
                          key={`spec-ind-${indName}-${iIdx}`}
                          type="button"
                          onClick={() => {
                            if (matchedInd) {
                              setSelectedSpecialistId(null);
                              setSection('indications');
                              handleOpenIndication(matchedInd);
                            } else {
                              setSelectedSpecialistId(null);
                              setSection('indications');
                              setSearchQuery(indName);
                            }
                          }}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] text-xs font-medium text-[#0D2B45] dark:text-[#EBF4FA] transition-colors cursor-pointer"
                        >
                          {indName}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Preferred Generics */}
              {selectedDepartmentEntry.generics.length > 0 && (
                <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#149A99]">
                      Preferred Generics ({selectedDepartmentEntry.generics.length})
                    </h3>
                    {specialistGenericFilter && (
                      <button
                        type="button"
                        onClick={() => setSpecialistGenericFilter(null)}
                        className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                      >
                        Show All
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDepartmentEntry.generics.map((gen, gIdx) => {
                      const active = specialistGenericFilter === gen;
                      return (
                        <button
                          key={`spec-gen-${gen}-${gIdx}`}
                          type="button"
                          onClick={() => setSpecialistGenericFilter(active ? null : gen)}
                          className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                              : 'bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73]'
                          }`}
                        >
                          {gen}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Matching DIL Products */}
              <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 overflow-hidden">
                <div className="px-4 py-3 bg-[#EBF4FA]/75 dark:bg-[#0A1C2D] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#149A99]">
                    Matching Drug International Products ({visibleSpecialistProducts.length})
                  </h3>
                </div>
                {visibleSpecialistProducts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    No matching Drug International products found for this specialist filter.
                  </div>
                ) : (
                  <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                    {visibleSpecialistProducts.map((prod, pIdx) => {
                      const brandName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
                      return (
                        <div
                          key={`spec-prod-${prod.Product_ID}-${pIdx}`}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openProductBrief(prod.Product_ID)}
                              className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white hover:text-[#0E7C7B] dark:hover:text-[#149A99] hover:underline text-left cursor-pointer"
                            >
                              {brandName}
                            </button>
                            <div className="text-xs text-[#0E7C7B] dark:text-[#149A99] font-semibold mt-0.5">
                              {prod.Generic_Name}
                              {prod.Strength ? ` · ${prod.Strength}` : ''}
                              {prod.Dosage_Form ? ` · ${prod.Dosage_Form}` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSpecialistId(null);
                              startDetailingFlow({
                                genericName: prod.Generic_Name || '',
                                productId: prod.Product_ID,
                                specialist: selectedDepartmentEntry.department.Department_Name,
                                subTab: 'detailing',
                              });
                            }}
                            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Detailing</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
