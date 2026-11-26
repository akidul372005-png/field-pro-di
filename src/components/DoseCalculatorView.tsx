import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Baby,
  BookOpen,
  Calculator,
  Check,
  Clock,
  Copy,
  Droplets,
  Pill,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  Users,
  Utensils,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DoseCalculationResult, DosePatientMode, Product } from '../types';
import {
  buildDoseCacheKey,
  computePediatricDoseMath,
  fetchDoseCalculationFromGemini,
  formatBDT,
  formatDoseRangeMg,
  formatDoseRangeMl,
  formatDoseSummaryForCopy,
  isLiquidDosageForm,
  loadCachedDoseCalculation,
  normalizeProductGroup,
  parseCommaList,
  parseLiquidStrength,
  productMatchesPreferredGeneric,
  saveCachedDoseCalculation,
} from '../services/api';
import {
  buildCatalogFallbackDoseCalculation,
  STANDARD_CATALOG_REFERENCE_LABEL,
} from '../services/doseFallback';
import { StickyBackBar } from './StickyBackBar';

const DOSAGE_FORM_OPTIONS = [
  'Suspension / PFS',
  'Syrup',
  'Pediatric Drops',
  'Tablet',
  'Capsule',
  'Oral Solution',
  'Injection',
  'Cream / Ointment',
  'Inhaler / Spray',
  'Other',
] as const;

const COMMON_INDICATIONS = [
  'URTI',
  'UTI',
  'Typhoid Fever',
  'CAP (Pneumonia)',
  'Acute Otitis Media',
  'Pharyngitis / Tonsillitis',
  'Skin & Soft Tissue Infection',
  'Fever / Pain',
];

const QUICK_WEIGHTS_KG = [6, 10, 12, 15, 20, 25, 30];

