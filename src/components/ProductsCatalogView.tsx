import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, PRODUCT_GROUP_CODES, ProductGroupCode } from '../types';
import {
  buildGenericGroups,
  formatBDT,
  normalizeGenericKey,
  normalizeProductGroup,
} from '../services/api';
import { WatchNowButton } from './WatchNowButton';
import { useDebouncedValue, useWindowedList } from '../hooks/useWindowedList';

type GroupFilterKey = 'all' | ProductGroupCode;

interface ProductsCatalogViewProps {
  embedded?: boolean;
  onOpenGenericDetailing?: (genericName: string, productId: string) => void;
}

const WINDOW_PAGE_SIZE = 30;

const GROUP_BADGE_STYLE: Partial<Record<ProductGroupCode, string>> = {
  A: 'bg-[#0D2B45]/10 text-[#0D2B45] dark:bg-[#0E7C7B]/25 dark:text-[#7CE0DF]',
  B: 'bg-[#0E7C7B]/12 text-[#095C5B] dark:bg-[#149A99]/25 dark:text-[#8EEAE8]',
  C: 'bg-[#1D4E89]/12 text-[#1D4E89] dark:bg-[#2A6DB3]/25 dark:text-[#93C5FD]',
  D: 'bg-slate-200/80 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  O: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};

const getGroupBadgeStyle = (code: ProductGroupCode): string =>
  GROUP_BADGE_STYLE[code] ||
  'bg-teal-50 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200';

const GROUP_ORDER: readonly ProductGroupCode[] = PRODUCT_GROUP_CODES;

function formatCompactPricePair(
  singleRaw: Product['Single_Price'],
  boxRaw: Product['Box_Price'] | Product['MRP_BDT']
): { single: string; box: string } {
  const singleFormatted = formatBDT(singleRaw);
  const boxFormatted = formatBDT(boxRaw);
  return {
    single: singleFormatted !== '—' ? singleFormatted.replace(/\s+/g, '') : '',
    box: boxFormatted !== '—' ? boxFormatted.replace(/\s+/g, '') : '',
  };
}

interface ProductCardRowProps {
  prod: Product;
  scriptCount: number;
  isSuperAdmin: boolean;
  onOpenBrief: (productId: string) => void;
  onOpenDetailing: (prod: Product) => void;
  onEdit: (prod: Product) => void;
}

const ProductCardRow: React.FC<ProductCardRowProps> = React.memo(
  ({ prod, scriptCount, isSuperAdmin, onOpenBrief, onOpenDetailing, onEdit }) => {
    const brandName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
    const rawGeneric = String(prod.Generic_Name ?? '').trim();
    const genericName = rawGeneric || '—';
    const singlePrice = formatBDT(prod.Single_Price);
    const boxPrice = formatBDT(prod.Box_Price ?? prod.MRP_BDT);
    const compactPrice = formatCompactPricePair(
      prod.Single_Price,
      prod.Box_Price ?? prod.MRP_BDT
    );
    const activeGroup = normalizeProductGroup(prod.Product_Group);

    const inlineMetaParts = [
      prod.Strength,
      prod.Dosage_Form,
      prod.Pack_Size,
      prod.Therapeutic_Class,
    ].filter(Boolean);

    return (
      <article className="px-3.5 sm:px-5 py-2.5 lg:py-3 transition-colors hover:bg-[#F4F8FC]/80 dark:hover:bg-[#133859]/25">
        {/* DESKTOP ROW (>= lg) */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center">
          <div className="col-span-4 min-w-0">
            <button
              type="button"
              onClick={() => onOpenBrief(prod.Product_ID)}
              className="text-left group block max-w-full cursor-pointer"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white group-hover:text-[#0E7C7B] dark:group-hover:text-[#149A99] transition-colors truncate">
                  {brandName}
                </span>
                {activeGroup && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide shrink-0 ${getGroupBadgeStyle(activeGroup)}`}
                  >
                    G-{activeGroup}
                  </span>
                )}
              </div>
            </button>

            {rawGeneric ? (
              <div className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99] truncate max-w-full mt-0.5">
                {genericName}
              </div>
            ) : (
              <div className="text-xs font-medium text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 truncate mt-0.5">
                —
              </div>
            )}

            {prod.Therapeutic_Class && (
              <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 truncate mt-0.5">
                {prod.Therapeutic_Class}
              </div>
            )}
          </div>

          <div className="col-span-2 min-w-0 text-xs">
            <div className="font-semibold text-[#0D2B45] dark:text-white truncate">
              {[prod.Strength, prod.Dosage_Form].filter(Boolean).join(' · ') || '—'}
            </div>
            <div className="text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-0.5 font-mono truncate">
              {prod.Pack_Size || '—'}
            </div>
          </div>

          <div className="col-span-2 text-right font-mono tabular-nums">
            <div className="text-xs text-[#0D2B45] dark:text-white font-semibold">
              {singlePrice}
            </div>
            <div className="text-xs text-[#0E7C7B] dark:text-[#149A99] font-semibold mt-0.5">
              Box {boxPrice}
            </div>
          </div>

          <div className="col-span-4 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onOpenDetailing(prod)}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Detailing</span>
              {scriptCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-white/85">
                  ({scriptCount})
                </span>
              )}
            </button>

            <WatchNowButton
              videoUrl={prod.Video_URL}
              fallbackUrl={prod.YouTube_URL}
              size="card"
            />

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => onEdit(prod)}
                aria-label={`Edit ${brandName}`}
                title={`Edit ${brandName}`}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[#0D2B45]/70 dark:text-[#EBF4FA]/75 hover:border-[#0E7C7B] hover:text-[#0E7C7B] dark:hover:text-[#7CE0DF] shrink-0 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* SLIM ULTRA-CLEAN MOBILE CARD (< lg) */}
        <div className="lg:hidden space-y-1.5">
          {/* Row 1: Brand + Clean G-A..G-O Badge (left) | Compact Single & Box Price (right) */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => onOpenBrief(prod.Product_ID)}
                className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white hover:text-[#0E7C7B] dark:hover:text-[#149A99] text-left truncate leading-snug cursor-pointer"
              >
                {brandName}
              </button>
              {activeGroup && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold leading-none shrink-0 ${getGroupBadgeStyle(activeGroup)}`}
                >
                  G-{activeGroup}
                </span>
              )}
            </div>

            {(compactPrice.single || compactPrice.box) && (
              <div className="text-[11.5px] font-mono tabular-nums whitespace-nowrap shrink-0">
                {compactPrice.single && (
                  <span className="font-bold text-[#0D2B45] dark:text-white">
                    {compactPrice.single}
                  </span>
                )}
                {compactPrice.single && compactPrice.box && (
                  <span className="text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 mx-1">·</span>
                )}
                {compactPrice.box && (
                  <span className="font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                    Box {compactPrice.box}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Row 2: Teal Generic Name + compact Strength / Form / Pack / Class */}
          <div className="text-[11.5px] leading-snug text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            {rawGeneric ? (
              <span className="font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                {genericName}
              </span>
            ) : (
              <span className="font-medium text-[#0D2B45]/45 dark:text-[#EBF4FA]/45">—</span>
            )}

            {inlineMetaParts.length > 0 && (
              <>
                <span aria-hidden="true" className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">
                  ·
                </span>
                <span className="min-w-0 break-words">{inlineMetaParts.join(' · ')}</span>
              </>
            )}
          </div>

          {/* Row 3: Sleek 50% / 50% Action Row — Detailing (left) | Watch Now (right) + Admin-only Edit */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onOpenDetailing(prod)}
                className="w-full min-h-[38px] px-2.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors active:scale-[0.98] cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Detailing</span>
                {scriptCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-white/85">
                    ({scriptCount})
                  </span>
                )}
              </button>

              <WatchNowButton
                videoUrl={prod.Video_URL}
                fallbackUrl={prod.YouTube_URL}
                size="full"
              />
            </div>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => onEdit(prod)}
                aria-label={`Edit ${brandName}`}
                title={`Edit ${brandName}`}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 bg-[#F4F8FC] dark:bg-[#071522] text-[#0D2B45]/75 dark:text-[#EBF4FA]/80 hover:border-[#0E7C7B] hover:text-[#0E7C7B] shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }
);
ProductCardRow.displayName = 'ProductCardRow';

export const ProductsCatalogView: React.FC<ProductsCatalogViewProps> = ({
  embedded = false,
  onOpenGenericDetailing,
}) => {
  const {
    dataset,
    isSuperAdmin,
    navigateHome,
    openProductBrief,
    openAddModal,
    openEditModal,
    startDetailingFlow,
  } = useApp();

  const [groupFilter, setGroupFilter] = useState<GroupFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dosageFormFilter, setDosageFormFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  // Debounce keystrokes by 150ms so searching 800+ products stays butter-smooth on mobile
  const debouncedSearch = useDebouncedValue(searchQuery, 150);

  // Map normalized generic name -> saved detailing script count
  const genericScriptCountMap = useMemo(() => {
    const groups = buildGenericGroups(dataset.Products, dataset.Doctor_Product_Detailing);
    const map = new Map<string, number>();
    groups.forEach((g) => {
      map.set(g.key, g.scripts.length);
    });
    return map;
  }, [dataset.Products, dataset.Doctor_Product_Detailing]);

  // Precompute normalized filter fields + lowercased search haystack once per product load
  const indexedProducts = useMemo(
    () =>
      dataset.Products.map((prod) => {
        const brandName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
        return {
          prod,
          group: normalizeProductGroup(prod.Product_Group),
          dosageForm: String(prod.Dosage_Form ?? '').trim(),
          therapeuticClass: String(prod.Therapeutic_Class ?? '').trim(),
          genericKey: normalizeGenericKey(prod.Generic_Name || brandName),
          haystack: [
            prod.Brand_Name,
            prod.Product_Name,
            prod.Generic_Name,
            prod.Strength,
            prod.Dosage_Form,
            prod.Therapeutic_Class,
            prod.Approved_Indications,
            prod.Product_Group,
            prod.Product_ID,
          ]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' '),
        };
      }),
    [dataset.Products]
  );

  const uniqueGenericsCount = useMemo(() => {
    const keys = new Set<string>();
    indexedProducts.forEach((item) => {
      if (item.genericKey) keys.add(item.genericKey);
    });
    return keys.size;
  }, [indexedProducts]);

  // Dynamic Group dropdown options populated from catalog
  const groupOptions = useMemo(() => {
    const counts = new Map<ProductGroupCode, number>();
    indexedProducts.forEach((item) => {
      if (item.group) {
        counts.set(item.group, (counts.get(item.group) || 0) + 1);
      }
    });
    return GROUP_ORDER.map((code) => ({
      code,
      label: `Group ${code}`,
      count: counts.get(code) || 0,
    })).filter((item) => item.count > 0);
  }, [indexedProducts]);

  const dosageForms = useMemo(() => {
    const set = new Set<string>();
    indexedProducts.forEach((item) => {
      if (item.dosageForm) set.add(item.dosageForm);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [indexedProducts]);

  const therapeuticClasses = useMemo(() => {
    const set = new Set<string>();
    indexedProducts.forEach((item) => {
      if (item.therapeuticClass) set.add(item.therapeuticClass);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [indexedProducts]);

  // Search & filter across ALL 800+ products in memory
  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return indexedProducts.filter((item) => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false;
      if (dosageFormFilter && item.dosageForm !== dosageFormFilter) return false;
      if (classFilter && item.therapeuticClass !== classFilter) return false;
      if (!q) return true;
      return item.haystack.includes(q);
    });
  }, [indexedProducts, groupFilter, debouncedSearch, dosageFormFilter, classFilter]);

  // Render only first 30 matching cards immediately (<100ms), auto-load 30 more on scroll
  const {
    visibleItems: displayedProducts,
    hasMore,
    remainingCount: remainingToLoad,
    loadMore,
    showAll,
    sentinelRef,
  } = useWindowedList(
    filteredProducts,
    `${groupFilter}|${debouncedSearch}|${dosageFormFilter}|${classFilter}`,
    WINDOW_PAGE_SIZE
  );

  const hasActiveFilters = Boolean(
    searchQuery.trim() || groupFilter !== 'all' || dosageFormFilter || classFilter
  );

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setGroupFilter('all');
    setDosageFormFilter('');
    setClassFilter('');
  }, []);

  const handleOpenGenericDetailing = useCallback(
    (prod: Product) => {
      const targetGeneric =
        String(prod.Generic_Name ?? '').trim() ||
        String(prod.Brand_Name || prod.Product_Name || '').trim();
      if (onOpenGenericDetailing) {
        onOpenGenericDetailing(targetGeneric, prod.Product_ID);
        return;
      }
      startDetailingFlow({
        genericName: targetGeneric,
        productId: prod.Product_ID,
        subTab: 'detailing',
      });
    },
    [onOpenGenericDetailing, startDetailingFlow]
  );

  const handleEditProduct = useCallback(
    (prod: Product) => {
      openEditModal('Products', prod as unknown as Record<string, unknown>);
    },
    [openEditModal]
  );

  return (
    <div className="space-y-3">
      {/* Unified Sticky Header + Instant Search + Dynamic Dropdown Filters */}
      <div
        className={`${
          embedded
            ? 'rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3 sm:p-3.5'
            : 'sticky top-[54px] md:top-16 z-20 -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 pt-2 pb-2.5 bg-[#F4F8FC] dark:bg-[#071522] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10'
        } space-y-2`}
      >
        {/* Row 1: Clean Back + "Products" Title (never truncated) + Result Counter + Reset + Admin-Only Add */}
        {!embedded && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={navigateHome}
                aria-label="Back to Dashboard"
                className="min-h-[40px] px-2.5 -ml-1 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] text-[#0D2B45] dark:text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                <span>Back</span>
              </button>

              <div className="min-w-0">
                <h1 className="font-display font-bold text-base sm:text-lg text-[#0D2B45] dark:text-white leading-tight whitespace-nowrap">
                  Products
                </h1>
                <p className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 tabular-nums whitespace-nowrap">
                  {dataset.Products.length} products · {uniqueGenericsCount} generics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-mono tabular-nums text-[#0D2B45]/65 dark:text-[#EBF4FA]/70 whitespace-nowrap">
                <span className="hidden sm:inline">Showing </span>
                <strong className="text-[#0D2B45] dark:text-white">
                  {filteredProducts.length}
                </strong>
                <span> of {dataset.Products.length}</span>
              </span>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="min-h-[34px] px-2.5 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => openAddModal('Products')}
                  className="min-h-[36px] px-2.5 rounded-lg bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Row 2: Instant Search + 3 Dynamic Dropdown Selects (Group, Therapeutic Class, Dosage Form) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Brand, Generic, or Indication..."
              aria-label="Search products by brand, generic, or indication"
              className="w-full min-h-[40px] pl-9 pr-9 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 md:flex md:items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Group Dropdown */}
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as GroupFilterKey)}
              aria-label="Filter by product group"
              className="w-full md:w-36 min-h-[38px] md:min-h-[40px] px-2 sm:px-2.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-xs sm:text-[13px] font-medium text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] cursor-pointer truncate"
            >
              <option value="all">Group: All</option>
              {groupOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>

            {/* Therapeutic Class Dropdown */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Filter by therapeutic class"
              className="w-full md:w-44 min-h-[38px] md:min-h-[40px] px-2 sm:px-2.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-xs sm:text-[13px] font-medium text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] cursor-pointer truncate"
            >
              <option value="">Class: All</option>
              {therapeuticClasses.map((tc) => (
                <option key={tc} value={tc}>
                  {tc}
                </option>
              ))}
            </select>

            {/* Dosage Form Dropdown */}
            <select
              value={dosageFormFilter}
              onChange={(e) => setDosageFormFilter(e.target.value)}
              aria-label="Filter by dosage form"
              className="w-full md:w-40 min-h-[38px] md:min-h-[40px] px-2 sm:px-2.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-xs sm:text-[13px] font-medium text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] cursor-pointer truncate"
            >
              <option value="">Form: All</option>
              {dosageForms.map((df) => (
                <option key={df} value={df}>
                  {df}
                </option>
              ))}
            </select>

            {/* Embedded Result Count + Reset + Admin-Only Add */}
            {embedded && (
              <div className="col-span-3 md:col-span-1 flex items-center justify-between md:justify-end gap-2 pt-0.5 md:pt-0">
                <span className="text-[11px] font-mono tabular-nums text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 whitespace-nowrap">
                  Showing{' '}
                  <strong className="text-[#0D2B45] dark:text-white">
                    {filteredProducts.length}
                  </strong>{' '}
                  of {dataset.Products.length}
                </span>
                <div className="flex items-center gap-1.5">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="min-h-[34px] px-2.5 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => openAddModal('Products')}
                      className="min-h-[36px] px-3 rounded-lg bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Product</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product List: Compact High-Density Mobile Cards + Scannable Desktop Table */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center space-y-2.5">
          <Pill className="w-8 h-8 text-[#0E7C7B] dark:text-[#149A99] mx-auto" />
          <h2 className="text-base font-display font-bold text-[#0D2B45] dark:text-white">
            No matching products found
          </h2>
          <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
            Try another Brand Name, Generic Name, Indication, or reset your active filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-1 min-h-[40px] px-4 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      ) : (
        <section
          aria-label="Products catalog list"
          className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 overflow-hidden"
        >
          {/* Desktop Table Header */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-5 py-2.5 bg-[#EBF4FA]/70 dark:bg-[#0A1C2D] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[11px] uppercase tracking-wider font-semibold text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 items-center">
            <div className="col-span-4">Brand &amp; Generic</div>
            <div className="col-span-2">Strength · Form · Pack</div>
            <div className="col-span-2 text-right">Single / Box Price</div>
            <div className="col-span-4 text-right">Actions</div>
          </div>

          <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
            {displayedProducts.map((item, idx) => {
              const { prod, genericKey } = item;
              const brandName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
              const cardKey = prod.Product_ID || `${brandName}-${idx}`;
              return (
                <ProductCardRow
                  key={`${cardKey}-${idx}`}
                  prod={prod}
                  scriptCount={genericScriptCountMap.get(genericKey) || 0}
                  isSuperAdmin={isSuperAdmin}
                  onOpenBrief={openProductBrief}
                  onOpenDetailing={handleOpenGenericDetailing}
                  onEdit={handleEditProduct}
                />
              );
            })}
          </div>

          {/* Auto-load IntersectionObserver sentinel + Load More fallback */}
          {hasMore && (
            <div
              ref={sentinelRef}
              className="px-4 sm:px-5 py-3 bg-[#F4F8FC]/70 dark:bg-[#0A1C2D] border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-wrap items-center justify-between gap-2.5"
            >
              <span className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 tabular-nums">
                Showing {displayedProducts.length} of {filteredProducts.length} matching products
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadMore}
                  className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 hover:border-[#0E7C7B] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
                >
                  Load {Math.min(WINDOW_PAGE_SIZE, remainingToLoad)} More
                </button>
                <button
                  type="button"
                  onClick={showAll}
                  className="min-h-[40px] sm:min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-xs font-semibold text-[#0D2B45] dark:text-white transition-colors cursor-pointer"
                >
                  Show All ({filteredProducts.length})
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
