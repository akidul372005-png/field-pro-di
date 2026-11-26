import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Building2,
  GraduationCap,
  Pill,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getEffectiveIndications, isActiveRecord } from '../services/api';

export const GlobalSearchBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    dataset,
    teamSession,
    hospitalMap,
    areaMap,
    openDoctorProfile,
    openProductBrief,
    setDoctorDirectoryHospitalFilter,
    setDoctorDirectoryAreaFilter,
    setActiveTab,
  } = useApp();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeIndications = useMemo(() => {
    const { indications } = getEffectiveIndications(dataset);
    return indications.filter((ind) => isActiveRecord(ind as unknown as Record<string, unknown>));
  }, [dataset]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return null;

    const products = dataset.Products.filter(
      (p) =>
        String(p.Brand_Name ?? p.Product_Name ?? '').toLowerCase().includes(q) ||
        String(p.Product_Name ?? '').toLowerCase().includes(q) ||
        String(p.Generic_Name ?? '').toLowerCase().includes(q) ||
        String(p.Therapeutic_Class ?? '').toLowerCase().includes(q) ||
        String(p.Approved_Indications ?? '').toLowerCase().includes(q)
    ).slice(0, 5);

    const indications = activeIndications
      .filter(
        (ind) =>
          String(ind.Indication_Name ?? '').toLowerCase().includes(q) ||
          String(ind.Category ?? '').toLowerCase().includes(q) ||
          String(ind.Key_Generics ?? '').toLowerCase().includes(q) ||
          String(ind.Relevant_Specialists ?? '').toLowerCase().includes(q)
      )
      .slice(0, 4);

    const allKnowledge = [...(dataset.MPO_Desk || []), ...(dataset.Medical_Knowledge || [])].filter(
      (ch) => String(ch.Status ?? '').trim().toLowerCase() === 'active'
    );
    const chapters = allKnowledge
      .filter(
        (ch) =>
          String(ch.Title_BN ?? '').toLowerCase().includes(q) ||
          String(ch.Short_Summary_BN ?? '').toLowerCase().includes(q) ||
          String(ch.Category ?? '').toLowerCase().includes(q) ||
          String(ch.Chapter_No ?? '').toLowerCase().includes(q)
      )
      .slice(0, 3);

    // Private Team data (Doctors & Hospitals) only searchable when Team session is unlocked
    const doctors = teamSession
      ? dataset.Doctors.filter((d) => {
          if (!teamSession.canSwitchAreas && teamSession.areaId !== 'ALL' && d.Area_ID !== teamSession.areaId) {
            return false;
          }
          return (
            String(d.Doctor_Name ?? '').toLowerCase().includes(q) ||
            String(d.Specialty ?? '').toLowerCase().includes(q) ||
            String(d.Degree ?? '').toLowerCase().includes(q) ||
            String(d.Phone ?? '').toLowerCase().includes(q)
          );
        }).slice(0, 4)
      : [];

    const hospitals = teamSession
      ? dataset.Hospitals.filter((h) => {
          if (!teamSession.canSwitchAreas && teamSession.areaId !== 'ALL' && h.Area_ID !== teamSession.areaId) {
            return false;
          }
          return (
            String(h.Hospital_Name ?? '').toLowerCase().includes(q) ||
            String(h.Address ?? '').toLowerCase().includes(q)
          );
        }).slice(0, 3)
      : [];

    const total =
      products.length + indications.length + chapters.length + doctors.length + hospitals.length;
    return { products, indications, chapters, doctors, hospitals, total };
  }, [query, dataset, activeIndications, teamSession]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search
          className={`${
            compact ? 'w-4 h-4 left-3' : 'w-4 h-4 sm:w-5 sm:h-5 left-3.5 sm:left-4'
          } text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute pointer-events-none`}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setOpen(true);
          }}
          placeholder={
            teamSession
              ? 'Search products, generics, indications, chapters, doctors...'
              : 'Search products, generics, indications, or chapters...'
          }
          aria-label="Global search"
          className={
            compact
              ? 'w-full py-2 min-h-[40px] sm:min-h-[44px] pl-9 pr-9 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/15 shadow-sm text-sm text-[#0D2B45] dark:text-[#EBF4FA] placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B] focus:ring-2 focus:ring-[#0E7C7B]/20 transition-colors'
              : 'w-full min-h-[48px] sm:min-h-[52px] pl-10 sm:pl-12 pr-11 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/15 shadow-sm text-base md:text-[15px] text-[#0D2B45] dark:text-[#EBF4FA] placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B] focus:ring-2 focus:ring-[#0E7C7B]/20 transition-colors'
          }
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear search"
            className={`absolute right-1 ${
              compact ? 'min-h-[34px] min-w-[34px]' : 'min-h-[40px] min-w-[40px]'
            } flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results && (
        <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/15 shadow-xl shadow-[#0D2B45]/10 dark:shadow-black/50 overflow-hidden max-h-[68vh] overflow-y-auto">
          {results.total === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
              No matching records found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
              {results.products.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-xs font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Products &amp; Generics
                  </div>
                  {results.products.map((prod, idx) => (
                    <button
                      key={`${prod.Product_ID}-${idx}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setQuery('');
                        openProductBrief(prod.Product_ID);
                      }}
                      className="w-full min-h-[48px] text-left px-2.5 py-2.5 rounded-xl hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 flex items-center gap-3 transition-colors"
                    >
                      <Pill className="w-4 h-4 text-[#0E7C7B] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#0D2B45] dark:text-white truncate">
                          {prod.Brand_Name || prod.Product_Name}
                        </div>
                        <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                          {prod.Generic_Name} · {prod.Strength} · {prod.Therapeutic_Class}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.indications.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-xs font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Indications
                  </div>
                  {results.indications.map((ind, idx) => (
                    <button
                      key={`${ind.Indication_ID || ind.Indication_Name}-${idx}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setQuery('');
                        setActiveTab('indications');
                      }}
                      className="w-full min-h-[48px] text-left px-2.5 py-2.5 rounded-xl hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 flex items-center gap-3 transition-colors"
                    >
                      <Activity className="w-4 h-4 text-[#0E7C7B] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#0D2B45] dark:text-white truncate">
                          {ind.Indication_Name}
                        </div>
                        <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                          {ind.Category} · {ind.Key_Generics}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.chapters.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-xs font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Knowledge Hub
                  </div>
                  {results.chapters.map((ch, idx) => (
                    <button
                      key={`${ch.Chapter_No}-${idx}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setQuery('');
                        setActiveTab('knowledge');
                      }}
                      className="w-full min-h-[48px] text-left px-2.5 py-2.5 rounded-xl hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 flex items-center gap-3 transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 text-[#0E7C7B] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#0D2B45] dark:text-white truncate">
                          {ch.Title_BN}
                        </div>
                        <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                          {ch.Chapter_No} · {ch.Category}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.doctors.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-xs font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Area Doctors (Team)
                  </div>
                  {results.doctors.map((doc, idx) => (
                    <button
                      key={`${doc.Doctor_ID}-${idx}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setQuery('');
                        openDoctorProfile(doc.Doctor_ID);
                      }}
                      className="w-full min-h-[48px] text-left px-2.5 py-2.5 rounded-xl hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 flex items-center gap-3 transition-colors"
                    >
                      <Stethoscope className="w-4 h-4 text-[#0E7C7B] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#0D2B45] dark:text-white truncate">
                          {doc.Doctor_Name}
                        </div>
                        <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                          {doc.Specialty} ·{' '}
                          {hospitalMap.get(doc.Primary_Hospital_ID)?.Hospital_Name ||
                            doc.Primary_Hospital_ID}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results.hospitals.length > 0 && (
                <div className="p-2">
                  <div className="px-2.5 py-1.5 text-xs font-medium text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                    Area Hospitals (Team)
                  </div>
                  {results.hospitals.map((hosp, idx) => (
                    <button
                      key={`${hosp.Hospital_ID}-${idx}`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setQuery('');
                        setDoctorDirectoryAreaFilter('');
                        setDoctorDirectoryHospitalFilter(hosp.Hospital_ID);
                        setActiveTab('team');
                      }}
                      className="w-full min-h-[48px] text-left px-2.5 py-2.5 rounded-xl hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 flex items-center gap-3 transition-colors"
                    >
                      <Building2 className="w-4 h-4 text-[#0E7C7B] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#0D2B45] dark:text-white truncate">
                          {hosp.Hospital_Name}
                        </div>
                        <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 truncate">
                          {areaMap.get(hosp.Area_ID)?.Area_Name || hosp.Area_ID}
                          {hosp.Hospital_Type ? ` · ${hosp.Hospital_Type}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
