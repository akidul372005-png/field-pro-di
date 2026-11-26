import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Pencil,
  Pill,
  Plus,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Department, Indication, Product } from '../types';
import {
  formatBDT,
  getEffectiveIndications,
  isActiveRecord,
  matchProductsForClinicalIndication,
  matchProductsForIndicationRecord,
  matchSpecialistName,
  normalizeGenericKey,
  normalizeProductGroup,
  parseClinicalIndications,
  parseCommaList,
  parsePreferredGenerics,
  productMatchesPreferredGeneric,
  scriptMatchesGenericGroup,
} from '../services/api';
import { StickyBackBar } from './StickyBackBar';

type SpecialistDetailTab = 'generics' | 'indications';

interface EnrichedGenericEntry {
  key: string;
  genericName: string;
  matchedProducts: Product[];
  detailingScriptCount: number;
  hasSpecialistScript: boolean;
}

interface MergedSpecialistIndication {
  id: string;
  name: string;
  category: string;
  keyGenerics: string[];
  matchedProductCount: number;
  source: 'sheet' | 'department';
  sheetRecord?: Indication;
}

const formatCompactPrice = (value?: number | string): string => {
  if (value === undefined || value === null || String(value).trim() === '') return '';
  const num = Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return '';
  return Number.isInteger(num) ? `৳${num.toLocaleString()}` : `৳${num.toFixed(2)}`;
};

const normalizeIndicationKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const SpecialistsView: React.FC = () => {
  const {
    dataset,
    isSuperAdmin,
    selectedSpecialistId,
    setSelectedSpecialistId,
    openProductBrief,
    startDetailingFlow,
    openAddModal,
    openEditModal,
  } = useApp();

  const [directorySearch, setDirectorySearch] = useState('');
  const [detailTab, setDetailTab] = useState<SpecialistDetailTab>('generics');
  const [genericSearch, setGenericSearch] = useState('');
  const [indicationSearch, setIndicationSearch] = useState('');
  const [selectedGenericKey, setSelectedGenericKey] = useState<string | null>(null);

  // Active Departments (Specialists) sorted alphabetically
  const activeDepartments = useMemo(
    () =>
      (dataset.Departments || [])
        .filter((dept) => isActiveRecord(dept as unknown as Record<string, unknown>))
        .sort((a, b) => a.Department_Name.localeCompare(b.Department_Name)),
    [dataset.Departments]
  );

  // Active Indications from Indications sheet (or derived fallback)
  const activeSheetIndications = useMemo(() => {
    const { indications } = getEffectiveIndications(dataset);
    return indications.filter((ind) => isActiveRecord(ind as unknown as Record<string, unknown>));
  }, [dataset]);

  // Precompute merged indication counts + preferred generics per specialist for fast directory cards
  const enrichedDepartments = useMemo(() => {
    return activeDepartments.map((dept) => {
      const generics = parsePreferredGenerics(dept.Preferred_Generics);
      const deptIndications = parseClinicalIndications(dept.Clinical_Indications);

      const seenIndKeys = new Set<string>();
      const matchedSheetIndications: Indication[] = [];

      for (const ind of activeSheetIndications) {
        const relevantSpecs = parseCommaList(ind.Relevant_Specialists);
        if (relevantSpecs.some((sp) => matchSpecialistName(sp, dept.Department_Name))) {
          const normKey = normalizeIndicationKey(ind.Indication_Name);
          if (normKey && !seenIndKeys.has(normKey)) {
            seenIndKeys.add(normKey);
            matchedSheetIndications.push(ind);
          }
        }
      }

      const extraDeptIndications: string[] = [];
      for (const indName of deptIndications) {
        const normKey = normalizeIndicationKey(indName);
        if (normKey && !seenIndKeys.has(normKey)) {
          seenIndKeys.add(normKey);
          extraDeptIndications.push(indName);
        }
      }

      const totalIndicationsCount = matchedSheetIndications.length + extraDeptIndications.length;

      return {
        department: dept,
        generics,
        matchedSheetIndications,
        extraDeptIndications,
        totalIndicationsCount,
      };
    });
  }, [activeDepartments, activeSheetIndications]);

  // Directory search filter
  const filteredDepartments = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return enrichedDepartments;
    return enrichedDepartments.filter(
      ({ department, generics, matchedSheetIndications, extraDeptIndications }) => {
        if (String(department.Department_Name ?? '').toLowerCase().includes(q)) return true;
        if (String(department.Department_ID ?? '').toLowerCase().includes(q)) return true;
        if (generics.some((g) => g.toLowerCase().includes(q))) return true;
        if (
          matchedSheetIndications.some(
            (ind) =>
              ind.Indication_Name.toLowerCase().includes(q) ||
              String(ind.Key_Generics ?? '').toLowerCase().includes(q)
          )
        ) {
          return true;
        }
        if (extraDeptIndications.some((name) => name.toLowerCase().includes(q))) return true;
        return false;
      }
    );
  }, [enrichedDepartments, directorySearch]);

  // Selected specialist record
  const selectedEntry = useMemo(() => {
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

  // Reset sub-filters when switching specialists
  useEffect(() => {
    setDetailTab('generics');
    setGenericSearch('');
    setIndicationSearch('');
    setSelectedGenericKey(null);
  }, [selectedSpecialistId]);

  // Enriched generics list for the active specialist
  const specialistGenerics = useMemo<EnrichedGenericEntry[]>(() => {
    if (!selectedEntry) return [];
    const { department, generics } = selectedEntry;
    const seenKeys = new Set<string>();
    const entries: EnrichedGenericEntry[] = [];

    for (const genericName of generics) {
      const gKey = normalizeGenericKey(genericName);
      if (!gKey || seenKeys.has(gKey)) continue;
      seenKeys.add(gKey);

      const matchedProducts = dataset.Products.filter((prod) =>
        productMatchesPreferredGeneric(prod, genericName)
      );

      const matchingScripts = dataset.Doctor_Product_Detailing.filter((script) =>
        scriptMatchesGenericGroup(script, genericName, matchedProducts)
      );

      const hasSpecialistScript = matchingScripts.some((script) =>
        matchSpecialistName(script.Specialist, department.Department_Name)
      );

      entries.push({
        key: gKey,
        genericName,
        matchedProducts,
        detailingScriptCount: matchingScripts.length,
        hasSpecialistScript,
      });
    }

    return entries;
  }, [selectedEntry, dataset.Products, dataset.Doctor_Product_Detailing]);

  // Filter generics by generic name OR matched DI brand name / therapeutic class
  const filteredGenerics = useMemo(() => {
    const q = genericSearch.trim().toLowerCase();
    if (!q) return specialistGenerics;
    return specialistGenerics.filter((entry) => {
      if (entry.genericName.toLowerCase().includes(q)) return true;
      return entry.matchedProducts.some(
        (p) =>
          String(p.Brand_Name || p.Product_Name || '').toLowerCase().includes(q) ||
          String(p.Generic_Name || '').toLowerCase().includes(q) ||
          String(p.Therapeutic_Class || '').toLowerCase().includes(q)
      );
    });
  }, [specialistGenerics, genericSearch]);

  // Merged indications for the active specialist (from BOTH Indications.Relevant_Specialists AND Departments.Clinical_Indications)
  const specialistIndications = useMemo<MergedSpecialistIndication[]>(() => {
    if (!selectedEntry) return [];
    const { matchedSheetIndications, extraDeptIndications, department } = selectedEntry;
    const merged: MergedSpecialistIndication[] = [];

    for (const ind of matchedSheetIndications) {
      const keyGenerics = parseCommaList(ind.Key_Generics);
      const matched = matchProductsForIndicationRecord(dataset.Products, ind);
      merged.push({
        id: ind.Indication_ID || `sheet-${normalizeIndicationKey(ind.Indication_Name)}`,
        name: ind.Indication_Name,
        category: String(ind.Category ?? '').trim() || department.Department_Name,
        keyGenerics,
        matchedProductCount: matched.length,
        source: 'sheet',
        sheetRecord: ind,
      });
    }

    for (const indName of extraDeptIndications) {
      const matched = matchProductsForClinicalIndication(dataset.Products, indName);
      const derivedGenerics: string[] = [];
      const seenG = new Set<string>();
      for (const { product } of matched) {
        const gName = String(product.Generic_Name ?? '').trim();
        const gKey = normalizeGenericKey(gName);
        if (gKey && !seenG.has(gKey)) {
          seenG.add(gKey);
          derivedGenerics.push(gName);
        }
        if (derivedGenerics.length >= 6) break;
      }
      merged.push({
        id: `dept-${normalizeIndicationKey(indName)}`,
        name: indName,
        category: department.Department_Name,
        keyGenerics: derivedGenerics,
        matchedProductCount: matched.length,
        source: 'department',
      });
    }

    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedEntry, dataset.Products]);

  // Filter indications by indication name, category, or key generics
  const filteredIndications = useMemo(() => {
    const q = indicationSearch.trim().toLowerCase();
    if (!q) return specialistIndications;
    return specialistIndications.filter(
      (ind) =>
        ind.name.toLowerCase().includes(q) ||
        ind.category.toLowerCase().includes(q) ||
        ind.keyGenerics.some((g) => g.toLowerCase().includes(q))
    );
  }, [specialistIndications, indicationSearch]);

  const handleSelectSpecialist = (dept: Department) => {
    setSelectedSpecialistId(dept.Department_ID);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTapIndicationGeneric = (genericName: string) => {
    const targetKey = normalizeGenericKey(genericName);
    const existsInSpecialist = specialistGenerics.find((g) => g.key === targetKey);
    if (existsInSpecialist) {
      setDetailTab('generics');
      setGenericSearch('');
      setSelectedGenericKey(existsInSpecialist.key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Open Detailing flow directly for this generic
      startDetailingFlow({
        genericName,
        specialist: selectedEntry?.department.Department_Name,
        subTab: 'detailing',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // =========================================================================
  // VIEW 2: SPECIALIST DETAIL VIEW (Generics & Indications 2-Tab View)
  // =========================================================================
  if (selectedEntry) {
    const { department } = selectedEntry;
    const totalMatchedDiBrands = (() => {
      const seen = new Set<string>();
      for (const g of specialistGenerics) {
        for (const p of g.matchedProducts) {
          seen.add(p.Product_ID || `${p.Brand_Name}-${p.Strength}`);
        }
      }
      return seen.size;
    })();

    return (
      <div className="space-y-4">
        <StickyBackBar
          title={department.Department_Name}
          subtitle={`${specialistGenerics.length} generics · ${specialistIndications.length} indications · ${totalMatchedDiBrands} DI brands`}
          backLabel="Specialists"
          onBack={() => {
            setSelectedSpecialistId(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          rightSlot={
            isSuperAdmin ? (
              <button
                type="button"
                onClick={() =>
                  openEditModal('Departments', department as unknown as Record<string, unknown>)
                }
                className="min-h-[38px] px-3 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-[0.98]"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            ) : undefined
          }
        />

        {/* 2 Clear Segmented Tabs: Generics & Indications */}
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3 sm:p-4 space-y-3">
          <div
            role="tablist"
            aria-label="Specialist detail sections"
            className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
          >
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'generics'}
              onClick={() => setDetailTab('generics')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center sm:gap-1.5 transition-colors cursor-pointer ${
                detailTab === 'generics'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Pill className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                <span>Generics</span>
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  ({specialistGenerics.length})
                </span>
              </span>
              <span className="text-[10px] sm:text-xs font-medium opacity-85 whitespace-nowrap">
                জেনেরিক ও ব্র্যান্ড
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'indications'}
              onClick={() => setDetailTab('indications')}
              className={`min-h-[46px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-center sm:gap-1.5 transition-colors cursor-pointer ${
                detailTab === 'indications'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <ClipboardList className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                <span>Indications</span>
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  ({specialistIndications.length})
                </span>
              </span>
              <span className="text-[10px] sm:text-xs font-medium opacity-85 whitespace-nowrap">
                ইন্ডিকেশন
              </span>
            </button>
          </div>

          {/* Search input for active tab */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              {detailTab === 'generics' ? (
                <input
                  type="search"
                  value={genericSearch}
                  onChange={(e) => setGenericSearch(e.target.value)}
                  placeholder="Search generic or DI brand name..."
                  aria-label="Search specialist generics and DI brands"
                  className="w-full min-h-[44px] pl-9 pr-9 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
                />
              ) : (
                <input
                  type="search"
                  value={indicationSearch}
                  onChange={(e) => setIndicationSearch(e.target.value)}
                  placeholder="Search clinical indication or key generic..."
                  aria-label="Search specialist indications"
                  className="w-full min-h-[44px] pl-9 pr-9 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
                />
              )}
              {(detailTab === 'generics' ? genericSearch : indicationSearch) && (
                <button
                  type="button"
                  onClick={() =>
                    detailTab === 'generics' ? setGenericSearch('') : setIndicationSearch('')
                  }
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 hover:text-[#0D2B45] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
            <span className="font-mono tabular-nums">
              {detailTab === 'generics'
                ? `Showing ${filteredGenerics.length} of ${specialistGenerics.length} generics`
                : `Showing ${filteredIndications.length} of ${specialistIndications.length} indications`}
            </span>
            {detailTab === 'generics' && selectedGenericKey && (
              <button
                type="button"
                onClick={() => setSelectedGenericKey(null)}
                className="font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer whitespace-nowrap"
              >
                Collapse Selection
              </button>
            )}
          </div>
        </div>

        {/* =============================================================== */}
        {/* TAB A: GENERICS (জেনেরিক ও ব্র্যান্ড)                              */}
        {/* =============================================================== */}
        {detailTab === 'generics' && (
          <div className="space-y-2.5">
            {specialistGenerics.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
                <Pill className="w-7 h-7 text-[#0E7C7B] dark:text-[#149A99] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                  No preferred generics listed for {department.Department_Name} yet
                </p>
                <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                  Sync updated Departments data from Google Sheets to view preferred generics.
                </p>
              </div>
            ) : filteredGenerics.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
                <p className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                  No matching generics or DI brands found
                </p>
                <button
                  type="button"
                  onClick={() => setGenericSearch('')}
                  className="mt-3 min-h-[40px] px-4 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredGenerics.map((entry) => {
                  const isExpanded =
                    selectedGenericKey === entry.key ||
                    (genericSearch.trim().length > 0 && filteredGenerics.length <= 3);
                  const uniqueBrandPreview = Array.from(
                    new Set(
                      entry.matchedProducts
                        .map((p) => String(p.Brand_Name || p.Product_Name || '').trim())
                        .filter(Boolean)
                    )
                  );

                  return (
                    <article
                      key={`spec-gen-${entry.key}`}
                      className={`rounded-2xl bg-white dark:bg-[#0D2235] border transition-colors overflow-hidden ${
                        isExpanded
                          ? 'border-[#0E7C7B] dark:border-[#149A99]'
                          : 'border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B]/60'
                      }`}
                    >
                      {/* Generic Row Header — Tap to filter/expand DI brands, Detailing & Available Brands */}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedGenericKey((prev) => (prev === entry.key ? null : entry.key))
                        }
                        aria-expanded={isExpanded}
                        className="w-full text-left px-3.5 py-3 flex items-start justify-between gap-2.5 cursor-pointer active:bg-[#F4F8FC] dark:active:bg-[#071522]/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white leading-snug truncate">
                              {entry.genericName}
                            </h3>
                            <span className="text-xs font-mono font-semibold tabular-nums text-[#0E7C7B] dark:text-[#149A99] whitespace-nowrap shrink-0">
                              {entry.matchedProducts.length} DI{' '}
                              {entry.matchedProducts.length === 1 ? 'brand' : 'brands'}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 truncate">
                            {uniqueBrandPreview.length > 0 ? (
                              <span className="truncate font-medium text-[#0D2B45]/80 dark:text-[#EBF4FA]/80">
                                {uniqueBrandPreview.slice(0, 4).join(', ')}
                                {uniqueBrandPreview.length > 4
                                  ? ` +${uniqueBrandPreview.length - 4}`
                                  : ''}
                              </span>
                            ) : (
                              <span>Tap for Detailing &amp; DI brands</span>
                            )}
                            {entry.detailingScriptCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="whitespace-nowrap shrink-0 tabular-nums">
                                  Detailing ({entry.detailingScriptCount})
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[#0D2B45]/50 dark:text-[#EBF4FA]/50 shrink-0 mt-0.5">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Panel: Detailing Action & Matching DI Brands */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 bg-[#F4F8FC]/65 dark:bg-[#071522]/45 space-y-3">
                          {/* Quick Action Button */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                startDetailingFlow({
                                  genericName: entry.genericName,
                                  specialist: department.Department_Name,
                                  subTab: 'detailing',
                                });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="flex-1 sm:flex-initial min-h-[42px] px-4 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] hover:bg-[#133859] dark:hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-[0.98] transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Detailing
                                {entry.detailingScriptCount > 0
                                  ? ` (${entry.detailingScriptCount})`
                                  : ''}
                              </span>
                            </button>
                          </div>

                          {/* Matching Drug International Brands */}
                          {entry.matchedProducts.length > 0 ? (
                            <div className="space-y-1.5">
                              <p className="text-[11px] font-semibold text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                                Drug International Brands ({entry.matchedProducts.length})
                              </p>
                              <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 overflow-hidden">
                                {entry.matchedProducts.map((prod) => {
                                  const brandName =
                                    String(prod.Brand_Name || prod.Product_Name || '').trim() ||
                                    'Unnamed Brand';
                                  const groupCode = normalizeProductGroup(prod.Product_Group);
                                  const singlePrice = formatCompactPrice(
                                    prod.Single_Price ?? prod.MRP_BDT
                                  );
                                  const boxPrice = formatCompactPrice(prod.Box_Price);
                                  const metaParts = [
                                    String(prod.Strength ?? '').trim(),
                                    String(prod.Dosage_Form ?? '').trim(),
                                    String(prod.Pack_Size ?? '').trim(),
                                  ].filter(Boolean);

                                  return (
                                    <button
                                      key={prod.Product_ID}
                                      type="button"
                                      onClick={() => openProductBrief(prod.Product_ID)}
                                      className="w-full text-left px-3 py-2.5 hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/40 transition-colors flex items-center justify-between gap-2.5 cursor-pointer"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="font-display font-bold text-sm text-[#0D2B45] dark:text-white truncate">
                                            {brandName}
                                          </span>
                                          {groupCode && (
                                            <span className="text-[10px] font-mono font-semibold text-[#0E7C7B] dark:text-[#7CE0DF] shrink-0">
                                              · G-{groupCode}
                                            </span>
                                          )}
                                        </div>
                                        {metaParts.length > 0 && (
                                          <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 truncate mt-0.5">
                                            {metaParts.join(' · ')}
                                          </p>
                                        )}
                                      </div>

                                      <div className="text-right shrink-0 flex items-center gap-2">
                                        {(singlePrice || boxPrice) && (
                                          <div className="text-xs font-mono tabular-nums text-[#0D2B45] dark:text-white leading-tight">
                                            {singlePrice && (
                                              <div className="font-semibold">{singlePrice}</div>
                                            )}
                                            {boxPrice && (
                                              <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                                                Box {boxPrice}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {!singlePrice && !boxPrice && prod.MRP_BDT && (
                                          <span className="text-xs font-mono tabular-nums text-[#0D2B45] dark:text-white">
                                            {formatBDT(prod.MRP_BDT)}
                                          </span>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 shrink-0" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                              No Drug International catalog brands currently matched to{' '}
                              <span className="font-semibold text-[#0D2B45] dark:text-white">
                                {entry.genericName}
                              </span>
                              . Tap <span className="font-semibold">Detailing</span> to view
                              clinical detailing scripts.
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* TAB B: INDICATIONS (ইন্ডিকেশন)                                  */}
        {/* =============================================================== */}
        {detailTab === 'indications' && (
          <div className="space-y-2.5">
            {specialistIndications.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
                <ClipboardList className="w-7 h-7 text-[#0E7C7B] dark:text-[#149A99] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                  No clinical indications matched to {department.Department_Name} yet
                </p>
                <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
                  Sync your Indications and Departments sheets to populate clinical indications.
                </p>
              </div>
            ) : filteredIndications.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
                <p className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                  No matching clinical indications found
                </p>
                <button
                  type="button"
                  onClick={() => setIndicationSearch('')}
                  className="mt-3 min-h-[40px] px-4 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredIndications.map((ind) => (
                  <article
                    key={ind.id}
                    className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3.5 flex flex-col justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white leading-snug">
                          {ind.name}
                        </h3>
                        {isSuperAdmin && ind.sheetRecord && (
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                'Indications',
                                ind.sheetRecord as unknown as Record<string, unknown>
                              )
                            }
                            aria-label={`Edit ${ind.name}`}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 hover:text-[#0E7C7B] hover:bg-[#EBF4FA] dark:hover:bg-[#133859] shrink-0 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/60">
                        <span className="truncate">{ind.category}</span>
                        {ind.matchedProductCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums whitespace-nowrap shrink-0 text-[#0E7C7B] dark:text-[#149A99] font-medium">
                              {ind.matchedProductCount} DI{' '}
                              {ind.matchedProductCount === 1 ? 'brand' : 'brands'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Key Generics shown under each indication — tap to view DI brands / Available Brands */}
                    {ind.keyGenerics.length > 0 ? (
                      <div className="pt-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                        <p className="text-[11px] font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 mb-1.5">
                          Key Generics
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ind.keyGenerics.map((generic) => (
                            <button
                              key={`${ind.id}-${generic}`}
                              type="button"
                              onClick={() => handleTapIndicationGeneric(generic)}
                              className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] text-xs font-semibold text-[#0E7C7B] dark:text-[#7CE0DF] transition-colors cursor-pointer active:scale-[0.98]"
                            >
                              {generic}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#0D2B45]/50 dark:text-[#EBF4FA]/50 pt-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                        Key generics not specified for this indication.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: SPECIALISTS DIRECTORY (Searchable Compact Mobile Cards)
  // =========================================================================
  return (
    <div className="space-y-3.5">
      <StickyBackBar
        title="Specialists"
        subtitle={`${activeDepartments.length} specialties · Generics & Clinical Indications`}
        rightSlot={
          isSuperAdmin ? (
            <button
              type="button"
              onClick={() => openAddModal('Departments')}
              className="min-h-[38px] px-3 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          ) : undefined
        }
      />

      {/* Compact Search Bar */}
      <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3 sm:p-3.5 space-y-2">
        <div className="relative">
          <Search
            className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={directorySearch}
            onChange={(e) => setDirectorySearch(e.target.value)}
            placeholder="Search specialty, preferred generic, or clinical indication..."
            aria-label="Search specialists directory"
            className="w-full min-h-[44px] pl-9 pr-9 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
          />
          {directorySearch && (
            <button
              type="button"
              onClick={() => setDirectorySearch('')}
              aria-label="Clear specialist search"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 hover:text-[#0D2B45] dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
          <span className="font-mono tabular-nums">
            Showing {filteredDepartments.length} of {activeDepartments.length} specialists
          </span>
          {directorySearch && (
            <button
              type="button"
              onClick={() => setDirectorySearch('')}
              className="font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Specialists Card Grid */}
      {activeDepartments.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center">
          <Stethoscope className="w-8 h-8 text-[#0E7C7B] dark:text-[#149A99] mx-auto mb-2" />
          <p className="text-base font-display font-semibold text-[#0D2B45] dark:text-white">
            No specialists loaded yet
          </p>
          <p className="text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
            Sync your Google Sheet to load all medical specialties from the Departments tab.
          </p>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
          <p className="text-sm font-semibold text-[#0D2B45] dark:text-white">
            No matching specialists found
          </p>
          <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
            Try another specialty name, preferred generic, or clinical indication.
          </p>
          <button
            type="button"
            onClick={() => setDirectorySearch('')}
            className="mt-3 min-h-[40px] px-4 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
          >
            Reset Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {filteredDepartments.map(({ department, generics, totalIndicationsCount }, idx) => (
            <div
              key={`specialist-${department.Department_ID}-${idx}`}
              className="group relative rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] dark:hover:border-[#149A99] transition-colors flex items-stretch"
            >
              <button
                type="button"
                onClick={() => handleSelectSpecialist(department)}
                className="flex-1 min-w-0 text-left px-3.5 py-3 flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] rounded-2xl"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white group-hover:text-[#0E7C7B] dark:group-hover:text-[#149A99] transition-colors truncate leading-snug">
                    {department.Department_Name}
                  </h2>

                  <div className="mt-1 flex items-center gap-1.5 text-xs tabular-nums text-[#0D2B45]/65 dark:text-[#EBF4FA]/70">
                    <span className="font-semibold text-[#0E7C7B] dark:text-[#149A99] whitespace-nowrap">
                      {generics.length} {generics.length === 1 ? 'generic' : 'generics'}
                    </span>
                    <span aria-hidden="true" className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">
                      ·
                    </span>
                    <span className="font-medium whitespace-nowrap">
                      {totalIndicationsCount}{' '}
                      {totalIndicationsCount === 1 ? 'indication' : 'indications'}
                    </span>
                  </div>

                  {generics.length > 0 && (
                    <p className="mt-1 text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 line-clamp-1">
                      {generics.slice(0, 4).join(', ')}
                      {generics.length > 4 ? ` +${generics.length - 4}` : ''}
                    </p>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>

              {isSuperAdmin && (
                <div className="flex items-center pr-2">
                  <button
                    type="button"
                    onClick={() =>
                      openEditModal('Departments', department as unknown as Record<string, unknown>)
                    }
                    aria-label={`Edit ${department.Department_Name}`}
                    title="Edit Specialist"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#0D2B45]/55 dark:text-[#EBF4FA]/60 hover:text-[#0E7C7B] hover:bg-[#EBF4FA] dark:hover:bg-[#133859] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
