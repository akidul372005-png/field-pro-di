import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Languages,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatBDT,
  matchSpecialistName,
  normalizeGenericKey,
  scriptMatchesGenericGroup,
} from '../services/api';

type ScriptTab = 'both' | 'bn' | 'en';

export const ProductBriefModal: React.FC = () => {
  const {
    dataset,
    selectedProductId,
    setSelectedProductId,
    productMap,
    isSuperAdmin,
    openEditModal,
    requestDeleteRecord,
    startDetailingFlow,
    pushToast,
  } = useApp();

  const [scriptTab, setScriptTab] = useState<ScriptTab>('both');
  const [selectedSpecialist, setSelectedSpecialist] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<'bn' | 'en' | null>(null);

  const product = selectedProductId ? productMap.get(selectedProductId) || null : null;

  const productScripts = useMemo(() => {
    if (!product) return [];
    const targetGeneric =
      String(product.Generic_Name ?? '').trim() ||
      String(product.Brand_Name || product.Product_Name || '').trim();
    const genericKey = normalizeGenericKey(targetGeneric);
    const groupProducts = dataset.Products.filter(
      (p) =>
        normalizeGenericKey(p.Generic_Name || p.Brand_Name || p.Product_Name) === genericKey ||
        p.Product_ID === product.Product_ID
    );
    return dataset.Doctor_Product_Detailing.filter(
      (item) =>
        scriptMatchesGenericGroup(item, targetGeneric, groupProducts) &&
        (Boolean(item.Specialist) || Boolean(item.Detailing_BN) || Boolean(item.Detailing_EN))
    );
  }, [dataset.Doctor_Product_Detailing, dataset.Products, product]);

  useEffect(() => {
    if (!selectedProductId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProductId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedProductId, setSelectedProductId]);

  useEffect(() => {
    setScriptTab('both');
    setCopiedKey(null);
    setSelectedSpecialist(productScripts[0]?.Specialist || '');
  }, [selectedProductId, productScripts]);

  const activeScript = useMemo(() => {
    if (productScripts.length === 0) return null;
    if (!selectedSpecialist) return productScripts[0];
    return (
      productScripts.find((s) => matchSpecialistName(s.Specialist, selectedSpecialist)) ||
      productScripts[0]
    );
  }, [productScripts, selectedSpecialist]);

  if (!product) return null;

  const brandName = product.Brand_Name || product.Product_Name || product.Product_ID;
  const singlePriceDisplay = formatBDT(product.Single_Price);
  const boxPriceDisplay = formatBDT(product.Box_Price ?? product.MRP_BDT);

  const handleCopyScript = async (lang: 'bn' | 'en', text?: string) => {
    if (!text?.trim()) return;
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopiedKey(lang);
      pushToast({
        type: 'success',
        title: lang === 'bn' ? 'বাংলা স্ক্রিপ্ট কপি হয়েছে' : 'English detailing copied',
        message: `${brandName}${activeScript?.Specialist ? ` · ${activeScript.Specialist}` : ''}`,
      });
      window.setTimeout(() => {
        setCopiedKey((current) => (current === lang ? null : current));
      }, 2000);
    } catch {
      pushToast({
        type: 'info',
        title: 'Copy unavailable',
        message: 'Select and copy the script text directly.',
      });
    }
  };

  const handleEditProduct = () => {
    openEditModal('Products', product as unknown as Record<string, unknown>);
  };

  const handleOpenDetailingGuide = () => {
    const id = product.Product_ID;
    const genericName =
      String(product.Generic_Name ?? '').trim() ||
      String(product.Brand_Name || product.Product_Name || '').trim();
    const spec = activeScript?.Specialist;
    setSelectedProductId(null);
    startDetailingFlow({
      productId: id,
      genericName,
      specialist: spec,
      subTab: 'detailing',
    });
  };

  const briefSpecs: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Brand Name', value: brandName },
    { label: 'Generic Name', value: product.Generic_Name || '—' },
    { label: 'Strength', value: product.Strength || '—' },
    { label: 'Dosage Form', value: product.Dosage_Form || '—' },
    { label: 'Therapeutic Class', value: product.Therapeutic_Class || '—' },
    { label: 'Product Group', value: product.Product_Group || 'Unassigned' },
    { label: 'Pack Size', value: product.Pack_Size || '—' },
    { label: 'Single Price (BDT)', value: singlePriceDisplay, mono: true },
    { label: 'Box Price (BDT)', value: boxPriceDisplay, mono: true },
  ];

  const showBn = scriptTab === 'both' || scriptTab === 'bn';
  const showEn = scriptTab === 'both' || scriptTab === 'en';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/55 backdrop-blur-xs"
      onClick={() => setSelectedProductId(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${brandName} product brief and specialist detailing`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[640px] lg:w-[700px] max-h-[92vh] sm:h-full sm:max-h-full bg-white dark:bg-[#0D2235] rounded-t-3xl sm:rounded-none sm:rounded-l-2xl border-t sm:border-t-0 sm:border-l border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-[#0D2B45]/20 dark:bg-[#EBF4FA]/20" />
        </div>

        {/* Drawer Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99]">
              {product.Therapeutic_Class || 'Product Brief'}
              {product.Product_Group ? ` · ${product.Product_Group}` : ''}
              {' · '}
              <span className="font-mono">{product.Product_ID}</span>
              {productScripts.length > 0
                ? ` · ${productScripts.length} specialist script${productScripts.length === 1 ? '' : 's'}`
                : ''}
            </p>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#0D2B45] dark:text-white mt-0.5 tracking-tight">
              {brandName}
              {product.Strength &&
                !brandName.toLowerCase().includes(product.Strength.toLowerCase()) && (
                  <span className="text-base font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 ml-2">
                    {product.Strength}
                  </span>
                )}
            </h2>
            <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
              {[product.Generic_Name, product.Dosage_Form, product.Pack_Size]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isSuperAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleEditProduct}
                  aria-label={`Edit ${brandName}`}
                  title="Edit product details & price"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    requestDeleteRecord(
                      'Products',
                      product as unknown as Record<string, unknown>,
                      brandName
                    )
                  }
                  aria-label={`Delete ${brandName}`}
                  title="Delete product"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setSelectedProductId(null)}
              aria-label="Close product brief"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/60 hover:text-[#0D2B45] dark:text-[#EBF4FA]/60 dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* Pricing Highlight & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10">
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div>
                <div className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                  Single Price
                </div>
                <div className="text-xl font-mono tabular-nums font-bold text-[#0D2B45] dark:text-white mt-0.5">
                  {singlePriceDisplay}
                </div>
                <div className="text-[11px] text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                  per unit
                </div>
              </div>
              <div>
                <div className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                  Box Price
                </div>
                <div className="text-xl font-mono tabular-nums font-bold text-[#0E7C7B] dark:text-[#149A99] mt-0.5">
                  {boxPriceDisplay}
                </div>
                <div className="text-[11px] text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                  {product.Pack_Size || 'per box'}
                </div>
              </div>
            </div>

            <div className={`grid ${isSuperAdmin ? 'grid-cols-2' : 'grid-cols-1'} sm:flex items-center gap-2.5 shrink-0`}>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={handleEditProduct}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                  <span>Edit Product</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenDetailingGuide}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Detailing Guide</span>
              </button>
            </div>
          </div>

          {/* Section 1: Product Brief */}
          <section aria-labelledby="product-brief-heading" className="space-y-3.5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              <h3
                id="product-brief-heading"
                className="text-sm font-display font-bold text-[#0D2B45] dark:text-white"
              >
                Product Brief
              </h3>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3.5 rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 p-4">
              {briefSpecs.map((spec) => (
                <div key={spec.label} className="min-w-0">
                  <dt className="text-[11px] font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    {spec.label}
                  </dt>
                  <dd
                    className={`text-xs sm:text-sm font-semibold text-[#0D2B45] dark:text-white mt-0.5 break-words ${
                      spec.mono ? 'font-mono tabular-nums' : ''
                    }`}
                  >
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="pt-1">
              <div className="text-xs font-semibold text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                Approved Indications
              </div>
              <p className="text-sm text-[#0D2B45]/90 dark:text-[#EBF4FA]/90 mt-1 leading-relaxed">
                {product.Approved_Indications || (
                  <span className="text-[#0D2B45]/50 dark:text-[#EBF4FA]/50 italic">
                    No approved indications recorded yet.
                  </span>
                )}
              </p>
            </div>
          </section>

          {/* Section 2: Linked Specialist Detailing Scripts from Doctor_Product_Detailing */}
          <section
            aria-labelledby="brief-specialist-scripts-heading"
            className="pt-5 border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                <h3
                  id="brief-specialist-scripts-heading"
                  className="text-sm font-display font-bold text-[#0D2B45] dark:text-white"
                >
                  Specialist Detailing Scripts ({productScripts.length})
                </h3>
              </div>

              {productScripts.length > 0 && (
                <div
                  role="tablist"
                  aria-label="Detailing script language"
                  className="inline-flex items-center p-0.5 rounded-xl bg-[#EBF4FA] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
                >
                  {[
                    { id: 'both' as ScriptTab, label: 'Both' },
                    { id: 'bn' as ScriptTab, label: 'বাংলা' },
                    { id: 'en' as ScriptTab, label: 'English' },
                  ].map((tab) => {
                    const active = scriptTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setScriptTab(tab.id)}
                        className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
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
              )}
            </div>

            {productScripts.length === 0 ? (
              <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-5 text-center space-y-2.5">
                <Stethoscope className="w-6 h-6 text-[#0E7C7B] dark:text-[#149A99] mx-auto" />
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65">
                  No specialist detailing scripts available for this product yet.
                </p>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenDetailingGuide}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Script in Detailing Guide</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Specialist Selector Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {productScripts.map((entry) => {
                    const isSelected = activeScript?.Detailing_ID === entry.Detailing_ID;
                    return (
                      <button
                        key={entry.Detailing_ID}
                        type="button"
                        onClick={() => setSelectedSpecialist(entry.Specialist)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                            : 'bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73]'
                        }`}
                      >
                        {entry.Specialist || 'General'}
                      </button>
                    );
                  })}
                </div>

                {activeScript && (
                  <div
                    className={`grid grid-cols-1 gap-3.5 ${
                      scriptTab === 'both' ? 'sm:grid-cols-2' : ''
                    }`}
                  >
                    {showBn && (
                      <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                          <span className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                            বাংলা শর্ট ডিটেইলিং
                          </span>
                          {activeScript.Detailing_BN && (
                            <button
                              type="button"
                              onClick={() => handleCopyScript('bn', activeScript.Detailing_BN)}
                              className="text-xs font-medium text-[#0D2B45]/65 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/65 dark:hover:text-[#149A99] inline-flex items-center gap-1"
                            >
                              {copiedKey === 'bn' ? (
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
                        <p className="mt-3 text-sm sm:text-[15px] text-[#0D2B45] dark:text-[#EBF4FA] leading-[1.8] whitespace-pre-line">
                          {activeScript.Detailing_BN || '—'}
                        </p>
                      </div>
                    )}

                    {showEn && (
                      <div className="rounded-2xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-4">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/8">
                          <span className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99]">
                            English Short Detailing
                          </span>
                          {activeScript.Detailing_EN && (
                            <button
                              type="button"
                              onClick={() => handleCopyScript('en', activeScript.Detailing_EN)}
                              className="text-xs font-medium text-[#0D2B45]/65 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/65 dark:hover:text-[#149A99] inline-flex items-center gap-1"
                            >
                              {copiedKey === 'en' ? (
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
                        <p className="mt-3 text-sm text-[#0D2B45] dark:text-[#EBF4FA] leading-relaxed whitespace-pre-line">
                          {activeScript.Detailing_EN || '—'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Sticky Drawer Footer */}
        <div
          className={`px-5 sm:px-6 py-3.5 border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 bg-[#F4F8FC]/80 dark:bg-[#0A1C2D]/90 flex items-center ${
            isSuperAdmin ? 'justify-between' : 'justify-end'
          } gap-3`}
        >
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleEditProduct}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 bg-white dark:bg-[#0D2235] text-[#0D2B45] dark:text-white hover:border-[#0E7C7B] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              <span>Edit Product</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenDetailingGuide}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Open Detailing Guide</span>
          </button>
        </div>
      </div>
    </div>
  );
};
