import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  extractBrandBase,
  GenericGroup,
  getValidVideoUrl,
  matchSpecialistName,
  normalizeGenericKey,
  normalizeProductGroup,
  parsePreferredGenerics,
  productMatchesPreferredGeneric,
} from '../services/api';
import { NavTab, Product, PRODUCT_GROUP_CODES, ProductGroupCode } from '../types';
import { WatchNowButton } from './WatchNowButton';
import { useDebouncedValue, useWindowedList } from '../hooks/useWindowedList';

interface DoctorDetailingScope {
  doctorId?: string;
  doctorName: string;
  specialty: string;
  departmentId?: string;
  returnTab: NavTab;
}

interface SpecialtyScopedEntry {
  group: GenericGroup;
  groupCodes: ProductGroupCode[];
  brandsByGroup: Map<ProductGroupCode, string[]>;
  preferredScriptId: string | null;
  hasSpecialtyScript: boolean;
}

type ReaderLang = 'bn' | 'en';

const WINDOW_PAGE_SIZE = 20;

function formatCompactPrice(raw?: number | string): string {
  if (raw === undefined || raw === null || raw === '') return '';
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num <= 0) return '';
  const formatted = Number.isInteger(num)
    ? String(num)
    : num.toFixed(2).replace(/\.?0+$/, '');
  return `৳${formatted}`;
}

function getPrimaryBrandLabel(group: GenericGroup): string {
  if (group.brandNames.length > 0) {
    return group.brandNames.join(', ');
  }
  const firstProd = group.products[0];
  return String(firstProd?.Brand_Name || firstProd?.Product_Name || '').trim();
}

interface GenericListCardProps {
  group: GenericGroup;
  onSelect: (group: GenericGroup) => void;
}

const GenericListCard: React.FC<GenericListCardProps> = React.memo(({ group, onSelect }) => {
  const brandLabel = getPrimaryBrandLabel(group);

  return (
    <button
      type="button"
      onClick={() => onSelect(group)}
      className="w-full min-h-[52px] px-4 py-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B]/55 dark:hover:border-[#149A99]/60 flex items-center justify-between gap-3 text-left transition-colors active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
    >
      <div className="min-w-0 flex-1 truncate text-[15px] leading-snug">
        <span className="font-display font-bold text-[#0D2B45] dark:text-white">
          {group.genericName}
        </span>
        {brandLabel && (
          <>
            <span
              aria-hidden="true"
              className="mx-1.5 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 font-normal"
            >
              ·
            </span>
            <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
              {brandLabel}
            </span>
          </>
        )}
      </div>
      <ChevronRight
        aria-hidden="true"
        className="w-4 h-4 text-[#0D2B45]/40 dark:text-[#EBF4FA]/40 shrink-0"
      />
    </button>
  );
});
GenericListCard.displayName = 'GenericListCard';

