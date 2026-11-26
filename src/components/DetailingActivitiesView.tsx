import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Languages,
  Pencil,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductsCatalogView } from './ProductsCatalogView';
import { StickyBackBar } from './StickyBackBar';
import {
  GenericGroup,
  buildGenericGroups,
  formatBDT,
  matchSpecialistName,
  normalizeGenericKey,
} from '../services/api';
import { useDebouncedValue, useWindowedList } from '../hooks/useWindowedList';

type SubTab = 'detailing' | 'catalog';
type LanguageView = 'both' | 'bn' | 'en';

const WINDOW_PAGE_SIZE = 30;

interface GenericGroupRowProps {
  group: GenericGroup;
  onSelect: (group: GenericGroup) => void;
}

const GenericGroupRow: React.FC<GenericGroupRowProps> = React.memo(({ group, onSelect }) => {
  const scriptCount = group.scripts.length;
  const brandHeading = group.brandNames.join(', ');

  return (
    <div className="px-4 sm:px-5 py-4 hover:bg-[#F4F8FC]/80 dark:hover:bg-[#133859]/25 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Primary Generic Title + Saved Script Badge */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="font-display font-bold text-base sm:text-lg text-[#0D2B45] dark:text-white">
            {group.genericName}
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-mono tabular-nums font-semibold ${
              scriptCount > 0
                ? 'bg-[#0E7C7B]/12 dark:bg-[#149A99]/20 text-[#0E7C7B] dark:text-[#149A99]'
                : 'bg-[#0D2B45]/6 dark:bg-[#EBF4FA]/10 text-[#0D2B45]/55 dark:text-[#EBF4FA]/55'
            }`}
          >
            {scriptCount} {scriptCount === 1 ? 'script' : 'scripts'}
          </span>
          {group.therapeuticClasses.length > 0 && (
            <span className="text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
              · {group.therapeuticClasses.join(', ')}
            </span>
          )}
        </div>

        {/* Associated Drug International Brand Name(s) */}
        {brandHeading && (
          <div className="text-xs sm:text-sm font-semibold text-[#0E7C7B] dark:text-[#149A99]">
            {brandHeading}
          </div>
        )}

        {/* Compact Strength & Dosage Form Subtext/Tags */}
        {group.products.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {group.products.map((prod, idx) => {
              const bName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
              const strengthForm = [prod.Strength, prod.Dosage_Form].filter(Boolean).join(' ');
              const label =
                strengthForm && !bName.toLowerCase().includes(strengthForm.toLowerCase())
                  ? `${bName} (${strengthForm})`
                  : bName;
              return (
                <span
                  key={`${prod.Product_ID}-${idx}`}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[#0D2B45]/80 dark:text-[#EBF4FA]/80"
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}

        {/* Preview of Saved Specialists if any */}
        {scriptCount > 0 && (
          <div className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 pt-0.5">
            Specialists:{' '}
            <span className="font-medium text-[#0D2B45]/85 dark:text-[#EBF4FA]/85">
              {group.scripts.map((s) => s.Specialist || 'General').join(' · ')}
            </span>
          </div>
        )}
      </div>

      {/* Right-side "Detailing" Action Button */}
      <div className="flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={() => onSelect(group)}
          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          <span>Detailing</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
GenericGroupRow.displayName = 'GenericGroupRow';

export const DetailingActivitiesView: React.FC = () => {
  const {
    dataset,
    isSuperAdmin,
    prefillDetailing,
    setPrefillDetailing,
    pushToast,
    openProductBrief,
    openAddModal,
    openEditModal,
    requestDeleteRecord,
  } = useApp();

  const [subTab, setSubTab] = useState<SubTab>('detailing');

  // --- GENERIC-WISE DETAILING STATE (3-Step Flow) ---
  // Step 1: Generic List search & filter (searches Brand Name + Generic Name)
  const [genericSearch, setGenericSearch] = useState('');
  const [onlyWithScripts, setOnlyWithScripts] = useState(false);

  // Step 2: Selected Generic Key (null => Step 1 Generic List; string => Step 2 Specialist Selection)
  const [selectedGenericKey, setSelectedGenericKey] = useState<string | null>(null);

  // Step 3: Selected Specialist Script ID (null => prompt to pick specialist; string => Step 3 Bilingual Script Viewer)
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [langView, setLangView] = useState<LanguageView>('both');
  const [copiedLang, setCopiedLang] = useState<'bn' | 'en' | null>(null);

  // Group all products + saved detailing scripts by unique Generic Name
  const genericGroups = useMemo(
    () => buildGenericGroups(dataset.Products, dataset.Doctor_Product_Detailing),
    [dataset.Products, dataset.Doctor_Product_Detailing]
  );

  const genericGroupByKey = useMemo(
    () => new Map(genericGroups.map((g) => [g.key, g])),
    [genericGroups]
  );

  const selectedGroup: GenericGroup | null = useMemo(
    () => (selectedGenericKey ? genericGroupByKey.get(selectedGenericKey) || null : null),
    [selectedGenericKey, genericGroupByKey]
  );

  const activeScript = useMemo(() => {
    if (!selectedGroup || !selectedScriptId) return null;
    return (
      selectedGroup.scripts.find((s) => s.Detailing_ID === selectedScriptId) || null
    );
  }, [selectedGroup, selectedScriptId]);

  // Clear copy indicator whenever active script changes
  useEffect(() => {
    setCopiedLang(null);
  }, [selectedGenericKey, selectedScriptId]);

  // Handle cross-screen navigation handoff (e.g. from Dashboard, Products Catalog -> Detailing, or Product Brief)
  useEffect(() => {
    if (!prefillDetailing) return;

    if (prefillDetailing.subTab) {
      setSubTab(prefillDetailing.subTab);
    }

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
        setSelectedScriptId(matchedScript ? matchedScript.Detailing_ID : null);
      } else {
        setSelectedScriptId(null);
      }
    } else if (!prefillDetailing.genericName && !prefillDetailing.productId) {
      // Navigating generally to Detailing (e.g. from Dashboard KPI) lands on Step 1 Generic List
      setSelectedGenericKey(null);
      setSelectedScriptId(null);
    }

    setPrefillDetailing(null);
  }, [prefillDetailing, genericGroups, setPrefillDetailing]);

  // Keep selectedScriptId valid if a script is deleted or added
  useEffect(() => {
    if (!selectedGroup) return;
    if (
      selectedScriptId &&
      !selectedGroup.scripts.some((s) => s.Detailing_ID === selectedScriptId)
    ) {
      setSelectedScriptId(null);
    }
  }, [selectedGroup, selectedScriptId]);

  // Debounce search by 150ms so typing stays instant across 500+ generic groups
  const debouncedGenericSearch = useDebouncedValue(genericSearch, 150);

  // Precompute lowercased search haystacks once per dataset update
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

  // Filtered Generic Groups for Step 1 (searches ALL groups across Brand, Generic, Strength, Class & Specialist)
  const filteredGenericGroups = useMemo(() => {
    const q = debouncedGenericSearch.trim().toLowerCase();
    return indexedGenericGroups
      .filter(({ group, haystack }) => {
        if (onlyWithScripts && group.scripts.length === 0) return false;
        if (!q) return true;
        return haystack.includes(q);
      })
      .map(({ group }) => group);
  }, [indexedGenericGroups, debouncedGenericSearch, onlyWithScripts]);

  // Render first 30 generics immediately (<100ms), auto-load 30 more smoothly on scroll
  const {
    visibleItems: visibleGenericGroups,
    hasMore: hasMoreGenerics,
    remainingCount: remainingGenerics,
    loadMore: loadMoreGenerics,
    showAll: showAllGenerics,
    sentinelRef: genericsSentinelRef,
  } = useWindowedList(
    filteredGenericGroups,
    `${debouncedGenericSearch}|${onlyWithScripts}`,
    WINDOW_PAGE_SIZE
  );

  const genericsWithScriptsCount = useMemo(
    () => genericGroups.filter((g) => g.scripts.length > 0).length,
    [genericGroups]
  );

  // Handlers for Generic-wise Detailing
  const handleSelectGeneric = useCallback((group: GenericGroup) => {
    setSelectedGenericKey(group.key);
    setSelectedScriptId(null);
  }, []);

  const handleBackToGenerics = () => {
    setSelectedGenericKey(null);
    setSelectedScriptId(null);
  };

  const handleAddSpecialistScript = (group: GenericGroup) => {
    const prefilledProductIds =
      group.productIds.length > 0 ? group.productIds.join(', ') : group.genericName;
    openAddModal('Doctor_Product_Detailing', {
      Product_ID: prefilledProductIds,
      Generic_Name: group.genericName,
    });
  };

  const handleCopyScript = async (lang: 'bn' | 'en', text?: string) => {
    if (!text?.trim()) return;
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopiedLang(lang);
      pushToast({
        type: 'success',
        title: lang === 'bn' ? 'বাংলা স্ক্রিপ্ট কপি হয়েছে' : 'English script copied',
        message: `${selectedGroup?.genericName || ''}${
          activeScript?.Specialist ? ` · ${activeScript.Specialist}` : ''
        }`,
      });
      window.setTimeout(() => {
        setCopiedLang((curr) => (curr === lang ? null : curr));
      }, 2000);
    } catch {
      pushToast({
        type: 'info',
        title: 'Copy unavailable',
        message: 'Select and copy the detailing text directly.',
      });
    }
  };

  const showBn = langView === 'both' || langView === 'bn';
  const showEn = langView === 'both' || langView === 'en';

  const isViewingSelectedGeneric = subTab === 'detailing' && Boolean(selectedGroup);

  return (
    <div className="space-y-4">
      <StickyBackBar
        title={
          isViewingSelectedGeneric && selectedGroup
            ? selectedGroup.genericName
            : subTab === 'catalog'
            ? 'Products Catalog'
            : 'Product Detailing'
        }
        subtitle={
          isViewingSelectedGeneric && selectedGroup
            ? `${selectedGroup.scripts.length} specialist script${selectedGroup.scripts.length === 1 ? '' : 's'}`
            : `${dataset.Doctor_Product_Detailing.length} scripts · ${genericGroups.length} generics`
        }
        onBack={isViewingSelectedGeneric ? handleBackToGenerics : undefined}
        backLabel={isViewingSelectedGeneric ? 'Generics' : 'Dashboard'}
      />

      {/* Header + Segmented Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-[#0D2B45] dark:text-white tracking-tight">
            Product Detailing
          </h1>
          <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
            Generic-wise bilingual specialist detailing scripts and Drug International Limited product catalog.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Detailing and product sections"
          className="inline-flex items-center p-1 rounded-xl bg-[#EBF4FA] dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 self-start md:self-auto"
        >
          {[
            { id: 'detailing' as SubTab, label: 'Product Detailing', icon: BookOpen },
            { id: 'catalog' as SubTab, label: 'Products Catalog', icon: Pill },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSubTab(tab.id)}
                className={`min-h-[40px] px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                    : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 hidden sm:block" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: GENERIC-WISE PRODUCT DETAILING (3-STEP FLOW)                   */}
      {/* ===================================================================== */}
      {subTab === 'detailing' && (
        <div className="space-y-4">
          {/* Prominent Search Bar (Always visible on Step 1; also searchable to jump between generics) */}
          <section
            aria-label="Search generics or brands"
            className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3.5 sm:p-4"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={genericSearch}
                  onChange={(e) => {
                    setGenericSearch(e.target.value);
                    if (selectedGenericKey && e.target.value.trim()) {
                      setSelectedGenericKey(null);
                      setSelectedScriptId(null);
                    }
                  }}
                  placeholder="Search by Brand Name or Generic Name (e.g., Azimex, Azithromycin, Linzo, Linezolid)..."
                  aria-label="Search detailing by brand or generic name"
                  className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
                />
                {genericSearch && (
                  <button
                    type="button"
                    onClick={() => setGenericSearch('')}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setOnlyWithScripts((prev) => !prev);
                    setSelectedGenericKey(null);
                    setSelectedScriptId(null);
                  }}
                  className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    onlyWithScripts
                      ? 'bg-[#0E7C7B] text-white'
                      : 'bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73]'
                  }`}
                >
                  {onlyWithScripts
                    ? `With Scripts (${genericsWithScriptsCount})`
                    : `All Generics (${genericGroups.length})`}
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => openAddModal('Doctor_Product_Detailing')}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Script</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* STEP 1: GENERIC LIST VIEW */}
          {!selectedGroup ? (
            <section
              aria-labelledby="step1-generics-heading"
              className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-3.5 bg-[#EBF4FA]/60 dark:bg-[#0A1C2D] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="step1-generics-heading"
                    className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white"
                  >
                    Step 1 · Select Generic ({filteredGenericGroups.length})
                  </h2>
                  <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    Products are grouped by Generic Name across all strengths and dosage forms.
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#0E7C7B] dark:text-[#149A99] font-semibold">
                  {genericsWithScriptsCount} generic{genericsWithScriptsCount === 1 ? '' : 's'} with scripts
                </span>
              </div>

              {filteredGenericGroups.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <BookOpen className="w-8 h-8 text-[#0E7C7B] dark:text-[#149A99] mx-auto" />
                  <h3 className="font-display font-bold text-base text-[#0D2B45] dark:text-white">
                    No matching generics found
                  </h3>
                  <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    {onlyWithScripts
                      ? 'Switch to "All Generics" or add a new specialist detailing script.'
                      : `No brand or generic matched "${genericSearch}".`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                    {visibleGenericGroups.map((group) => (
                      <GenericGroupRow
                        key={group.key}
                        group={group}
                        onSelect={handleSelectGeneric}
                      />
                    ))}
                  </div>

                  {hasMoreGenerics && (
                    <div
                      ref={genericsSentinelRef}
                      className="px-4 sm:px-5 py-3 bg-[#F4F8FC]/70 dark:bg-[#0A1C2D] border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-wrap items-center justify-between gap-2.5"
                    >
                      <span className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 tabular-nums">
                        Showing {visibleGenericGroups.length} of {filteredGenericGroups.length} matching generics
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={loadMoreGenerics}
                          className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 hover:border-[#0E7C7B] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
                        >
                          Load {Math.min(WINDOW_PAGE_SIZE, remainingGenerics)} More
                        </button>
                        <button
                          type="button"
                          onClick={showAllGenerics}
                          className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
                        >
                          Show All ({filteredGenericGroups.length})
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            /* ================================================================= */
            /* STEP 2 (SPECIALIST SELECTION) + STEP 3 (BILINGUAL SCRIPT VIEWER)  */
            /* ================================================================= */
            <div className="space-y-4">
              {/* Generic Header + Linked Brand Strengths & Prices Reference */}
              <section
                aria-labelledby="selected-generic-heading"
                className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <button
                      type="button"
                      onClick={handleBackToGenerics}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Generics</span>
                    </button>

                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pt-0.5">
                      <h2
                        id="selected-generic-heading"
                        className="text-xl sm:text-2xl font-display font-bold text-[#0D2B45] dark:text-white tracking-tight"
                      >
                        {selectedGroup.genericName}
                      </h2>
                      {selectedGroup.brandNames.length > 0 && (
                        <span className="text-sm font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                          {selectedGroup.brandNames.join(', ')}
                        </span>
                      )}
                    </div>

                    {selectedGroup.therapeuticClasses.length > 0 && (
                      <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                        {selectedGroup.therapeuticClasses.join(' · ')} ·{' '}
                        {selectedGroup.products.length} strength
                        {selectedGroup.products.length === 1 ? '' : 's'} ·{' '}
                        {selectedGroup.scripts.length} saved specialist script
                        {selectedGroup.scripts.length === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleAddSpecialistScript(selectedGroup)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add New Specialist Script</span>
                    </button>
                  )}
                </div>

                {/* Linked Drug International Brand Strengths with Pack Size & Single/Box Prices */}
                {selectedGroup.products.length > 0 && (
                  <div className="pt-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 mb-2">
                      Available Strengths &amp; Prices (Quick Reference)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {selectedGroup.products.map((prod, idx) => {
                        const bName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
                        const singlePrice = formatBDT(prod.Single_Price);
                        const boxPrice = formatBDT(prod.Box_Price ?? prod.MRP_BDT);
                        return (
                          <button
                            key={`${prod.Product_ID}-${idx}`}
                            type="button"
                            onClick={() => openProductBrief(prod.Product_ID)}
                            className="text-left rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] px-3.5 py-2.5 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-bold text-[#0D2B45] dark:text-white truncate">
                                {bName}
                              </span>
                              <span className="text-[11px] font-mono text-[#0D2B45]/50 dark:text-[#EBF4FA]/50 shrink-0">
                                {prod.Product_ID}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5 truncate">
                              {[prod.Strength, prod.Dosage_Form, prod.Pack_Size ? `Pack: ${prod.Pack_Size}` : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                            <div className="mt-1.5 flex items-center gap-2 text-xs font-mono tabular-nums">
                              <span className="text-[#0D2B45] dark:text-white font-semibold">
                                Single: {singlePrice}
                              </span>
                              <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                              <span className="text-[#0E7C7B] dark:text-[#149A99] font-semibold">
                                Box: {boxPrice}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* STEP 2: SAVED SPECIALISTS SELECTION (ONLY specialists with saved scripts for this generic) */}
              <section
                aria-labelledby="step2-saved-specialists-heading"
                className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                    <div>
                      <h3
                        id="step2-saved-specialists-heading"
                        className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white"
                      >
                        Step 2 · Saved Specialist Scripts ({selectedGroup.scripts.length})
                      </h3>
                      <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                        Select a specialist below to view its bilingual detailing script.
                      </p>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => handleAddSpecialistScript(selectedGroup)}
                      className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                      <span>+ Add New Specialist Script</span>
                    </button>
                  )}
                </div>

                {selectedGroup.scripts.length === 0 ? (
                  <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-7 text-center space-y-3">
                    <Languages className="w-8 h-8 text-[#0E7C7B] dark:text-[#149A99] mx-auto" />
                    <div>
                      <h4 className="font-display font-bold text-base text-[#0D2B45] dark:text-white">
                        No specialist detailing scripts available for {selectedGroup.genericName} yet
                      </h4>
                      <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1 max-w-md mx-auto">
                        {isSuperAdmin
                          ? `Create your first bilingual (বাংলা & English) specialist detailing script — it will automatically link to all strengths under ${selectedGroup.genericName}.`
                          : 'Specialist detailing scripts for this generic will appear here once published.'}
                      </p>
                    </div>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleAddSpecialistScript(selectedGroup)}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Add New Specialist Script</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {selectedGroup.scripts.map((script, idx) => {
                      const isSelected = activeScript?.Detailing_ID === script.Detailing_ID;
                      const hasBn = Boolean(String(script.Detailing_BN ?? '').trim());
                      const hasEn = Boolean(String(script.Detailing_EN ?? '').trim());
                      const langMeta =
                        hasBn && hasEn
                          ? 'বাংলা · English'
                          : hasBn
                          ? 'বাংলা only'
                          : hasEn
                          ? 'English only'
                          : 'Draft';

                      return (
                        <button
                          key={`${script.Detailing_ID}-${idx}`}
                          type="button"
                          onClick={() => setSelectedScriptId(script.Detailing_ID)}
                          className={`min-h-[60px] px-4 py-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                            isSelected
                              ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] border-[#0D2B45] dark:border-[#149A99] text-white'
                              : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[#0D2B45] dark:text-white hover:border-[#0E7C7B]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-display font-bold truncate">
                              {script.Specialist || 'General Specialist'}
                            </div>
                            <div
                              className={`text-[11px] mt-0.5 font-mono truncate ${
                                isSelected
                                  ? 'text-[#EBF4FA]/80'
                                  : 'text-[#0D2B45]/55 dark:text-[#EBF4FA]/55'
                              }`}
                            >
                              {langMeta} · {script.Detailing_ID}
                            </div>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 shrink-0 ${
                              isSelected
                                ? 'text-white'
                                : 'text-[#0E7C7B] dark:text-[#149A99]'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* STEP 3: BILINGUAL DETAILING SCRIPT VIEWER (Inline on desktop, full-screen reader on mobile) */}
              {selectedGroup.scripts.length > 0 && (
                <section
                  aria-labelledby="step3-script-viewer-heading"
                  className={`${
                    activeScript ? 'hidden md:block' : 'block'
                  } rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 sm:p-6 space-y-4`}
                >
                  {!activeScript ? (
                    <div className="py-8 text-center space-y-1.5">
                      <BookOpen className="w-7 h-7 text-[#0E7C7B] dark:text-[#149A99] mx-auto" />
                      <h3
                        id="step3-script-viewer-heading"
                        className="font-display font-bold text-base text-[#0D2B45] dark:text-white"
                      >
                        Step 3 · Detailing Script View
                      </h3>
                      <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                        Select any specialist above to read the saved বাংলা &amp; English detailing script.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99] font-mono">
                            Step 3 · Detailing Script · {activeScript.Detailing_ID}
                          </p>
                          <h3
                            id="step3-script-viewer-heading"
                            className="text-lg sm:text-xl font-display font-bold text-[#0D2B45] dark:text-white mt-0.5"
                          >
                            {selectedGroup.genericName} — {activeScript.Specialist || 'General'}
                          </h3>
                          {activeScript.Product_ID && (
                            <p className="text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 font-mono mt-0.5">
                              Linked IDs: {activeScript.Product_ID}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div
                            role="tablist"
                            aria-label="Detailing script language"
                            className="inline-flex items-center p-0.5 rounded-xl bg-[#EBF4FA] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
                          >
                            {[
                              { id: 'both' as LanguageView, label: 'Both' },
                              { id: 'bn' as LanguageView, label: 'বাংলা' },
                              { id: 'en' as LanguageView, label: 'English' },
                            ].map((tab) => {
                              const active = langView === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={active}
                                  onClick={() => setLangView(tab.id)}
                                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                    active
                                      ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                                      : 'text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 hover:text-[#0D2B45] dark:hover:text-white'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              );
                            })}
                          </div>

                          {isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    'Doctor_Product_Detailing',
                                    activeScript as unknown as Record<string, unknown>
                                  )
                                }
                                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit Script</span>
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
                                title="Delete this detailing script"
                                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-[#0D2B45]/60 hover:text-rose-600 dark:text-[#EBF4FA]/60 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div
                        className={`grid grid-cols-1 gap-4 ${
                          langView === 'both' ? 'md:grid-cols-2' : ''
                        }`}
                      >
                        {showBn && (
                          <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                                <span className="text-xs font-bold text-[#0E7C7B] dark:text-[#149A99]">
                                  বাংলা শর্ট ডিটেইলিং
                                </span>
                                {activeScript.Detailing_BN && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyScript('bn', activeScript.Detailing_BN)
                                    }
                                    className="text-xs font-medium text-[#0D2B45]/65 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/65 dark:hover:text-[#149A99] inline-flex items-center gap-1"
                                  >
                                    {copiedLang === 'bn' ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {activeScript.Detailing_BN ? (
                                <p className="mt-3.5 text-[15px] text-[#0D2B45] dark:text-[#EBF4FA] leading-[1.85] whitespace-pre-line">
                                  {activeScript.Detailing_BN}
                                </p>
                              ) : (
                                <p className="mt-3.5 text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 italic">
                                  {isSuperAdmin
                                    ? 'No Bengali script entered yet. Click "Edit Script" to add.'
                                    : 'No Bengali script available yet.'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {showEn && (
                          <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                                <span className="text-xs font-bold text-[#0E7C7B] dark:text-[#149A99]">
                                  English Short Detailing
                                </span>
                                {activeScript.Detailing_EN && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyScript('en', activeScript.Detailing_EN)
                                    }
                                    className="text-xs font-medium text-[#0D2B45]/65 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/65 dark:hover:text-[#149A99] inline-flex items-center gap-1"
                                  >
                                    {copiedLang === 'en' ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {activeScript.Detailing_EN ? (
                                <p className="mt-3.5 text-sm sm:text-[15px] text-[#0D2B45] dark:text-[#EBF4FA] leading-relaxed whitespace-pre-line">
                                  {activeScript.Detailing_EN}
                                </p>
                              ) : (
                                <p className="mt-3.5 text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 italic">
                                  {isSuperAdmin
                                    ? 'No English script entered yet. Click "Edit Script" to add.'
                                    : 'No English script available yet.'}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* FULL-SCREEN MOBILE DETAILING SCRIPT READER (< md) */}
              {activeScript && (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${selectedGroup.genericName} detailing script reader`}
                  className="md:hidden fixed inset-0 z-50 h-[100dvh] bg-[#F4F8FC] dark:bg-[#071522] flex flex-col overflow-hidden"
                >
                  {/* Sticky Mobile Top Bar with Back, Edit & Delete */}
                  <header className="shrink-0 bg-[#0B2239] text-white px-3.5 pt-2.5 pb-3.5 border-b border-white/10 pt-safe space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedScriptId(null)}
                        className="min-h-[44px] -ml-1.5 px-2.5 rounded-xl text-white hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        <span>Back</span>
                      </button>

                      {isSuperAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(
                                'Doctor_Product_Detailing',
                                activeScript as unknown as Record<string, unknown>
                              )
                            }
                            aria-label="Edit detailing script"
                            className="min-h-[44px] px-3 rounded-xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
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
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-300 hover:bg-white/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-[#7CE0DF] uppercase tracking-wider">
                        Detailing Script · {activeScript.Specialist || 'General'}
                      </p>
                      <h2 className="text-xl font-display font-bold text-white leading-snug mt-0.5 break-words">
                        {selectedGroup.genericName}
                      </h2>
                    </div>

                    {/* Mobile Language Switcher */}
                    <div
                      role="tablist"
                      aria-label="Detailing script language mobile"
                      className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/10"
                    >
                      {[
                        { id: 'both' as LanguageView, label: 'Both' },
                        { id: 'bn' as LanguageView, label: 'বাংলা' },
                        { id: 'en' as LanguageView, label: 'English' },
                      ].map((tab) => {
                        const active = langView === tab.id;
                        return (
                          <button
                            key={`mob-${tab.id}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setLangView(tab.id)}
                            className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                              active
                                ? 'bg-[#0E7C7B] text-white'
                                : 'text-white/80 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </header>

                  {/* Scrollable High-Legibility Reader Body */}
                  <div className="flex-1 overflow-y-auto px-4 py-5 pb-10 pb-safe space-y-4">
                    {showBn && (
                      <article className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                          <span className="text-xs font-bold text-[#0E7C7B] dark:text-[#7CE0DF]">
                            বাংলা শর্ট ডিটেইলিং
                          </span>
                          {activeScript.Detailing_BN && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyScript('bn', activeScript.Detailing_BN)
                              }
                              className="min-h-[40px] px-3 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-xs font-semibold text-[#0D2B45] dark:text-white inline-flex items-center gap-1.5"
                            >
                              {copiedLang === 'bn' ? (
                                <>
                                  <Check className="w-4 h-4 text-[#0E7C7B] dark:text-[#7CE0DF]" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {activeScript.Detailing_BN ? (
                          <p className="text-[17px] text-[#0D2B45] dark:text-[#EBF4FA] leading-[1.92] whitespace-pre-line">
                            {activeScript.Detailing_BN}
                          </p>
                        ) : (
                          <p className="text-sm text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 italic">
                            {isSuperAdmin
                              ? 'No Bengali script entered yet. Tap "Edit" above to add.'
                              : 'No Bengali script available yet.'}
                          </p>
                        )}
                      </article>
                    )}

                    {showEn && (
                      <article className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                          <span className="text-xs font-bold text-[#0E7C7B] dark:text-[#7CE0DF]">
                            English Short Detailing
                          </span>
                          {activeScript.Detailing_EN && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyScript('en', activeScript.Detailing_EN)
                              }
                              className="min-h-[40px] px-3 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-xs font-semibold text-[#0D2B45] dark:text-white inline-flex items-center gap-1.5"
                            >
                              {copiedLang === 'en' ? (
                                <>
                                  <Check className="w-4 h-4 text-[#0E7C7B] dark:text-[#7CE0DF]" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {activeScript.Detailing_EN ? (
                          <p className="text-base text-[#0D2B45] dark:text-[#EBF4FA] leading-[1.8] whitespace-pre-line">
                            {activeScript.Detailing_EN}
                          </p>
                        ) : (
                          <p className="text-sm text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 italic">
                            {isSuperAdmin
                              ? 'No English script entered yet. Tap "Edit" above to add.'
                              : 'No English script available yet.'}
                          </p>
                        )}
                      </article>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PRODUCTS CATALOG SUB-TAB (WITH 5 PRODUCT GROUPS & BULK ASSIGN) */}
      {/* ===================================================================== */}
      {subTab === 'catalog' && (
        <ProductsCatalogView
          embedded
          onOpenGenericDetailing={(genericName) => {
            const gKey = normalizeGenericKey(genericName);
            const matched = genericGroupByKey.get(gKey);
            if (matched) {
              setSelectedGenericKey(matched.key);
              setSelectedScriptId(null);
            }
            setSubTab('detailing');
          }}
        />
      )}

    </div>
  );
};
