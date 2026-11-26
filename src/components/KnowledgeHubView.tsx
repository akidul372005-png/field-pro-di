import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Filter,
  Lightbulb,
  RefreshCw,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { KnowledgeChapter } from '../types';
import { StickyBackBar } from './StickyBackBar';
import { WatchNowButton } from './WatchNowButton';

type KnowledgeTabKey = 'mpo_desk' | 'medical_knowledge';

interface ContentBlock {
  type: 'heading' | 'list' | 'paragraph';
  text?: string;
  items?: string[];
}

function parseBengaliContentBlocks(raw: string): ContentBlock[] {
  const normalized = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!normalized) return [];

  const blocks: ContentBlock[] = [];
  const sections = normalized.split(/\n{2,}/);

  sections.forEach((section) => {
    const lines = section
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const bulletLines: string[] = [];
    const flushBullets = () => {
      if (bulletLines.length > 0) {
        blocks.push({ type: 'list', items: [...bulletLines] });
        bulletLines.length = 0;
      }
    };

    lines.forEach((line) => {
      const bulletMatch = line.match(/^(?:[-•*▪▸➤]|(?:\d+|[০-৯]+)[.)])\s+(.+)$/);
      if (bulletMatch) {
        bulletLines.push(bulletMatch[1].trim());
        return;
      }

      flushBullets();

      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        blocks.push({ type: 'heading', text: headingMatch[1].trim() });
      } else if (line.endsWith(':') && line.length <= 90 && lines.length > 1) {
        blocks.push({ type: 'heading', text: line });
      } else {
        blocks.push({ type: 'paragraph', text: line });
      }
    });

    flushBullets();
  });

  return blocks;
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