export const DoseCalculatorView: React.FC = () => {
  const {
    dataset,
    setActiveTab,
    openProductBrief,
    startDetailingFlow,
    pushToast,
  } = useApp();

  // Search & Product selection state
  const [searchInput, setSearchInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('');

  // Patient & Clinical input state
  const [patientMode, setPatientMode] = useState<DosePatientMode>('both');
  const [weightInput, setWeightInput] = useState('');
  const [ageValue, setAgeValue] = useState('');
  const [ageUnit, setAgeUnit] = useState<'years' | 'months'>('years');
  const [indication, setIndication] = useState('');
  const [renalElderlyCaution, setRenalElderlyCaution] = useState(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);

  // Result & async state
  const [result, setResult] = useState<DoseCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const comboboxRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  // Close autocomplete dropdown on outside click
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Cleanup any in-flight calculation on unmount
  useEffect(() => {
    return () => {
      requestSeqRef.current += 1;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  // Live product suggestions from the Products Google Sheet
  const productMatches = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    const allProducts = dataset.Products || [];
    if (!q) {
      // Show helpful starter picks (prioritizing suspensions/syrups & popular antibiotics first)
      const liquids = allProducts.filter((p) =>
        isLiquidDosageForm(p.Dosage_Form, p.Strength)
      );
      const others = allProducts.filter(
        (p) => !isLiquidDosageForm(p.Dosage_Form, p.Strength)
      );
      return [...liquids.slice(0, 8), ...others.slice(0, 7)].slice(0, 14);
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: { product: Product; score: number }[] = [];

    for (const prod of allProducts) {
      const brand = String(prod.Brand_Name || prod.Product_Name || '').toLowerCase();
      const gen = String(prod.Generic_Name || '').toLowerCase();
      const str = String(prod.Strength || '').toLowerCase();
      const form = String(prod.Dosage_Form || '').toLowerCase();
      const tClass = String(prod.Therapeutic_Class || '').toLowerCase();
      const combined = `${brand} ${gen} ${str} ${form} ${tClass}`;

      if (!tokens.every((t) => combined.includes(t))) continue;

      let score = 10;
      if (brand === q || gen === q) score += 50;
      else if (brand.startsWith(q) || gen.startsWith(q)) score += 30;
      if (isLiquidDosageForm(prod.Dosage_Form, prod.Strength)) score += 4;
      scored.push({ product: prod, score });
    }

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        String(a.product.Brand_Name || a.product.Product_Name || '').localeCompare(
          String(b.product.Brand_Name || b.product.Product_Name || '')
        )
    );
    return scored.slice(0, 16).map((s) => s.product);
  }, [dataset.Products, searchInput]);

  // Quick indication chips from the selected product's Approved_Indications + defaults
  const indicationQuickChips = useMemo(() => {
    const chips: string[] = [];
    if (selectedProduct?.Approved_Indications) {
      const parsed = parseCommaList(selectedProduct.Approved_Indications)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 42);
      for (const item of parsed) {
        if (!chips.some((c) => c.toLowerCase() === item.toLowerCase())) {
          chips.push(item);
        }
        if (chips.length >= 6) break;
      }
    }
    for (const fallback of COMMON_INDICATIONS) {
      if (chips.length >= 8) break;
      if (!chips.some((c) => c.toLowerCase() === fallback.toLowerCase())) {
        chips.push(fallback);
      }
    }
    return chips;
  }, [selectedProduct]);

  const parsedWeightKg = useMemo(() => {
    const cleaned = weightInput.trim();
    if (!cleaned) return null;
    const val = Number(cleaned);
    if (!Number.isFinite(val) || val <= 0 || val > 250) return null;
    return val;
  }, [weightInput]);

  // Live liquid strength parser (updates immediately as user edits strength or selects a brand)
  const activeStrength = strength.trim() || result?.strength || '';
  const activeDosageForm = dosageForm.trim() || result?.dosageForm || '';
  const liquidInfo = useMemo(
    () => parseLiquidStrength(activeStrength, activeDosageForm),
    [activeStrength, activeDosageForm]
  );

  // Live deterministic front-end pediatric math (recalculates instantly when weight or liquid strength changes!)
  const computedPediatric = useMemo(() => {
    if (!result) return null;
    return computePediatricDoseMath(parsedWeightKg, result.pediatric, liquidInfo);
  }, [result, parsedWeightKg, liquidInfo]);

  // Matching Drug International Limited brands & strengths for the active generic
  const matchingDilBrands = useMemo(() => {
    const targetGeneric = (result?.genericName || genericName).trim();
    if (!targetGeneric) return [];
    const matched = (dataset.Products || []).filter((p) =>
      productMatchesPreferredGeneric(p, targetGeneric)
    );
    matched.sort((a, b) => {
      // Prioritize liquid forms first when Pediatric mode is selected
      if (patientMode === 'pediatric') {
        const aLiq = isLiquidDosageForm(a.Dosage_Form, a.Strength) ? 1 : 0;
        const bLiq = isLiquidDosageForm(b.Dosage_Form, b.Strength) ? 1 : 0;
        if (aLiq !== bLiq) return bLiq - aLiq;
      }
      const nameA = String(a.Brand_Name || a.Product_Name || '');
      const nameB = String(b.Brand_Name || b.Product_Name || '');
      return nameA.localeCompare(nameB);
    });
    return matched;
  }, [dataset.Products, result?.genericName, genericName, patientMode]);

  const handleSelectProduct = (prod: Product) => {
    const brand = String(prod.Brand_Name || prod.Product_Name || '').trim();
    const gen = String(prod.Generic_Name || '').trim() || brand;
    const str = String(prod.Strength || '').trim();
    const form = String(prod.Dosage_Form || '').trim();

    setSelectedProduct(prod);
    setSearchInput([brand, str, form].filter(Boolean).join(' · '));
    setGenericName(gen);
    setStrength(str);
    setDosageForm(form);
    setIsDropdownOpen(false);
    setFormValidationError(null);

    if (isLiquidDosageForm(form, str) && patientMode === 'adult') {
      setPatientMode('both');
    }
  };

  const handleSearchInputChange = (val: string) => {
    setSearchInput(val);
    setIsDropdownOpen(true);
    setFormValidationError(null);

    // If user edits the search box after selecting a product, treat it as manual generic entry
    if (selectedProduct) {
      setSelectedProduct(null);
    }
    setGenericName(val.trim());
  };

  const handleApplyDilBrandStrength = (prod: Product) => {
    const brand = String(prod.Brand_Name || prod.Product_Name || '').trim();
    const str = String(prod.Strength || '').trim();
    const form = String(prod.Dosage_Form || '').trim();

    setSelectedProduct(prod);
    setSearchInput([brand, str, form].filter(Boolean).join(' · '));
    if (prod.Generic_Name) setGenericName(prod.Generic_Name.trim());
    setStrength(str);
    setDosageForm(form);
    if (result) {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              brandName: brand,
              strength: str,
              dosageForm: form,
            }
          : prev
      );
    }
    pushToast({
      type: 'info',
      title: 'Strength updated',
      message: `Switched calculator to ${brand} ${str} ${form}`.trim(),
    });
  };

  const handleClearAll = () => {
    requestSeqRef.current += 1;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSearchInput('');
    setSelectedProduct(null);
    setGenericName('');
    setStrength('');
    setDosageForm('');
    setWeightInput('');
    setAgeValue('');
    setIndication('');
    setRenalElderlyCaution(false);
    setFormValidationError(null);
    setCalcError(null);
    setResult(null);
    setIsFromCache(false);
    setIsCalculating(false);
    setCopiedSummary(false);
  };

  const runDoseCalculation = async (forceRefresh = false) => {
    const effectiveGeneric = (genericName || searchInput).trim();
    if (!effectiveGeneric) {
      setFormValidationError(
        'Please select a Drug International Limited product or enter a Generic Name.'
      );
      return;
    }

    if (patientMode === 'pediatric' && !parsedWeightKg) {
      setFormValidationError(
        'Please enter the child’s Body Weight (kg) for exact pediatric mg/kg & mL calculation.'
      );
      return;
    }

    setFormValidationError(null);
    setCalcError(null);
    setCopiedSummary(false);

    const effectiveBrand = selectedProduct
      ? String(selectedProduct.Brand_Name || selectedProduct.Product_Name || '').trim()
      : '';
    const effectiveStrength = strength.trim();
    const effectiveForm = dosageForm.trim();
    const effectiveIndication = indication.trim();
    const effectiveAgeText = ageValue.trim()
      ? `${ageValue.trim()} ${ageUnit}`
      : '';

    const cacheKey = buildDoseCacheKey({
      genericName: effectiveGeneric,
      strength: effectiveStrength,
      dosageForm: effectiveForm,
      weightKg: parsedWeightKg,
      indication: effectiveIndication,
      renalElderlyCaution,
    });

    if (!forceRefresh) {
      const cached = loadCachedDoseCalculation(cacheKey);
      if (cached) {
        setResult({
          ...cached,
          brandName: effectiveBrand || cached.brandName,
          strength: effectiveStrength || cached.strength,
          dosageForm: effectiveForm || cached.dosageForm,
        });
        setIsFromCache(true);
        setIsCalculating(false);
        return;
      }
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const reqSeq = ++requestSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;

    setIsCalculating(true);
    setIsFromCache(false);

    try {
      const fresh = await fetchDoseCalculationFromGemini(
        {
          genericName: effectiveGeneric,
          brandName: effectiveBrand || undefined,
          strength: effectiveStrength || undefined,
          dosageForm: effectiveForm || undefined,
          approvedIndications: selectedProduct?.Approved_Indications || undefined,
          indication: effectiveIndication || undefined,
          patientMode,
          weightKg: parsedWeightKg,
          ageText: effectiveAgeText || undefined,
          renalElderlyCaution,
        },
        controller.signal
      );

      if (reqSeq !== requestSeqRef.current) return;
      saveCachedDoseCalculation(fresh);
      setResult(fresh);
      setCalcError(null);
    } catch (err) {
      if (reqSeq !== requestSeqRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;

      // Silently use the deterministic Standard Catalog Reference Dose without an error banner
      const fallbackResult = buildCatalogFallbackDoseCalculation({
        genericName: effectiveGeneric,
        brandName: effectiveBrand || undefined,
        strength: effectiveStrength || undefined,
        dosageForm: effectiveForm || undefined,
        therapeuticClass: selectedProduct?.Therapeutic_Class || undefined,
        approvedIndications: selectedProduct?.Approved_Indications || undefined,
        indication: effectiveIndication || undefined,
        weightKg: parsedWeightKg,
        ageText: effectiveAgeText || undefined,
        renalElderlyCaution,
      });

      setResult(fallbackResult);
      setIsFromCache(false);
      setCalcError(null);
    } finally {
      if (reqSeq === requestSeqRef.current) {
        abortRef.current = null;
        setIsCalculating(false);
      }
    }
  };

  const handleCopySummary = async () => {
    if (!result) return;
    const summaryText = formatDoseSummaryForCopy(result, computedPediatric, liquidInfo);
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedSummary(true);
      pushToast({
        type: 'success',
        title: 'Dose Summary Copied',
        message: `${result.brandName || result.genericName} dosing reference copied to clipboard.`,
      });
      window.setTimeout(() => setCopiedSummary(false), 2500);
    } catch {
      pushToast({
        type: 'warning',
        title: 'Copy unavailable',
        message: 'Browser clipboard permission was denied.',
      });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runDoseCalculation(false);
  };

  const showPediatricInputs = patientMode === 'pediatric' || patientMode === 'both';
  const showAdultInputs = patientMode === 'adult' || patientMode === 'both';

  return (
    <div className="space-y-6">
      {/* Sticky Top Back Bar */}
      <StickyBackBar
        title="Dose Calculator"
        subtitle="Pediatric & Adult · mg/kg & liquid mL"
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] text-white flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#0D2B45] dark:text-white tracking-tight">
              Dose Calculator
            </h1>
          </div>
          <p className="text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-1">
            Pediatric &amp; Adult dosing reference with exact mg/kg &amp; liquid mL conversion for Drug International Limited products.
          </p>
        </div>

        <div className="text-xs font-mono tabular-nums text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
          {dataset.Products.length} DIL products searchable
        </div>
      </div>

      {/* Input & Configuration Card */}
      <form
        onSubmit={handleFormSubmit}
        className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4 sm:p-6 space-y-5"
      >
        {/* 1. Smart Product / Generic Autocomplete */}
        <div ref={comboboxRef} className="relative space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="dose-product-search"
              className="text-xs sm:text-sm font-semibold text-[#0D2B45] dark:text-white flex items-center gap-1.5"
            >
              <Pill className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              <span>Brand Name or Generic Name</span>
              <span className="text-rose-500">*</span>
            </label>
            {selectedProduct && (
              <span className="text-[11px] font-semibold text-[#0E7C7B] dark:text-[#8EEAE8]">
                Selected from DIL Products Sheet
              </span>
            )}
          </div>

          <div className="relative">
            <Search
              className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="dose-product-search"
              type="text"
              value={searchInput}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              placeholder='Search DI Brand or Generic (e.g., "T-Cef 100mg/5ml", "Cefixime", "Fuclav 500mg", "Linzo")...'
              autoComplete="off"
              className="w-full min-h-[48px] pl-10 pr-11 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSelectedProduct(null);
                  setGenericName('');
                  setStrength('');
                  setDosageForm('');
                  setIsDropdownOpen(true);
                }}
                aria-label="Clear product search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-[#0A1C2D] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 shadow-xl divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
              {productMatches.length > 0 ? (
                productMatches.map((prod, idx) => {
                  const brand = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
                  const grp = normalizeProductGroup(prod.Product_Group);
                  const isLiq = isLiquidDosageForm(prod.Dosage_Form, prod.Strength);
                  return (
                    <button
                      key={`dc-opt-${prod.Product_ID}-${idx}`}
                      type="button"
                      onClick={() => handleSelectProduct(prod)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-[#EBF4FA]/75 dark:hover:bg-[#133859]/60 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-display font-bold text-sm text-[#0D2B45] dark:text-white">
                            {brand}
                          </span>
                          {prod.Strength && (
                            <span className="text-xs font-mono font-semibold text-[#0E7C7B] dark:text-[#8EEAE8]">
                              {prod.Strength}
                            </span>
                          )}
                          {prod.Dosage_Form && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45]/80 dark:text-[#EBF4FA]/85">
                              {prod.Dosage_Form}
                            </span>
                          )}
                          {isLiq && (
                            <Droplets
                              className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate mt-0.5">
                          {prod.Generic_Name || '—'}
                          {prod.Therapeutic_Class ? ` · ${prod.Therapeutic_Class}` : ''}
                        </div>
                      </div>
                      {grp && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0D2B45]/10 text-[#0D2B45] dark:bg-[#133859] dark:text-[#EBF4FA] shrink-0">
                          G-{grp}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-xs text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 flex items-center justify-between gap-2">
                  <span>
                    No exact DIL brand match — press <strong>Calculate Dose</strong> to calculate directly for{' '}
                    <strong className="text-[#0D2B45] dark:text-white">
                      &ldquo;{searchInput.trim()}&rdquo;
                    </strong>
                    .
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-[#0E7C7B] dark:text-[#149A99] font-semibold shrink-0 cursor-pointer"
                  >
                    Use Manual
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pre-filled / Editable Generic, Strength & Dosage Form Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label
                htmlFor="dose-generic-field"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mb-1"
              >
                Generic Name
              </label>
              <input
                id="dose-generic-field"
                type="text"
                value={genericName}
                onChange={(e) => {
                  setGenericName(e.target.value);
                  setFormValidationError(null);
                }}
                placeholder="e.g., Cefixime Trihydrate"
                className="w-full min-h-[44px] md:h-10 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <div>
              <label
                htmlFor="dose-strength-field"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mb-1"
              >
                Strength (for exact mL)
              </label>
              <input
                id="dose-strength-field"
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g., 100mg/5ml or 500mg"
                className="w-full min-h-[44px] md:h-10 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
              />
            </div>

            <div>
              <label
                htmlFor="dose-form-field"
                className="block text-[11px] font-semibold uppercase tracking-wider text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mb-1"
              >
                Dosage Form
              </label>
              <select
                id="dose-form-field"
                value={
                  DOSAGE_FORM_OPTIONS.includes(dosageForm as (typeof DOSAGE_FORM_OPTIONS)[number])
                    ? dosageForm
                    : dosageForm
                    ? '__custom__'
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    setDosageForm(e.target.value);
                  }
                }}
                className="w-full min-h-[44px] md:h-10 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] cursor-pointer"
              >
                <option value="">Auto / Any Form</option>
                {dosageForm &&
                  !DOSAGE_FORM_OPTIONS.includes(
                    dosageForm as (typeof DOSAGE_FORM_OPTIONS)[number]
                  ) && <option value="__custom__">{dosageForm}</option>}
                {DOSAGE_FORM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Liquid Concentration Detection Pill */}
          {liquidInfo.mgPerMl && (
            <div className="inline-flex flex-wrap items-center gap-1.5 text-xs text-[#095C5B] dark:text-[#8EEAE8] bg-[#EBF4FA] dark:bg-[#0E7C7B]/20 border border-[#0E7C7B]/20 rounded-xl px-3 py-1.5">
              <Droplets className="w-3.5 h-3.5 shrink-0" />
              <span>
                Liquid concentration detected:{' '}
                <strong className="font-mono">{liquidInfo.unitLabel}</strong> (
                <span className="font-mono">{Math.round(liquidInfo.mgPerMl * 100) / 100} mg/mL</span>) — exact{' '}
                <strong>mL per dose</strong> will be calculated automatically.
              </span>
            </div>
          )}
        </div>

        {/* 2. Patient Type Toggle */}
        <div className="space-y-2">
          <span className="block text-xs sm:text-sm font-semibold text-[#0D2B45] dark:text-white">
            Patient Type (রোগীর ধরন)
          </span>
          <div
            role="tablist"
            aria-label="Patient type"
            className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 max-w-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={patientMode === 'pediatric'}
              onClick={() => {
                setPatientMode('pediatric');
                setFormValidationError(null);
              }}
              className={`min-h-[42px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                patientMode === 'pediatric'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <Baby className="w-4 h-4 shrink-0" />
              <span>Pediatric (শিশু)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={patientMode === 'adult'}
              onClick={() => {
                setPatientMode('adult');
                setFormValidationError(null);
              }}
              className={`min-h-[42px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                patientMode === 'adult'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Adult (বড়দের)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={patientMode === 'both'}
              onClick={() => {
                setPatientMode('both');
                setFormValidationError(null);
              }}
              className={`min-h-[42px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                patientMode === 'both'
                  ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Both (উভয়)</span>
            </button>
          </div>
        </div>

        {/* 3. Contextual Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showPediatricInputs && (
            <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="dose-weight-kg"
                  className="text-xs font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5"
                >
                  <Baby className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Body Weight (kg) · শিশুর ওজন</span>
                  {patientMode === 'pediatric' && <span className="text-rose-500">*</span>}
                </label>
                <span className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                  For exact mg &amp; mL
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative">
                  <input
                    id="dose-weight-kg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0.5"
                    max="150"
                    value={weightInput}
                    onChange={(e) => {
                      setWeightInput(e.target.value);
                      setFormValidationError(null);
                    }}
                    placeholder="e.g., 12"
                    className="w-full min-h-[44px] pl-3 pr-10 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm font-mono font-semibold text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                    kg
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    id="dose-age-val"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="18"
                    value={ageValue}
                    onChange={(e) => setAgeValue(e.target.value)}
                    placeholder="Age (opt)"
                    aria-label="Pediatric age"
                    className="w-full min-h-[44px] px-2.5 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                  />
                  <select
                    value={ageUnit}
                    onChange={(e) => setAgeUnit(e.target.value as 'years' | 'months')}
                    aria-label="Age unit"
                    className="min-h-[44px] px-2 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-xs font-semibold text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B] cursor-pointer"
                  >
                    <option value="years">Yrs</option>
                    <option value="months">Mos</option>
                  </select>
                </div>
              </div>

              {/* Quick weight chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 mr-0.5">
                  Quick kg:
                </span>
                {QUICK_WEIGHTS_KG.map((w) => {
                  const isActive = parsedWeightKg === w;
                  return (
                    <button
                      key={`w-${w}`}
                      type="button"
                      onClick={() => {
                        setWeightInput(String(w));
                        setFormValidationError(null);
                      }}
                      className={`min-h-[38px] sm:min-h-[30px] px-2.5 py-1 rounded-lg text-xs sm:text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#0E7C7B] text-white'
                          : 'bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:border-[#0E7C7B]'
                      }`}
                    >
                      {w} kg
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Indication & Renal/Elderly Caution Box */}
          <div
            className={`rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3.5 space-y-3 ${
              !showPediatricInputs ? 'md:col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="dose-indication-input"
                className="text-xs font-bold text-[#0D2B45] dark:text-white"
              >
                Clinical Indication (Optional · রোগ / ইন্ডিকেশন)
              </label>
              {indication && (
                <button
                  type="button"
                  onClick={() => setIndication('')}
                  className="text-[11px] font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <input
              id="dose-indication-input"
              type="text"
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="e.g., URTI, UTI, Typhoid, CAP, Otitis Media..."
              className="w-full min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-base md:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
            />

            {/* Quick Indication Chips */}
            <div className="flex flex-wrap gap-1.5">
              {indicationQuickChips.map((chip) => {
                const isSelected = indication.trim().toLowerCase() === chip.toLowerCase();
                return (
                  <button
                    key={`ind-chip-${chip}`}
                    type="button"
                    onClick={() => setIndication(isSelected ? '' : chip)}
                    className={`min-h-[38px] sm:min-h-[30px] px-3 py-1 rounded-lg text-xs sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                        : 'bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:border-[#0E7C7B]'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            {/* Renal / Elderly Caution Toggle */}
            {showAdultInputs && (
              <div className="pt-1 flex items-center justify-between gap-3 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#0D2B45] dark:text-white">
                    Renal / Elderly Caution
                  </div>
                  <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Highlight renal impairment &amp; geriatric dosing adjustments
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={renalElderlyCaution}
                  onClick={() => setRenalElderlyCaution((prev) => !prev)}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    renalElderlyCaution
                      ? 'bg-[#0E7C7B]'
                      : 'bg-[#0D2B45]/20 dark:bg-[#EBF4FA]/20'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      renalElderlyCaution ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Form Validation Message */}
        {formValidationError && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-700/60 px-3.5 py-2.5 text-xs font-medium text-amber-950 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{formValidationError}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={isCalculating}
              className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-55 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calculating Dose...</span>
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  <span>Calculate Dose</span>
                </>
              )}
            </button>

            {(searchInput || genericName || result) && (
              <button
                type="button"
                onClick={handleClearAll}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F4F8FC] hover:bg-[#EBF4FA] dark:bg-[#071522] dark:hover:bg-[#133859] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-xs sm:text-sm font-semibold text-[#0D2B45]/80 dark:text-[#EBF4FA]/85 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <span className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
            Cached locally for instant field recall · Exact frontend mL arithmetic
          </span>
        </div>
      </form>

      {/* Loading Skeleton (5 structured cards) */}
      {isCalculating && (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <div className="rounded-2xl bg-[#EBF4FA]/80 dark:bg-[#0D2235] border border-[#0E7C7B]/25 px-4 py-3 text-xs sm:text-sm font-medium text-[#0D2B45] dark:text-[#EBF4FA] flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] animate-spin shrink-0" />
            <span>
              Preparing Pediatric &amp; Adult dose reference for{' '}
              <strong>{selectedProduct?.Brand_Name || genericName || searchInput}</strong>...
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={`dose-skel-${idx}`}
                className={`rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 space-y-3 animate-pulse ${
                  idx === 5 ? 'lg:col-span-2' : ''
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF4FA] dark:bg-[#133859]" />
                  <div className="h-4 w-48 rounded bg-[#EBF4FA] dark:bg-[#133859]" />
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 w-full rounded bg-[#F4F8FC] dark:bg-[#071522]" />
                  <div className="h-3.5 w-11/12 rounded bg-[#F4F8FC] dark:bg-[#071522]" />
                  <div className="h-3.5 w-3/4 rounded bg-[#F4F8FC] dark:bg-[#071522]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State with Exact Error & High-Contrast Retry */}
      {!isCalculating && calcError && (
        <div className="rounded-2xl bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                Dose calculation could not be completed
              </h2>
              <p className="text-xs text-rose-800/85 dark:text-rose-200/85 mt-1 leading-relaxed">
                {calcError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void runDoseCalculation(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-700" />
            <span>আবার চেষ্টা করুন (Retry Calculation)</span>
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* STRUCTURED 5-CARD DOSE CALCULATION OUTPUT                           */}
      {/* =================================================================== */}
      {!isCalculating && result && (
        <div className="space-y-5">
          {/* Result Summary Action Header */}
          <div className="rounded-2xl bg-[#0D2B45] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#EBF4FA]/75">
                {result.source === 'catalog-fallback' && (
                  <span className="px-2 py-0.5 rounded-md bg-white/12 border border-white/20 text-[#EBF4FA]/90 font-medium">
                    {result.sourceLabel || STANDARD_CATALOG_REFERENCE_LABEL}
                  </span>
                )}
                {result.therapeuticClass && (
                  <span className="px-2 py-0.5 rounded-md bg-white/12 text-[#8EEAE8] font-semibold">
                    {result.therapeuticClass}
                  </span>
                )}
                {result.indication && (
                  <span className="px-2 py-0.5 rounded-md bg-[#0E7C7B] text-white font-semibold">
                    Indication: {result.indication}
                  </span>
                )}
                {isFromCache && (
                  <span className="text-[11px] text-[#EBF4FA]/70">· Instant cached result</span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-display font-bold mt-1 leading-snug">
                {result.brandName ? (
                  <>
                    {result.brandName}{' '}
                    <span className="font-normal text-[#EBF4FA]/80 text-base">
                      ({result.genericName})
                    </span>
                  </>
                ) : (
                  result.genericName
                )}
              </h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#EBF4FA]/80 mt-0.5 font-mono">
                {activeStrength && <span>{activeStrength}</span>}
                {activeStrength && activeDosageForm && <span>·</span>}
                {activeDosageForm && <span className="font-sans">{activeDosageForm}</span>}
                {parsedWeightKg && (
                  <>
                    <span>·</span>
                    <span>Weight: {parsedWeightKg} kg</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySummary}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0E7C7B] hover:bg-[#149A99] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied Summary</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Dose Summary</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void runDoseCalculation(true)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recalculate</span>
              </button>
            </div>
          </div>

          {/* 5 Structured Output Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CARD 1: Pediatric Dose (শিশুদের ডোজ) */}
            <section
              className={`rounded-2xl bg-white dark:bg-[#0D2235] border p-5 space-y-3.5 ${
                patientMode === 'pediatric'
                  ? 'border-[#0E7C7B] border-l-4 border-l-[#0E7C7B]'
                  : 'border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 border-l-4 border-l-[#0E7C7B]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#EBF4FA] dark:bg-[#0E7C7B]/25 text-[#0E7C7B] dark:text-[#8EEAE8] text-xs font-bold inline-flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h3 className="text-sm sm:text-base font-display font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                    <Baby className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                    <span>Pediatric Dose</span>
                    <span className="text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                      (শিশুদের ডোজ)
                    </span>
                  </h3>
                </div>
                {!result.pediatric.applicable && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
                    Caution
                  </span>
                )}
              </div>

              {!result.pediatric.applicable ? (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 p-4 space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-200">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      {result.pediatric.contraindicationBadge ||
                        'Not Recommended / Contraindicated in Children (শিশুদের জন্য প্রযোজ্য নয়)'}
                    </span>
                  </div>
                  {result.pediatric.pediatricNotes && (
                    <p className="text-xs sm:text-sm text-rose-900/85 dark:text-rose-100/85 leading-relaxed">
                      {result.pediatric.pediatricNotes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Calculated Exact Single Dose Box (mg & mL) */}
                  {computedPediatric ? (
                    <div className="rounded-xl bg-[#EBF4FA]/85 dark:bg-[#0A1C2D] border border-[#0E7C7B]/25 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#8EEAE8]">
                          Calculated Dose for {computedPediatric.weightKg} kg
                        </span>
                        {(computedPediatric.wasDailyCapApplied ||
                          computedPediatric.wasSingleCapApplied) && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                            Max cap applied
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="rounded-lg bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-3 py-2.5">
                          <div className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                            Single Dose (mg)
                          </div>
                          <div className="text-lg sm:text-xl font-display font-bold font-mono tabular-nums text-[#0D2B45] dark:text-white mt-0.5">
                            {formatDoseRangeMg(
                              computedPediatric.singleMinMg,
                              computedPediatric.singleMaxMg
                            )}
                          </div>
                          <div className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-0.5 font-mono tabular-nums">
                            Daily: {formatDoseRangeMg(computedPediatric.dailyMinMg, computedPediatric.dailyMaxMg)}/day
                          </div>
                        </div>

                        {computedPediatric.singleMinMl != null &&
                        computedPediatric.singleMaxMl != null ? (
                          <div className="rounded-lg bg-[#0D2B45] dark:bg-[#0E7C7B] text-white px-3 py-2.5">
                            <div className="text-[11px] text-[#EBF4FA]/80 flex items-center gap-1">
                              <Droplets className="w-3 h-3" />
                              <span>Liquid Volume / Dose</span>
                            </div>
                            <div className="text-lg sm:text-xl font-display font-bold font-mono tabular-nums mt-0.5">
                              {formatDoseRangeMl(
                                computedPediatric.singleMinMl,
                                computedPediatric.singleMaxMl
                              )}
                            </div>
                            <div className="text-[11px] text-[#EBF4FA]/90 mt-0.5">
                              {computedPediatric.teaspoonLabel ||
                                computedPediatric.dropsLabel ||
                                liquidInfo.unitLabel}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-3 py-2.5">
                            <div className="text-[11px] text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                              Frequency
                            </div>
                            <div className="text-sm font-bold text-[#0E7C7B] dark:text-[#8EEAE8] mt-1 leading-snug">
                              {result.pediatric.frequencyLabel}
                            </div>
                          </div>
                        )}
                      </div>

                      {liquidInfo.isCombinationNote && (
                        <p className="text-[11px] text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                          {liquidInfo.isCombinationNote}
                        </p>
                      )}
                    </div>
                  ) : (
                    result.pediatric.mgPerKgPerDayMin &&
                    !parsedWeightKg && (
                      <div className="rounded-xl bg-[#EBF4FA]/70 dark:bg-[#0A1C2D] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-3.5 py-2.5 text-xs text-[#0D2B45]/80 dark:text-[#EBF4FA]/80">
                        Enter a child&apos;s <strong>Body Weight (kg)</strong> above to see exact single-dose{' '}
                        <strong>mg</strong> and liquid <strong>mL</strong> conversion immediately.
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] px-3 py-2.5">
                      <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                        Standard Range
                      </div>
                      <div className="font-semibold text-[#0D2B45] dark:text-white mt-0.5">
                        {result.pediatric.standardRangeLabel || '—'}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] px-3 py-2.5">
                      <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                        Frequency &amp; Max Daily Limit
                      </div>
                      <div className="font-semibold text-[#0D2B45] dark:text-white mt-0.5">
                        {result.pediatric.frequencyLabel}
                        {result.pediatric.maxDailyLimitLabel
                          ? ` · ${result.pediatric.maxDailyLimitLabel}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {result.pediatric.pediatricNotes && (
                    <p className="text-xs sm:text-sm text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 leading-relaxed">
                      {result.pediatric.pediatricNotes}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* CARD 2: Adult Dose (বড়দের ডোজ) */}
            <section
              className={`rounded-2xl bg-white dark:bg-[#0D2235] border p-5 space-y-3.5 ${
                patientMode === 'adult'
                  ? 'border-[#0D2B45] dark:border-[#0E7C7B] border-l-4 border-l-[#0D2B45] dark:border-l-[#149A99]'
                  : 'border-[#0D2B45]/10 dark:border-[#EBF4FA]/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] text-xs font-bold inline-flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="text-sm sm:text-base font-display font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                  <User className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Adult Dose</span>
                  <span className="text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    (বড়দের ডোজ)
                  </span>
                </h3>
              </div>

              <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Standard Adult Dose
                  </div>
                  <div className="text-base sm:text-lg font-display font-bold text-[#0D2B45] dark:text-white mt-0.5">
                    {result.adult.standardDose}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Frequency &amp; Max Limit
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-[#0E7C7B] dark:text-[#8EEAE8] mt-0.5">
                    {result.adult.frequency}
                  </div>
                  {result.adult.maxDailyLimit && (
                    <div className="text-[11px] font-mono text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                      Max: {result.adult.maxDailyLimit}
                    </div>
                  )}
                </div>
              </div>

              {result.adult.indicationVariations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    Indication-Specific Dosing
                  </div>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                    {result.adult.indicationVariations.map((item, idx) => (
                      <li key={`adult-var-${idx}`} className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] mt-2 shrink-0"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.adult.renalElderlyNote && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    renalElderlyCaution
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100'
                      : 'bg-[#EBF4FA]/70 dark:bg-[#0A1C2D] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[#0D2B45]/80 dark:text-[#EBF4FA]/80'
                  }`}
                >
                  <span className="font-bold">Renal / Elderly Note: </span>
                  <span>{result.adult.renalElderlyNote}</span>
                </div>
              )}
            </section>

            {/* CARD 3: Duration of Therapy (কতদিন চলবে) */}
            <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] text-xs font-bold inline-flex items-center justify-center shrink-0">
                  3
                </span>
                <h3 className="text-sm sm:text-base font-display font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Duration of Therapy</span>
                  <span className="text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    (কতদিন চলবে)
                  </span>
                </h3>
              </div>

              <div className="rounded-xl bg-[#EBF4FA]/75 dark:bg-[#0A1C2D] px-3.5 py-2.5 text-sm font-bold text-[#0D2B45] dark:text-white">
                {result.duration.summary}
              </div>

              {result.duration.byIndication.length > 0 && (
                <ul className="space-y-1.5 text-xs sm:text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                  {result.duration.byIndication.map((item, idx) => (
                    <li key={`dur-${idx}`} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] mt-2 shrink-0"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* CARD 4: Administration & Key Notes (খাওয়ার নিয়ম) */}
            <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] text-xs font-bold inline-flex items-center justify-center shrink-0">
                  4
                </span>
                <h3 className="text-sm sm:text-base font-display font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                  <Utensils className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Administration &amp; Key Notes</span>
                  <span className="text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    (খাওয়ার নিয়ম)
                  </span>
                </h3>
              </div>

              <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] px-3.5 py-2.5 text-xs sm:text-sm text-[#0D2B45] dark:text-white">
                <span className="font-bold text-[#0E7C7B] dark:text-[#8EEAE8]">Meal Guidance: </span>
                <span>{result.administration.mealGuidance}</span>
              </div>

              {result.administration.reconstitutionNote && (
                <div className="rounded-xl bg-[#EBF4FA]/75 dark:bg-[#0E7C7B]/15 border border-[#0E7C7B]/20 px-3.5 py-2.5 text-xs sm:text-sm text-[#0D2B45] dark:text-[#EBF4FA] leading-relaxed">
                  <span className="font-bold">
                    {liquidInfo.isLiquid ? 'PFS / Liquid Note: ' : 'Dosage Form Note: '}
                  </span>
                  <span>{result.administration.reconstitutionNote}</span>
                </div>
              )}

              {result.administration.keyTips.length > 0 && (
                <ul className="space-y-1.5 text-xs sm:text-sm text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                  {result.administration.keyTips.map((tip, idx) => (
                    <li key={`tip-${idx}`} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] mt-2 shrink-0"
                      />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* CARD 5: Safety & Renal/Pregnancy Note (সতর্কতা) */}
            <section className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-bold inline-flex items-center justify-center shrink-0">
                  5
                </span>
                <h3 className="text-sm sm:text-base font-display font-bold text-[#0D2B45] dark:text-white flex items-center gap-1.5 flex-wrap">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Safety &amp; Renal / Pregnancy Note</span>
                  <span className="text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    (সতর্কতা)
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Key Contraindications
                  </div>
                  <ul className="space-y-1 text-xs text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                    {result.safety.contraindications.map((item, idx) => (
                      <li key={`ci-${idx}`} className="flex items-start gap-1.5">
                        <span
                          aria-hidden="true"
                          className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#8EEAE8]">
                    Pregnancy &amp; Lactation
                  </div>
                  <p className="text-xs text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                    {result.safety.pregnancyLactation}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] p-3.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                    Renal / Hepatic Caution
                  </div>
                  <p className="text-xs text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 leading-relaxed">
                    {result.safety.renalHepaticCaution}
                  </p>
                </div>
              </div>

              {/* Mandatory Clinical Reference Disclaimer */}
              <div className="rounded-xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-950 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  For educational &amp; MPO detailing reference only; final dose must be confirmed by a registered physician.
                </span>
              </div>
            </section>
          </div>

          {/* Matching Drug International Limited Brands & Strengths */}
          <section className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 overflow-hidden">
            <div className="px-5 py-3.5 bg-[#EBF4FA]/80 dark:bg-[#0A1C2D] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E7C7B] dark:text-[#8EEAE8]">
                  Matching Drug International Limited Brands &amp; Strengths
                </h3>
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5 tabular-nums">
                  {matchingDilBrands.length} DIL brand presentation
                  {matchingDilBrands.length === 1 ? '' : 's'} matched for{' '}
                  <strong>{result.genericName}</strong>
                </p>
              </div>
            </div>

            {matchingDilBrands.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                No matching brand rows found in the Products sheet for &ldquo;{result.genericName}&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                {matchingDilBrands.map((prod, idx) => {
                  const brandName = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
                  const grp = normalizeProductGroup(prod.Product_Group);
                  const isCurrent = selectedProduct?.Product_ID === prod.Product_ID;
                  const priceStr = prod.Box_Price || prod.MRP_BDT || prod.Single_Price;
                  return (
                    <div
                      key={`dil-match-${prod.Product_ID}-${idx}`}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isCurrent
                          ? 'bg-[#EBF4FA]/50 dark:bg-[#133859]/35'
                          : 'hover:bg-[#F4F8FC]/80 dark:hover:bg-[#133859]/20'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openProductBrief(prod.Product_ID)}
                            className="font-display font-bold text-sm sm:text-base text-[#0D2B45] dark:text-white hover:text-[#0E7C7B] dark:hover:text-[#149A99] hover:underline text-left cursor-pointer"
                          >
                            {brandName}
                          </button>
                          {grp && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0D2B45]/10 text-[#0D2B45] dark:bg-[#133859] dark:text-[#EBF4FA]">
                              G-{grp}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0E7C7B] text-white">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="font-semibold text-[#0E7C7B] dark:text-[#8EEAE8]">
                            {prod.Generic_Name}
                          </span>
                          {prod.Strength && (
                            <>
                              <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                              <span className="font-mono font-semibold text-[#0D2B45] dark:text-white">
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
                                {prod.Pack_Size}
                              </span>
                            </>
                          )}
                          {priceStr && (
                            <>
                              <span className="text-[#0D2B45]/30 dark:text-[#EBF4FA]/30">·</span>
                              <span className="font-mono font-semibold text-[#0D2B45]/80 dark:text-[#EBF4FA]/85">
                                {formatBDT(priceStr)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApplyDilBrandStrength(prod)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#EBF4FA] hover:bg-[#dcecf7] dark:bg-[#133859] dark:hover:bg-[#1C4A73] text-[#0D2B45] dark:text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>Use Strength</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            startDetailingFlow({
                              genericName: prod.Generic_Name || '',
                              productId: prod.Product_ID,
                              subTab: 'detailing',
                            })
                          }
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Detailing</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