export const DetailingActivitiesView: React.FC = () => {
  const {
    dataset,
    departmentMap,
    isSuperAdmin,
    genericGroups,
    prefillDetailing,
    setPrefillDetailing,
    setActiveTab,
    pushToast,
    openProductBrief,
    openAddModal,
    openEditModal,
    requestDeleteRecord,
  } = useApp();

  const [genericSearch, setGenericSearch] = useState('');
  const [selectedGenericKey, setSelectedGenericKey] = useState<string | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [readerLang, setReaderLang] = useState<ReaderLang>('bn');
  const [copied, setCopied] = useState(false);

  // Doctor-Specific Specialty & Group-Wise Detailing Scope
  const [doctorScope, setDoctorScope] = useState<DoctorDetailingScope | null>(null);
  const [selectedProductGroup, setSelectedProductGroup] = useState<'ALL' | ProductGroupCode>('ALL');
  const [scopeSearch, setScopeSearch] = useState('');

  const genericGroupByKey = useMemo(
    () => new Map(genericGroups.map((g) => [g.key, g])),
    [genericGroups]
  );

  const selectedGroup: GenericGroup | null = useMemo(
    () => (selectedGenericKey ? genericGroupByKey.get(selectedGenericKey) || null : null),
    [selectedGenericKey, genericGroupByKey]
  );

  const activeScript = useMemo(() => {
    if (!selectedGroup || selectedGroup.scripts.length === 0) return null;
    if (selectedScriptId) {
      const found = selectedGroup.scripts.find((s) => s.Detailing_ID === selectedScriptId);
      if (found) return found;
    }
    return selectedGroup.scripts[0] || null;
  }, [selectedGroup, selectedScriptId]);

  const handleExitDoctorScope = useCallback(() => {
    const targetTab = doctorScope?.returnTab || 'team';
    setDoctorScope(null);
    setSelectedProductGroup('ALL');
    setScopeSearch('');
    setSelectedGenericKey(null);
    setSelectedScriptId(null);
    setActiveTab(targetTab);
  }, [doctorScope, setActiveTab]);

  // Lock background page scroll & allow Escape to exit full-screen reader or doctor specialty view
  useEffect(() => {
    if (!selectedGroup && !doctorScope) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedGroup) {
          setSelectedGenericKey(null);
          setSelectedScriptId(null);
        } else if (doctorScope) {
          handleExitDoctorScope();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedGroup, doctorScope, handleExitDoctorScope]);

  // Reset copy state when script or language changes
  useEffect(() => {
    setCopied(false);
  }, [selectedGenericKey, activeScript?.Detailing_ID, readerLang]);

  // Auto-select available language when opening a script that only has BN or only EN
  useEffect(() => {
    if (!activeScript) return;
    const hasBn = Boolean(String(activeScript.Detailing_BN ?? '').trim());
    const hasEn = Boolean(String(activeScript.Detailing_EN ?? '').trim());
    if (readerLang === 'bn' && !hasBn && hasEn) {
      setReaderLang('en');
    } else if (readerLang === 'en' && !hasEn && hasBn) {
      setReaderLang('bn');
    }
  }, [activeScript, readerLang]);

  // Handle cross-screen navigation handoff (Dashboard, Products, Indications, Specialists, Doctors, Today's Doctors)
  useEffect(() => {
    if (!prefillDetailing) return;

    // 1. Dedicated Doctor-Specific Specialty & Group-Wise Detailing Flow
    if (prefillDetailing.scopeToDoctorSpecialty) {
      const deptFallback = prefillDetailing.departmentId
        ? departmentMap.get(prefillDetailing.departmentId)?.Department_Name || ''
        : '';
      const resolvedSpecialty = String(prefillDetailing.specialist || deptFallback || '').trim();
      setDoctorScope({
        doctorId: prefillDetailing.doctorId,
        doctorName: String(prefillDetailing.doctorName || 'Doctor').trim(),
        specialty: resolvedSpecialty || 'General',
        departmentId: prefillDetailing.departmentId,
        returnTab: prefillDetailing.returnTab || 'team',
      });
      setSelectedProductGroup('ALL');
      setScopeSearch('');
      setSelectedGenericKey(null);
      setSelectedScriptId(null);
      setPrefillDetailing(null);
      return;
    }

    // 2. Standard Direct Generic / Product Detailing Flow
    setDoctorScope(null);
    setSelectedProductGroup('ALL');
    setScopeSearch('');

    let matchedGroup: GenericGroup | undefined;

    if (prefillDetailing.genericName) {
      const targetKey = normalizeGenericKey(prefillDetailing.genericName);
      matchedGroup =
        genericGroups.find((g) => g.key === targetKey) ||
        genericGroups.find(
          (g) => g.key.includes(targetKey) || targetKey.includes(g.key)
        );
    }

    if (!matchedGroup && prefillDetailing.productId) {
      const targetPid = prefillDetailing.productId.trim().toLowerCase();
      matchedGroup = genericGroups.find((g) =>
        g.productIds.some((id) => id.toLowerCase() === targetPid)
      );
    }

    if (matchedGroup) {
      setSelectedGenericKey(matchedGroup.key);
      if (prefillDetailing.specialist) {
        const matchedScript = matchedGroup.scripts.find((s) =>
          matchSpecialistName(s.Specialist, prefillDetailing.specialist)
        );
        setSelectedScriptId(
          matchedScript?.Detailing_ID || matchedGroup.scripts[0]?.Detailing_ID || null
        );
      } else {
        setSelectedScriptId(matchedGroup.scripts[0]?.Detailing_ID || null);
      }
    } else if (!prefillDetailing.genericName && !prefillDetailing.productId) {
      setSelectedGenericKey(null);
      setSelectedScriptId(null);
    }

    setPrefillDetailing(null);
  }, [prefillDetailing, genericGroups, departmentMap, setPrefillDetailing]);

  // Keep selectedScriptId valid if scripts are edited/deleted
  useEffect(() => {
    if (!selectedGroup) return;
    if (selectedGroup.scripts.length === 0) {
      if (selectedScriptId !== null) setSelectedScriptId(null);
      return;
    }
    if (
      !selectedScriptId ||
      !selectedGroup.scripts.some((s) => s.Detailing_ID === selectedScriptId)
    ) {
      setSelectedScriptId(selectedGroup.scripts[0].Detailing_ID);
    }
  }, [selectedGroup, selectedScriptId]);

  const debouncedSearch = useDebouncedValue(genericSearch, 140);

  const indexedGenericGroups = useMemo(
    () =>
      genericGroups.map((group) => ({
        group,
        haystack: [
          group.genericName,
          ...group.brandNames,
          ...group.therapeuticClasses,
          ...group.products.flatMap((p) => [
            p.Brand_Name,
            p.Product_Name,
            p.Strength,
            p.Dosage_Form,
            p.Product_ID,
          ]),
          ...group.scripts.map((s) => s.Specialist),
        ]
          .map((v) => String(v ?? '').toLowerCase())
          .join(' '),
      })),
    [genericGroups]
  );

  const filteredGenericGroups = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return genericGroups;
    return indexedGenericGroups
      .filter(({ haystack }) => haystack.includes(q))
      .map(({ group }) => group);
  }, [genericGroups, indexedGenericGroups, debouncedSearch]);

  const {
    visibleItems: visibleGenericGroups,
    hasMore: hasMoreGenerics,
    remainingCount: remainingGenerics,
    loadMore: loadMoreGenerics,
    sentinelRef: genericsSentinelRef,
  } = useWindowedList(filteredGenericGroups, debouncedSearch, WINDOW_PAGE_SIZE);

  // =========================================================================
  // DOCTOR-SPECIFIC SPECIALTY & PRODUCT-GROUP FILTERING
  // Strictly scoped to THAT doctor's Specialty via:
  //   1) Departments.Preferred_Generics -> matched Drug International Products
  //   2) Doctor_Product_Detailing.Specialist -> matched GenericGroups & Products
  // =========================================================================
  const specialtyScopedEntries = useMemo<SpecialtyScopedEntry[]>(() => {
    if (!doctorScope) return [];

    const matchedDepts = (dataset.Departments || []).filter((dept) => {
      if (
        doctorScope.departmentId &&
        dept.Department_ID &&
        dept.Department_ID.trim().toLowerCase() === doctorScope.departmentId.trim().toLowerCase()
      ) {
        return true;
      }
      return Boolean(
        doctorScope.specialty && matchSpecialistName(dept.Department_Name, doctorScope.specialty)
      );
    });

    const specialistTargets = Array.from(
      new Set(
        [doctorScope.specialty, ...matchedDepts.map((d) => d.Department_Name)]
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
      )
    );

    const preferredGenerics: string[] = [];
    const preferredKeys = new Set<string>();
    for (const dept of matchedDepts) {
      for (const gen of parsePreferredGenerics(dept.Preferred_Generics)) {
        const k = normalizeGenericKey(gen);
        if (k && !preferredKeys.has(k)) {
          preferredKeys.add(k);
          preferredGenerics.push(gen);
        }
      }
    }

    const entries: SpecialtyScopedEntry[] = [];

    for (const group of genericGroups) {
      const matchedSpecialistScript = group.scripts.find(
        (s) =>
          (doctorScope.doctorId && s.Doctor_ID && s.Doctor_ID === doctorScope.doctorId) ||
          specialistTargets.some((target) => matchSpecialistName(s.Specialist, target))
      );

      let matchesPreferred = false;
      if (preferredGenerics.length > 0) {
        if (preferredKeys.has(group.key)) {
          matchesPreferred = true;
        } else if (
          group.products.some((prod) =>
            preferredGenerics.some((pref) => productMatchesPreferredGeneric(prod, pref))
          )
        ) {
          matchesPreferred = true;
        } else {
          const syntheticProd = { Generic_Name: group.genericName } as Product;
          matchesPreferred = preferredGenerics.some((pref) =>
            productMatchesPreferredGeneric(syntheticProd, pref)
          );
        }
      }

      if (!matchedSpecialistScript && !matchesPreferred) continue;

      const groupCodeSet = new Set<ProductGroupCode>();
      const brandsByGroup = new Map<ProductGroupCode, string[]>();

      for (const prod of group.products) {
        const code = normalizeProductGroup(prod.Product_Group);
        if (!code) continue;
        groupCodeSet.add(code);
        const brandLabel =
          extractBrandBase(prod.Brand_Name || prod.Product_Name) ||
          String(prod.Brand_Name || prod.Product_Name || '').trim();
        if (brandLabel) {
          const existing = brandsByGroup.get(code) || [];
          if (!existing.some((b) => b.toLowerCase() === brandLabel.toLowerCase())) {
            existing.push(brandLabel);
            brandsByGroup.set(code, existing);
          }
        }
      }

      const groupCodes = PRODUCT_GROUP_CODES.filter((code) => groupCodeSet.has(code));

      entries.push({
        group,
        groupCodes,
        brandsByGroup,
        preferredScriptId:
          matchedSpecialistScript?.Detailing_ID || group.scripts[0]?.Detailing_ID || null,
        hasSpecialtyScript: Boolean(matchedSpecialistScript),
      });
    }

    return entries.sort((a, b) => {
      if (a.group.products.length > 0 !== b.group.products.length > 0) {
        return a.group.products.length > 0 ? -1 : 1;
      }
      if (a.hasSpecialtyScript !== b.hasSpecialtyScript) {
        return a.hasSpecialtyScript ? -1 : 1;
      }
      return a.group.genericName.localeCompare(b.group.genericName);
    });
  }, [doctorScope, dataset.Departments, genericGroups]);

  // Only show Product Groups (G-A, G-B, G-C, ...) that have >= 1 product for THIS specialty
  const availableSpecialtyProductGroups = useMemo(() => {
    const counts = new Map<ProductGroupCode, number>();
    for (const entry of specialtyScopedEntries) {
      for (const code of entry.groupCodes) {
        counts.set(code, (counts.get(code) || 0) + 1);
      }
    }
    return PRODUCT_GROUP_CODES.filter((code) => (counts.get(code) || 0) > 0).map((code) => ({
      code,
      count: counts.get(code) || 0,
    }));
  }, [specialtyScopedEntries]);

  const debouncedScopeSearch = useDebouncedValue(scopeSearch, 120);

  const filteredSpecialtyEntries = useMemo(() => {
    const q = debouncedScopeSearch.trim().toLowerCase();
    return specialtyScopedEntries.filter((entry) => {
      if (selectedProductGroup !== 'ALL' && !entry.groupCodes.includes(selectedProductGroup)) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        entry.group.genericName,
        ...entry.group.brandNames,
        ...entry.group.products.map((p) => `${p.Brand_Name || p.Product_Name || ''} ${p.Strength || ''}`),
        ...entry.groupCodes.map((c) => `g-${c} group ${c}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [specialtyScopedEntries, selectedProductGroup, debouncedScopeSearch]);

  const handleSelectScopedEntry = useCallback((entry: SpecialtyScopedEntry) => {
    setSelectedGenericKey(entry.group.key);
    setSelectedScriptId(entry.preferredScriptId || entry.group.scripts[0]?.Detailing_ID || null);
    setReaderLang('bn');
  }, []);

  const handleSelectGeneric = useCallback((group: GenericGroup) => {
    setSelectedGenericKey(group.key);
    setSelectedScriptId(group.scripts[0]?.Detailing_ID || null);
    setReaderLang('bn');
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedGenericKey(null);
    setSelectedScriptId(null);
  }, []);

  const handleAddSpecialistScript = (group: GenericGroup) => {
    const prefilledProductIds =
      group.productIds.length > 0 ? group.productIds.join(', ') : group.genericName;
    openAddModal('Doctor_Product_Detailing', {
      Product_ID: prefilledProductIds,
      Generic_Name: group.genericName,
    });
  };

  const handleCopyActiveScript = async () => {
    const text =
      readerLang === 'bn'
        ? String(activeScript?.Detailing_BN ?? '').trim()
        : String(activeScript?.Detailing_EN ?? '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      pushToast({
        type: 'success',
        title: readerLang === 'bn' ? 'বাংলা স্ক্রিপ্ট কপি হয়েছে' : 'English script copied',
        message: selectedGroup?.genericName,
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      pushToast({
        type: 'info',
        title: 'Copy unavailable',
        message: 'Select and copy the text directly.',
      });
    }
  };

  // Resolve YouTube video URL for the selected generic from its products
  const readerVideoUrls = useMemo(() => {
    if (!selectedGroup) return { primary: undefined, fallback: undefined };
    for (const prod of selectedGroup.products) {
      const v1 = getValidVideoUrl(prod.Video_URL);
      const v2 = getValidVideoUrl(prod.YouTube_URL);
      if (v1 || v2) {
        return { primary: v1 || undefined, fallback: v2 || undefined };
      }
    }
    return { primary: undefined, fallback: undefined };
  }, [selectedGroup]);

  // =========================================================================
  // 2. FULL-SCREEN SINGLE PRODUCT DETAILING READER (Mobile & Desktop)
  // Covers header, search bar, list, and bottom nav cleanly at z-[45]
  // =========================================================================
  if (selectedGroup) {
    const brandLabel = getPrimaryBrandLabel(selectedGroup);
    const bnText = String(activeScript?.Detailing_BN ?? '').trim();
    const enText = String(activeScript?.Detailing_EN ?? '').trim();
    const activeText = readerLang === 'bn' ? bnText : enText;

    return (
      <div
        role="region"
        aria-label={`${selectedGroup.genericName} detailing reader`}
        className="fixed inset-0 z-[45] h-[100dvh] bg-[#F4F8FC] dark:bg-[#071522] flex flex-col overflow-hidden"
      >
        {/* ONE Compact Sticky Top Bar: ← Back (left) | Generic Name · Brand Name (center/right) */}
        <header className="shrink-0 bg-white dark:bg-[#0B1E30] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 pt-safe">
          <div className="max-w-4xl mx-auto w-full h-[52px] px-3 sm:px-5 flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleBackToList}
              aria-label="Back to generics list"
              className="min-h-[40px] -ml-1.5 px-2.5 rounded-xl text-[#0D2B45] dark:text-white hover:bg-[#EAF4FB] dark:hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1 shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Back</span>
            </button>

            <h1 className="min-w-0 flex-1 text-right sm:text-center truncate text-[15px] sm:text-base leading-none">
              <span className="font-display font-bold text-[#0D2B45] dark:text-white">
                {selectedGroup.genericName}
              </span>
              {brandLabel && (
                <>
                  <span
                    aria-hidden="true"
                    className="mx-1.5 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 font-normal"
                  >
                    ·
                  </span>
                  <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                    {brandLabel}
                  </span>
                </>
              )}
            </h1>

            {isSuperAdmin ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAddSpecialistScript(selectedGroup)}
                  aria-label="Add specialist script"
                  title="Add specialist script"
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-[#EAF4FB] dark:bg-[#133859] text-[#0D2B45] dark:text-white hover:bg-[#dcecf7] flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {activeScript && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal(
                          'Doctor_Product_Detailing',
                          activeScript as unknown as Record<string, unknown>
                        )
                      }
                      aria-label="Edit detailing script"
                      title="Edit script"
                      className="min-h-[36px] min-w-[36px] rounded-lg bg-[#0D2B45] dark:bg-[#0E7C7B] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        requestDeleteRecord(
                          'Doctor_Product_Detailing',
                          activeScript as unknown as Record<string, unknown>,
                          `${selectedGroup.genericName} — ${activeScript.Specialist}`
                        )
                      }
                      aria-label="Delete detailing script"
                      title="Delete script"
                      className="min-h-[36px] min-w-[36px] rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <span aria-hidden="true" className="hidden sm:block w-[68px] shrink-0" />
            )}
          </div>
        </header>

        {/* Compact Horizontal Row of Strength / Price Pills */}
        {selectedGroup.products.length > 0 && (
          <div className="shrink-0 max-w-4xl mx-auto w-full px-3.5 sm:px-5 pt-2.5 pb-1">
            <div
              aria-label="Available strengths and prices"
              className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5"
            >
              {selectedGroup.products.map((prod, idx) => {
                const strengthText =
                  String(prod.Strength ?? '').trim() ||
                  String(prod.Dosage_Form ?? '').trim() ||
                  String(prod.Brand_Name || prod.Product_Name || prod.Product_ID).trim();
                const priceText =
                  formatCompactPrice(prod.Single_Price) ||
                  formatCompactPrice(prod.Box_Price) ||
                  formatCompactPrice(prod.MRP_BDT);

                return (
                  <button
                    key={`${prod.Product_ID}-${idx}`}
                    type="button"
                    onClick={() => openProductBrief(prod.Product_ID)}
                    className="shrink-0 min-h-[32px] px-3 py-1 rounded-full bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/15 hover:border-[#0E7C7B] text-xs font-semibold tabular-nums text-[#0D2B45] dark:text-[#EBF4FA] inline-flex items-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.97] cursor-pointer"
                  >
                    <span>{strengthText}</span>
                    {priceText && (
                      <>
                        <span
                          aria-hidden="true"
                          className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30"
                        >
                          ·
                        </span>
                        <span className="text-[#0E7C7B] dark:text-[#22E3D0] font-bold">
                          {priceText}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Spacious Full-Height Detailing Script Card */}
        <div className="flex-1 min-h-0 max-w-4xl mx-auto w-full px-3 sm:px-5 pt-2 pb-3 sm:pb-5 pb-safe flex flex-col">
          <article className="flex-1 min-h-0 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 shadow-sm flex flex-col overflow-hidden">
            {/* Top Controls inside Card: Specialist Dropdown (left) + বাংলা | EN Toggle (right) */}
            <div className="shrink-0 px-3.5 sm:px-6 py-3 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2.5">
              {selectedGroup.scripts.length > 0 ? (
                <div className="relative flex-1 min-w-0 max-w-[230px] sm:max-w-[280px]">
                  <select
                    aria-label="Select specialist detailing script"
                    value={activeScript?.Detailing_ID || ''}
                    onChange={(e) => setSelectedScriptId(e.target.value)}
                    className="w-full min-h-[40px] appearance-none pl-3 pr-8 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/15 text-xs sm:text-sm font-semibold text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] truncate cursor-pointer"
                  >
                    {selectedGroup.scripts.map((script, idx) => (
                      <option
                        key={`${script.Detailing_ID}-${idx}`}
                        value={script.Detailing_ID}
                      >
                        {script.Specialist || 'General Specialist'}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="w-4 h-4 text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
                  />
                </div>
              ) : (
                <span className="text-xs sm:text-sm font-semibold text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 truncate">
                  Detailing Script
                </span>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  role="tablist"
                  aria-label="Script language"
                  className="inline-flex items-center p-0.5 rounded-xl bg-[#EAF4FB] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/12"
                >
                  {(
                    [
                      { id: 'bn' as ReaderLang, label: 'বাংলা' },
                      { id: 'en' as ReaderLang, label: 'EN' },
                    ] as const
                  ).map((tab) => {
                    const isActive = readerLang === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setReaderLang(tab.id)}
                        className={`min-h-[34px] px-3 rounded-[9px] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                            : 'text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 hover:text-[#0D2B45] dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {activeText && (
                  <button
                    type="button"
                    onClick={() => void handleCopyActiveScript()}
                    aria-label="Copy detailing script"
                    title="Copy script"
                    className="min-h-[38px] min-w-[38px] rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] text-[#0D2B45]/70 dark:text-[#EBF4FA]/75 hover:text-[#0E7C7B] dark:hover:text-[#22E3D0] inline-flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#0E7C7B] dark:text-[#22E3D0]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Large Comfortable Scrollable Script Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-5 sm:py-7">
              {selectedGroup.scripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3">
                  <BookOpen className="w-8 h-8 text-[#0E7C7B] dark:text-[#22E3D0]" />
                  <p className="font-display font-bold text-base text-[#0D2B45] dark:text-white">
                    No detailing script available yet
                  </p>
                  <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 max-w-sm">
                    Detailing scripts for {selectedGroup.genericName} will appear here once added.
                  </p>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleAddSpecialistScript(selectedGroup)}
                      className="min-h-[42px] px-4 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Specialist Script</span>
                    </button>
                  )}
                </div>
              ) : activeText ? (
                <p
                  className={
                    readerLang === 'bn'
                      ? 'text-[17px] sm:text-[19px] leading-[1.95] text-[#0D2B45] dark:text-[#EBF4FA] whitespace-pre-line max-w-[68ch]'
                      : 'text-[16px] sm:text-[18px] leading-[1.82] text-[#0D2B45] dark:text-[#EBF4FA] whitespace-pre-line max-w-[68ch]'
                  }
                >
                  {activeText}
                </p>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3">
                  <p className="text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
                    {readerLang === 'bn'
                      ? 'এই স্পেশালিস্টের জন্য বাংলা স্ক্রিপ্ট এখনো যুক্ত হয়নি।'
                      : 'English detailing script is not available for this specialist yet.'}
                  </p>
                  {readerLang === 'bn' && enText && (
                    <button
                      type="button"
                      onClick={() => setReaderLang('en')}
                      className="min-h-[40px] px-4 rounded-xl bg-[#EAF4FB] dark:bg-[#133859] text-xs font-bold text-[#0D2B45] dark:text-white cursor-pointer"
                    >
                      Switch to EN
                    </button>
                  )}
                  {readerLang === 'en' && bnText && (
                    <button
                      type="button"
                      onClick={() => setReaderLang('bn')}
                      className="min-h-[40px] px-4 rounded-xl bg-[#EAF4FB] dark:bg-[#133859] text-xs font-bold text-[#0D2B45] dark:text-white cursor-pointer"
                    >
                      বাংলায় পড়ুন
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Action Row: Sleek Red YouTube Watch Now Button */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 bg-[#FAFDFE] dark:bg-[#0B1E30]">
              <WatchNowButton
                videoUrl={readerVideoUrls.primary}
                fallbackUrl={readerVideoUrls.fallback}
                label="Watch Now"
                size="full"
                className="min-h-[44px] rounded-xl text-sm font-bold"
              />
            </div>
          </article>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1B. SPECIALTY-SCOPED & GROUP-WISE DOCTOR DETAILING VIEW (Full-Screen)
  // Triggered when tapping "Detailing" on any Doctor card in Team or Today's Doctors
  // =========================================================================
  if (doctorScope) {
    return (
      <div
        role="region"
        aria-label={`${doctorScope.doctorName} specialty detailing`}
        className="fixed inset-0 z-[44] h-[100dvh] bg-[#F4F8FC] dark:bg-[#071522] flex flex-col overflow-hidden"
      >
        {/* Sticky Top Bar: ← Back + Doctor Name · Specialty */}
        <header className="shrink-0 bg-white dark:bg-[#0B1E30] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 pt-safe">
          <div className="max-w-4xl mx-auto w-full min-h-[54px] px-3 sm:px-5 py-1.5 flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExitDoctorScope}
              aria-label="Back to doctors list"
              className="min-h-[40px] -ml-1.5 px-2.5 rounded-xl text-[#0D2B45] dark:text-white hover:bg-[#EAF4FB] dark:hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1 shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Back</span>
            </button>

            <div className="min-w-0 flex-1 text-right sm:text-left">
              <h1 className="truncate text-[14.5px] sm:text-base leading-snug">
                <span className="font-display font-bold text-[#0D2B45] dark:text-white">
                  {doctorScope.doctorName}
                </span>
                <span
                  aria-hidden="true"
                  className="mx-1.5 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 font-normal"
                >
                  ·
                </span>
                <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                  {doctorScope.specialty}
                </span>
              </h1>
            </div>
          </div>

          {/* Horizontal Product Group Filter Bar (All, G-A, G-B, G-C, ... only groups with products) */}
          <div className="max-w-4xl mx-auto w-full px-3.5 sm:px-5 pb-2.5 pt-0.5">
            <div
              role="tablist"
              aria-label="Filter by product group"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedProductGroup === 'ALL'}
                onClick={() => setSelectedProductGroup('ALL')}
                className={`shrink-0 min-h-[34px] px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedProductGroup === 'ALL'
                    ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                    : 'bg-[#EAF4FB] dark:bg-[#10283E] text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 hover:bg-[#dcecf7] dark:hover:bg-[#153552]'
                }`}
              >
                All{' '}
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  ({specialtyScopedEntries.length})
                </span>
              </button>

              {availableSpecialtyProductGroups.map(({ code, count }) => {
                const active = selectedProductGroup === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedProductGroup(code)}
                    className={`shrink-0 min-h-[34px] px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0E7C7B] text-white'
                        : 'bg-[#EAF4FB] dark:bg-[#10283E] text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 hover:bg-[#dcecf7] dark:hover:bg-[#153552]'
                    }`}
                  >
                    G-{code}{' '}
                    <span className="font-mono tabular-nums text-[11px] opacity-85">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Scrollable Specialty-Scoped Generics & DI Brands List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full px-3.5 sm:px-5 py-3 pb-8 pb-safe space-y-2.5">
            {/* Compact inline search within this specialty */}
            {specialtyScopedEntries.length > 6 && (
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="search"
                  value={scopeSearch}
                  onChange={(e) => setScopeSearch(e.target.value)}
                  placeholder={`Search ${doctorScope.specialty} brands or generics...`}
                  aria-label={`Search ${doctorScope.specialty} brands or generics`}
                  className="w-full min-h-[40px] pl-9 pr-9 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
                />
                {scopeSearch && (
                  <button
                    type="button"
                    onClick={() => setScopeSearch('')}
                    aria-label="Clear specialty detailing search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {specialtyScopedEntries.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center space-y-2.5">
                <BookOpen className="w-8 h-8 text-[#0E7C7B] dark:text-[#22E3D0] mx-auto" />
                <p className="font-display font-bold text-base text-[#0D2B45] dark:text-white">
                  No detailing products mapped to {doctorScope.specialty}
                </p>
                <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 max-w-sm mx-auto">
                  Check the doctor&apos;s Specialty or sync Departments &amp; Detailing data from Google Sheets.
                </p>
                <div className="pt-1 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleExitDoctorScope}
                    className="min-h-[40px] px-4 rounded-xl bg-[#EAF4FB] dark:bg-[#133859] text-[#0D2B45] dark:text-white text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDoctorScope(null);
                      setSelectedProductGroup('ALL');
                    }}
                    className="min-h-[40px] px-4 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
                  >
                    Browse All Detailing
                  </button>
                </div>
              </div>
            ) : filteredSpecialtyEntries.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center space-y-2">
                <p className="font-display font-bold text-sm text-[#0D2B45] dark:text-white">
                  No matching brands found
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setScopeSearch('');
                    setSelectedProductGroup('ALL');
                  }}
                  className="min-h-[38px] px-4 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
                >
                  Show All ({specialtyScopedEntries.length})
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredSpecialtyEntries.map((entry) => {
                  const brandLabel =
                    selectedProductGroup !== 'ALL' &&
                    (entry.brandsByGroup.get(selectedProductGroup)?.length || 0) > 0
                      ? entry.brandsByGroup.get(selectedProductGroup)!.join(', ')
                      : getPrimaryBrandLabel(entry.group);
                  const visibleGroupBadges =
                    selectedProductGroup !== 'ALL'
                      ? [selectedProductGroup]
                      : entry.groupCodes.slice(0, 3);

                  return (
                    <button
                      key={`scoped-${entry.group.key}`}
                      type="button"
                      onClick={() => handleSelectScopedEntry(entry)}
                      className="w-full min-h-[54px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B]/55 dark:hover:border-[#149A99]/60 flex items-center justify-between gap-2.5 text-left transition-colors active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14.5px] leading-snug">
                          <span className="font-display font-bold text-[#0D2B45] dark:text-white">
                            {entry.group.genericName}
                          </span>
                          {brandLabel && (
                            <>
                              <span
                                aria-hidden="true"
                                className="mx-1.5 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 font-normal"
                              >
                                ·
                              </span>
                              <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                                {brandLabel}
                              </span>
                            </>
                          )}
                        </div>

                        {visibleGroupBadges.length > 0 && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            {visibleGroupBadges.map((code) => (
                              <span
                                key={`${entry.group.key}-g-${code}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[#EBF4FA] dark:bg-[#102E47] text-[10.5px] font-mono font-bold text-[#0D2B45] dark:text-[#7CE0DF] leading-none"
                              >
                                G-{code}
                              </span>
                            ))}
                            {selectedProductGroup === 'ALL' && entry.groupCodes.length > 3 && (
                              <span className="text-[10.5px] font-mono text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                                +{entry.groupCodes.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <ChevronRight
                        aria-hidden="true"
                        className="w-4 h-4 text-[#0D2B45]/40 dark:text-[#EBF4FA]/40 shrink-0"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. MINIMAL GENERIC LIST VIEW (Single-line Search Bar + Ultra-Minimal Cards)
  // =========================================================================
  return (
    <div className="space-y-3">
      {/* Compact Single-Line Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={genericSearch}
            onChange={(e) => setGenericSearch(e.target.value)}
            placeholder="Search generic or brand (e.g. Linezolid, Linzo)..."
            aria-label="Search detailing by generic or brand name"
            className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
          />
          {genericSearch && (
            <button
              type="button"
              onClick={() => setGenericSearch('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => openAddModal('Doctor_Product_Detailing')}
            aria-label="Add new detailing script"
            title="Add Script"
            className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Script</span>
          </button>
        )}
      </div>

      {/* Ultra-Minimal Generic · Brand List Cards */}
      {filteredGenericGroups.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center space-y-1.5">
          <p className="font-display font-bold text-base text-[#0D2B45] dark:text-white">
            No matching generics found
          </p>
          <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
            No brand or generic matched &ldquo;{genericSearch}&rdquo;.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleGenericGroups.map((group) => (
              <GenericListCard
                key={group.key}
                group={group}
                onSelect={handleSelectGeneric}
              />
            ))}
          </div>

          {hasMoreGenerics && (
            <div
              ref={genericsSentinelRef}
              className="pt-2 flex items-center justify-center"
            >
              <button
                type="button"
                onClick={loadMoreGenerics}
                className="min-h-[42px] px-5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
              >
                Load {Math.min(WINDOW_PAGE_SIZE, remainingGenerics)} more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