export const KnowledgeHubView: React.FC = () => {
  const { dataset, refreshFromServer, isLoadingData, isOnline, isApiConfigured } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<KnowledgeTabKey>('mpo_desk');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<KnowledgeChapter | null>(null);
  const [copiedChapter, setCopiedChapter] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const categorySearchInputRef = useRef<HTMLInputElement | null>(null);

  const mpoDeskChapters = useMemo(
    () =>
      (dataset.MPO_Desk || []).filter(
        (ch) => String(ch.Status ?? '').trim().toLowerCase() === 'active'
      ),
    [dataset.MPO_Desk]
  );

  const medicalKnowledgeChapters = useMemo(
    () =>
      (dataset.Medical_Knowledge || []).filter(
        (ch) => String(ch.Status ?? '').trim().toLowerCase() === 'active'
      ),
    [dataset.Medical_Knowledge]
  );

  const activeChapters =
    activeSubTab === 'mpo_desk' ? mpoDeskChapters : medicalKnowledgeChapters;

  // Reset category filter & close dropdown when switching between MPO Desk and Medical Knowledge
  useEffect(() => {
    setSelectedCategory('');
    setCategorySearchQuery('');
    setCategoryMenuOpen(false);
  }, [activeSubTab]);

  // Outside-click & Escape handling for Searchable Category Combobox
  useEffect(() => {
    if (!categoryMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setCategoryMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [categoryMenuOpen]);

  // Focus inline search box when opening category dropdown
  useEffect(() => {
    if (categoryMenuOpen) {
      window.setTimeout(() => {
        categorySearchInputRef.current?.focus();
      }, 30);
    } else {
      setCategorySearchQuery('');
    }
  }, [categoryMenuOpen]);

  // Keyboard navigation & Escape close for Bengali Reader drawer
  useEffect(() => {
    if (!selectedChapter) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedChapter(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedChapter]);

  // Clean up clipboard feedback timer
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Categories with live chapter counts
  const categoryEntries = useMemo(() => {
    const counts = new Map<string, number>();
    activeChapters.forEach((ch) => {
      const cat = String(ch.Category ?? '').trim();
      if (!cat) return;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeChapters]);

  const filteredCategoryEntries = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categoryEntries;
    return categoryEntries.filter(([cat]) => cat.toLowerCase().includes(q));
  }, [categoryEntries, categorySearchQuery]);

  const selectedCategoryCount = useMemo(() => {
    if (!selectedCategory) return activeChapters.length;
    const found = categoryEntries.find(([cat]) => cat === selectedCategory);
    return found ? found[1] : 0;
  }, [selectedCategory, categoryEntries, activeChapters.length]);

  const filteredChapters = useMemo(() => {
    const rawQ = searchQuery.trim().toLowerCase();
    const tokens = rawQ ? rawQ.split(/\s+/).filter(Boolean) : [];
    const prefix = activeSubTab === 'mpo_desk' ? 'ch' : 'mk';

    return activeChapters.filter((ch, index) => {
      if (selectedCategory && String(ch.Category ?? '').trim() !== selectedCategory) {
        return false;
      }
      if (tokens.length === 0) return true;

      const fallbackId = `${prefix}-${String(index + 1).padStart(2, '0')}`;
      const chapterId = String(ch.Chapter_No ?? fallbackId).toLowerCase();
      const compactId = chapterId.replace(/[^a-z0-9]/g, '');
      const haystack = [
        chapterId,
        compactId,
        String(ch.Title_BN ?? '').toLowerCase(),
        String(ch.Short_Summary_BN ?? '').toLowerCase(),
        String(ch.Category ?? '').toLowerCase(),
        String(ch.Key_Takeaway_BN ?? '').toLowerCase(),
        String(ch.Full_Content_BN ?? '').toLowerCase(),
      ].join(' ');

      return tokens.every((tok) => {
        if (haystack.includes(tok)) return true;
        const compactTok = tok.replace(/[^a-z0-9]/g, '');
        return compactTok.length >= 2 && compactId.includes(compactTok);
      });
    });
  }, [activeChapters, activeSubTab, searchQuery, selectedCategory]);

  const selectedIndex = useMemo(() => {
    if (!selectedChapter) return -1;
    return filteredChapters.findIndex(
      (ch) =>
        ch.Chapter_No === selectedChapter.Chapter_No && ch.Title_BN === selectedChapter.Title_BN
    );
  }, [filteredChapters, selectedChapter]);

  const parsedBlocks = useMemo(
    () => (selectedChapter ? parseBengaliContentBlocks(selectedChapter.Full_Content_BN) : []),
    [selectedChapter]
  );

  const handleCopyChapter = async () => {
    if (!selectedChapter) return;
    const parts = [
      selectedChapter.Chapter_No
        ? `${selectedChapter.Chapter_No} — ${selectedChapter.Title_BN}`
        : selectedChapter.Title_BN,
      selectedChapter.Category ? `Category: ${selectedChapter.Category}` : '',
      selectedChapter.Short_Summary_BN ? `\n${selectedChapter.Short_Summary_BN}` : '',
      selectedChapter.Full_Content_BN ? `\n${selectedChapter.Full_Content_BN}` : '',
      selectedChapter.Key_Takeaway_BN
        ? `\nমূল শিক্ষা (Key Takeaway):\n${selectedChapter.Key_Takeaway_BN}`
        : '',
    ].filter(Boolean);

    const ok = await copyTextSafe(parts.join('\n'));
    if (!ok) return;
    setCopiedChapter(true);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedChapter(false);
      copyTimerRef.current = null;
    }, 2500);
  };

  const totalKnowledgeCount = mpoDeskChapters.length + medicalKnowledgeChapters.length;
  const isMpoTab = activeSubTab === 'mpo_desk';
  const hasActiveFilters = Boolean(searchQuery.trim() || selectedCategory);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Sticky Top Back Bar */}
      <StickyBackBar
        title="Knowledge Hub"
        subtitle={`${totalKnowledgeCount} chapters · বাংলায় ফিল্ড ও মেডিকেল গাইড`}
        rightSlot={
          <button
            type="button"
            disabled={isLoadingData || !isOnline || !isApiConfigured}
            onClick={() => void refreshFromServer(false)}
            className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] disabled:opacity-50 text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] ${
                isLoadingData ? 'animate-spin' : ''
              }`}
            />
            <span>{isLoadingData ? 'Syncing...' : 'Sync'}</span>
          </button>
        }
      />

      {/* Compact Control Surface: 2-Column Track Switcher + Search + Searchable Category Combobox */}
      <section
        aria-label="Knowledge Hub track switcher and filters"
        className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3 sm:p-4 space-y-2.5 shadow-sm shadow-[#0D2B45]/[0.03]"
      >
        {/* 1. Compact Side-by-Side 2-Column Segmented Track Switcher */}
        <div
          role="tablist"
          aria-label="Knowledge Hub tracks"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isMpoTab}
            onClick={() => setActiveSubTab('mpo_desk')}
            className={`min-h-[44px] px-2 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98] ${
              isMpoTab
                ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white shadow-xs'
                : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 hidden xs:inline sm:inline" />
            <span className="truncate">MPO Desk</span>
            <span
              className={`font-mono tabular-nums text-[11px] shrink-0 ${
                isMpoTab ? 'opacity-90' : 'opacity-70'
              }`}
            >
              ({mpoDeskChapters.length})
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={!isMpoTab}
            onClick={() => setActiveSubTab('medical_knowledge')}
            className={`min-h-[44px] px-2 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98] ${
              !isMpoTab
                ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white shadow-xs'
                : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:text-[#0D2B45] dark:hover:text-white'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 hidden xs:inline sm:inline" />
            <span className="truncate">Medical Knowledge</span>
            <span
              className={`font-mono tabular-nums text-[11px] shrink-0 ${
                !isMpoTab ? 'opacity-90' : 'opacity-70'
              }`}
            >
              ({medicalKnowledgeChapters.length})
            </span>
          </button>
        </div>

        {/* 2. Fast Full-Text Chapter Search + Searchable Category Dropdown (Combobox) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Chapter Search Input with inline clear button */}
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isMpoTab
                  ? 'খুঁজুন: শিরোনাম, কিওয়ার্ড, ক্যাটাগরি বা CH-01...'
                  : 'খুঁজুন: শিরোনাম, কিওয়ার্ড, ক্যাটাগরি বা MK-01...'
              }
              aria-label="Search knowledge chapters"
              className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-base md:text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear chapter search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 dark:text-[#EBF4FA]/60 hover:text-[#0D2B45] dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Searchable Category Combobox Dropdown */}
          {categoryEntries.length > 0 && (
            <div ref={categoryDropdownRef} className="relative w-full sm:w-[270px] shrink-0">
              <button
                type="button"
                role="combobox"
                aria-expanded={categoryMenuOpen}
                aria-haspopup="listbox"
                aria-controls="knowledge-category-listbox"
                aria-label="Filter chapters by category"
                onClick={() => setCategoryMenuOpen((open) => !open)}
                className={`w-full min-h-[44px] px-3.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  selectedCategory
                    ? 'bg-[#EBF4FA]/80 dark:bg-[#0E7C7B]/20 border-[#0E7C7B]/60 dark:border-[#149A99]/60 text-[#0D2B45] dark:text-white'
                    : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B]/50 text-[#0D2B45] dark:text-white'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0 text-sm font-medium">
                  <Filter className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                  <span className="truncate">
                    {selectedCategory ? selectedCategory : 'All Categories'}
                  </span>
                  <span className="font-mono tabular-nums text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/65 shrink-0">
                    ({selectedCategoryCount})
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#0D2B45]/55 dark:text-[#EBF4FA]/60 shrink-0 transition-transform ${
                    categoryMenuOpen ? 'rotate-180 text-[#0E7C7B] dark:text-[#149A99]' : ''
                  }`}
                />
              </button>

              {categoryMenuOpen && (
                <div
                  id="knowledge-category-listbox"
                  role="listbox"
                  aria-label="Categories"
                  className="absolute left-0 right-0 mt-1.5 z-30 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/14 dark:border-[#EBF4FA]/15 shadow-xl shadow-[#0D2B45]/12 dark:shadow-black/50 overflow-hidden"
                >
                  {/* Inline Category Search Box */}
                  <div className="p-2.5 border-b border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 bg-[#F4F8FC]/60 dark:bg-[#071522]/60">
                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        ref={categorySearchInputRef}
                        type="text"
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        placeholder="ক্যাটাগরি খুঁজুন..."
                        aria-label="Search categories"
                        className="w-full min-h-[40px] pl-8 pr-8 rounded-lg bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/15 text-base md:text-xs text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
                      />
                      {categorySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCategorySearchQuery('')}
                          aria-label="Clear category search"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[30px] min-w-[30px] flex items-center justify-center rounded text-[#0D2B45]/55 dark:text-[#EBF4FA]/60 hover:text-[#0D2B45] dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable Category Options */}
                  <div className="max-h-[260px] overflow-y-auto py-1 divide-y divide-[#0D2B45]/5 dark:divide-[#EBF4FA]/5">
                    {(!categorySearchQuery.trim() ||
                      'all categories'.includes(categorySearchQuery.trim().toLowerCase())) && (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedCategory === ''}
                        onClick={() => {
                          setSelectedCategory('');
                          setCategoryMenuOpen(false);
                        }}
                        className={`w-full min-h-[42px] px-3.5 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          selectedCategory === ''
                            ? 'bg-[#EBF4FA] dark:bg-[#0E7C7B]/25 text-[#0D2B45] dark:text-white font-semibold'
                            : 'text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/50'
                        }`}
                      >
                        <span className="truncate">All Categories</span>
                        <span className="inline-flex items-center gap-1.5 shrink-0">
                          <span className="font-mono tabular-nums text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/60">
                            ({activeChapters.length})
                          </span>
                          {selectedCategory === '' && (
                            <Check className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#7CE0DF]" />
                          )}
                        </span>
                      </button>
                    )}

                    {filteredCategoryEntries.length === 0 ? (
                      <div className="px-3.5 py-5 text-center text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                        কোনো ক্যাটাগরি পাওয়া যায়নি
                      </div>
                    ) : (
                      filteredCategoryEntries.map(([category, count]) => {
                        const isSelected = selectedCategory === category;
                        return (
                          <button
                            key={category}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedCategory(category);
                              setCategoryMenuOpen(false);
                            }}
                            className={`w-full min-h-[42px] px-3.5 py-2 text-left text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#EBF4FA] dark:bg-[#0E7C7B]/25 text-[#0D2B45] dark:text-white font-semibold'
                                : 'text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/50'
                            }`}
                          >
                            <span className="truncate">{category}</span>
                            <span className="inline-flex items-center gap-1.5 shrink-0">
                              <span className="font-mono tabular-nums text-xs text-[#0D2B45]/55 dark:text-[#EBF4FA]/60">
                                ({count})
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#7CE0DF]" />
                              )}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Quick Clear / Reset Footer when a category or search is active */}
                  {(selectedCategory || categorySearchQuery) && (
                    <div className="px-3 py-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 bg-[#F4F8FC]/60 dark:bg-[#071522]/60 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory('');
                          setCategorySearchQuery('');
                          setCategoryMenuOpen(false);
                        }}
                        className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline cursor-pointer"
                      >
                        Clear / Reset Category
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryMenuOpen(false)}
                        className="text-xs font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 hover:text-[#0D2B45] dark:hover:text-white cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Live Result Counter + Quick Reset */}
        <div className="flex items-center justify-between gap-2 text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 pt-0.5">
          <span className="font-mono tabular-nums">
            Showing {filteredChapters.length} of {activeChapters.length}{' '}
            {activeChapters.length === 1 ? 'chapter' : 'chapters'}
            {selectedCategory ? ` · ${selectedCategory}` : ''}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
                setCategorySearchQuery('');
              }}
              className="font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* Chapter Cards Grid */}
      {filteredChapters.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-10 text-center space-y-2.5">
          <BookOpen className="w-9 h-9 text-[#0E7C7B] dark:text-[#149A99] mx-auto" />
          <h2 className="text-base font-display font-bold text-[#0D2B45] dark:text-white">
            {activeChapters.length === 0
              ? `No active chapters loaded from ${isMpoTab ? 'MPO_Desk' : 'Medical_Knowledge'}`
              : 'কোনো চ্যাপ্টার পাওয়া যায়নি (No matching chapters)'}
          </h2>
          <p className="text-xs sm:text-sm text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 max-w-lg mx-auto leading-relaxed">
            {activeChapters.length === 0 ? (
              <>
                Make sure <code className="font-mono font-semibold">&apos;MPO_Desk&apos;</code> and{' '}
                <code className="font-mono font-semibold">&apos;Medical_Knowledge&apos;</code> are
                included in your Apps Script <code className="font-mono">SHEET_NAMES</code> list
                (see Settings → Apps Script API Contract Reference) with rows marked{' '}
                <code className="font-mono">Status = Active</code>, then click Sync Chapters.
              </>
            ) : (
              'অন্য কোনো বাংলা শব্দ বা ক্যাটাগরি নির্বাচন করে আবার চেষ্টা করুন।'
            )}
          </p>
          {activeChapters.length === 0 && isApiConfigured && (
            <div className="pt-2">
              <button
                type="button"
                disabled={isLoadingData || !isOnline}
                onClick={() => void refreshFromServer(false)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                <span>Sync Now</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <section
          aria-label={isMpoTab ? 'MPO Desk chapters' : 'Medical Knowledge chapters'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredChapters.map((chapter, index) => {
            const chapterBadge =
              chapter.Chapter_No ||
              `${isMpoTab ? 'CH' : 'MK'}-${String(index + 1).padStart(2, '0')}`;

            return (
              <article
                key={`${chapterBadge}-${chapter.Title_BN}-${index}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedChapter(chapter);
                  setCopiedChapter(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedChapter(chapter);
                    setCopiedChapter(false);
                  }
                }}
                className="group text-left rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] dark:hover:border-[#149A99] p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all hover:shadow-sm active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#0E7C7B] cursor-pointer"
              >
                <div className="space-y-2.5">
                  {/* Top Meta Row: Chapter_No Badge + Category + Read_Time */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wide shrink-0 ${
                          isMpoTab
                            ? 'bg-[#0D2B45] dark:bg-[#133859] text-white'
                            : 'bg-[#0E7C7B] text-white'
                        }`}
                      >
                        {chapterBadge}
                      </span>
                      {chapter.Category && (
                        <span className="px-2 py-0.5 rounded-md bg-[#EBF4FA] dark:bg-[#071522] text-[11px] font-semibold text-[#0E7C7B] dark:text-[#7CE0DF] truncate max-w-[170px]">
                          {chapter.Category}
                        </span>
                      )}
                    </div>

                    {chapter.Read_Time && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/60 whitespace-nowrap shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{chapter.Read_Time}</span>
                      </span>
                    )}
                  </div>

                  {/* Chapter Bengali Title */}
                  <h2 className="font-display font-bold text-base sm:text-[17px] text-[#0D2B45] dark:text-white group-hover:text-[#0E7C7B] dark:group-hover:text-[#149A99] leading-snug transition-colors">
                    {chapter.Title_BN || chapterBadge}
                  </h2>

                  {/* Bengali Summary */}
                  {chapter.Short_Summary_BN && (
                    <p className="text-xs sm:text-[13px] text-[#0D2B45]/72 dark:text-[#EBF4FA]/75 leading-[1.7] line-clamp-3">
                      {chapter.Short_Summary_BN}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] whitespace-nowrap">
                    <span>বিস্তারিত পড়ুন</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <WatchNowButton
                    videoUrl={chapter.Video_URL}
                    fallbackUrl={chapter.YouTube_URL}
                    size="compact"
                  />
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Full-Screen Mobile / Slide-Over Desktop Bengali Reader */}
      {selectedChapter && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="knowledge-reader-title"
          className="fixed inset-0 z-50 flex justify-end bg-[#071522]/65 backdrop-blur-xs"
          onClick={() => setSelectedChapter(null)}
        >
          <div
            className="relative w-full max-w-2xl h-[100dvh] sm:h-full bg-white dark:bg-[#0D2235] shadow-2xl sm:border-l border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Reader Sticky Header */}
            <div className="px-4 sm:px-6 pt-3 pb-4 sm:py-4 bg-[#0B2239] sm:bg-[#0D2B45] text-white border-b border-white/10 shrink-0 pt-safe">
              {/* Mobile Sticky Top Back Bar */}
              <div className="sm:hidden flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedChapter(null)}
                  className="min-h-[44px] -ml-1.5 px-2.5 rounded-xl text-white hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5 active:scale-[0.97]"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleCopyChapter()}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedChapter ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>কপি হয়েছে!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>কপি করুন</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedChapter.Chapter_No && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#0E7C7B] text-white text-xs font-mono font-bold tracking-wide">
                      {selectedChapter.Chapter_No}
                    </span>
                  )}
                  {selectedChapter.Category && (
                    <span className="px-2.5 py-0.5 rounded-md bg-white/12 text-[#EBF4FA] text-xs font-medium">
                      {selectedChapter.Category}
                    </span>
                  )}
                  {selectedChapter.Read_Time && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#EBF4FA]/75">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{selectedChapter.Read_Time}</span>
                    </span>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyChapter()}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/12 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedChapter ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>কপি করুন (Copy)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChapter(null)}
                    aria-label="Close reader"
                    className="min-h-[36px] min-w-[36px] rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h2
                id="knowledge-reader-title"
                className="font-display font-bold text-xl sm:text-2xl text-white mt-2.5 sm:mt-3 leading-snug"
              >
                {selectedChapter.Title_BN}
              </h2>
            </div>

            {/* Reader Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-5 sm:py-6 space-y-6">
              {/* Short Summary Lead Box */}
              {selectedChapter.Short_Summary_BN && (
                <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-4 py-3.5">
                  <p className="text-[15px] sm:text-base font-medium text-[#0D2B45]/85 dark:text-[#EBF4FA]/90 leading-[1.85]">
                    {selectedChapter.Short_Summary_BN}
                  </p>
                </div>
              )}

              {/* Full Bengali Content */}
              <article className="space-y-4 text-base sm:text-[17px] text-[#0D2B45]/92 dark:text-[#EBF4FA]/92 leading-[1.92]">
                {parsedBlocks.length > 0 ? (
                  parsedBlocks.map((block, bIdx) => {
                    if (block.type === 'heading') {
                      return (
                        <h3
                          key={bIdx}
                          className="font-display font-bold text-[17px] sm:text-lg text-[#0D2B45] dark:text-white pt-2"
                        >
                          {block.text}
                        </h3>
                      );
                    }
                    if (block.type === 'list' && block.items) {
                      return (
                        <ul key={bIdx} className="space-y-2.5 pl-1">
                          {block.items.map((item, iIdx) => (
                            <li key={iIdx} className="flex items-start gap-2.5">
                              <span
                                aria-hidden="true"
                                className="mt-2.5 w-1.5 h-1.5 rounded-full bg-[#0E7C7B] dark:bg-[#149A99] shrink-0"
                              />
                              <span className="flex-1">{item}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={bIdx} className="whitespace-pre-line">
                        {block.text}
                      </p>
                    );
                  })
                ) : (
                  <p className="text-base text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    এই অধ্যায়ের বিস্তারিত কনটেন্ট এখনো যুক্ত করা হয়নি।
                  </p>
                )}
              </article>

              {/* Highlighted "মূল শিক্ষা (Key Takeaway)" Callout Box */}
              {selectedChapter.Key_Takeaway_BN && (
                <aside
                  aria-label="মূল শিক্ষা (Key Takeaway)"
                  className="rounded-2xl bg-[#EBF4FA] dark:bg-[#0B2A3C] border-l-4 border-[#0E7C7B] dark:border-[#149A99] border-y border-r border-y-[#0E7C7B]/20 border-r-[#0E7C7B]/20 p-4 sm:p-5 space-y-2"
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#095C5B] dark:text-[#7CE0DF]">
                    <Lightbulb className="w-4 h-4 shrink-0" />
                    <span>মূল শিক্ষা (Key Takeaway)</span>
                  </div>
                  <p className="text-[15px] sm:text-base font-medium text-[#0D2B45] dark:text-white leading-[1.88] whitespace-pre-line">
                    {selectedChapter.Key_Takeaway_BN}
                  </p>
                </aside>
              )}
            </div>

            {/* Reader Sequential Chapter Navigation Footer */}
            <div className="px-4 sm:px-6 py-3.5 bg-[#F4F8FC] dark:bg-[#071522] border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex items-center justify-between gap-3 shrink-0 pb-safe">
              <button
                type="button"
                disabled={selectedIndex <= 0}
                onClick={() => {
                  if (selectedIndex > 0) {
                    setSelectedChapter(filteredChapters[selectedIndex - 1]);
                    setCopiedChapter(false);
                  }
                }}
                className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 hover:border-[#0E7C7B] disabled:opacity-40 text-xs font-semibold text-[#0D2B45] dark:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>আগের অধ্যায়</span>
              </button>

              <span className="text-xs font-mono tabular-nums text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                {selectedIndex >= 0 ? `${selectedIndex + 1} / ${filteredChapters.length}` : ''}
              </span>

              <button
                type="button"
                disabled={selectedIndex < 0 || selectedIndex >= filteredChapters.length - 1}
                onClick={() => {
                  if (selectedIndex >= 0 && selectedIndex < filteredChapters.length - 1) {
                    setSelectedChapter(filteredChapters[selectedIndex + 1]);
                    setCopiedChapter(false);
                  }
                }}
                className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>পরবর্তী অধ্যায়</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
