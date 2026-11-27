import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pill,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  doctorMatchesDepartment,
  formatLinkedProductNames,
  getDoctorSchedule,
  getDoctorType,
  matchSpecialistName,
  parseProductIds,
} from '../services/api';
import { DoctorType } from '../types';

interface DoctorsViewProps {
  areaScopeId?: string;
  embeddedInTeam?: boolean;
}

export const DoctorsView: React.FC<DoctorsViewProps> = ({
  areaScopeId,
  embeddedInTeam = false,
}) => {
  const {
    dataset,
    areaMap,
    hospitalMap,
    departmentMap,
    productMap,
    selectedDoctorId,
    setSelectedDoctorId,
    startDetailingFlow,
    doctorDirectoryAreaFilter,
    setDoctorDirectoryAreaFilter,
    doctorDirectorySubAreaFilter,
    setDoctorDirectorySubAreaFilter,
    doctorDirectoryHospitalFilter,
    setDoctorDirectoryHospitalFilter,
    doctorDirectorySpecialtyFilter,
    setDoctorDirectorySpecialtyFilter,
    isReadOnlySuperiorView,
    openAddModal,
    openEditModal,
    requestDeleteRecord,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [doctorTypeFilter, setDoctorTypeFilter] = useState<'' | DoctorType>('');

  const isSingleAreaScoped = Boolean(areaScopeId && areaScopeId !== 'ALL');

  const scopedDoctorsBase = useMemo(() => {
    if (!isSingleAreaScoped) return dataset.Doctors;
    return dataset.Doctors.filter((d) => d.Area_ID === areaScopeId);
  }, [dataset.Doctors, isSingleAreaScoped, areaScopeId]);

  const doctorTypeCounts = useMemo(() => {
    let regular = 0;
    let guest = 0;
    scopedDoctorsBase.forEach((doc) => {
      if (getDoctorType(doc) === 'Guest') guest += 1;
      else regular += 1;
    });
    return { regular, guest };
  }, [scopedDoctorsBase]);

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchedDept = doctorDirectorySpecialtyFilter
      ? dataset.Departments.find(
          (dept) =>
            dept.Department_ID === doctorDirectorySpecialtyFilter ||
            matchSpecialistName(dept.Department_Name, doctorDirectorySpecialtyFilter)
        )
      : undefined;

    return scopedDoctorsBase.filter((doc) => {
      if (!isSingleAreaScoped && doctorDirectoryAreaFilter && doc.Area_ID !== doctorDirectoryAreaFilter)
        return false;
      if (doctorDirectorySubAreaFilter) {
        const docSub = String(doc.Sub_Area || doc.areaName || '').trim().toLowerCase();
        if (docSub !== doctorDirectorySubAreaFilter.trim().toLowerCase()) return false;
      }
      if (doctorDirectoryHospitalFilter && doc.Primary_Hospital_ID !== doctorDirectoryHospitalFilter)
        return false;
      if (doctorDirectorySpecialtyFilter) {
        const matchesDept = matchedDept ? doctorMatchesDepartment(doc, matchedDept) : false;
        const matchesSpecName = matchSpecialistName(doc.Specialty, doctorDirectorySpecialtyFilter);
        if (!matchesDept && !matchesSpecName) return false;
      }
      if (doctorTypeFilter && getDoctorType(doc) !== doctorTypeFilter) return false;

      if (!q) return true;
      const hospName = String(
        hospitalMap.get(doc.Primary_Hospital_ID)?.Hospital_Name ?? ''
      ).toLowerCase();
      const areaName = String(areaMap.get(doc.Area_ID)?.Area_Name ?? '').toLowerCase();
      const subAreaName = String(doc.Sub_Area || doc.areaName || '').toLowerCase();
      const deptName = String(
        departmentMap.get(doc.Department_ID)?.Department_Name ?? ''
      ).toLowerCase();
      const docType = getDoctorType(doc).toLowerCase();
      const schedule = getDoctorSchedule(doc, dataset.Chambers);

      return (
        String(doc.Doctor_Name ?? '').toLowerCase().includes(q) ||
        String(doc.Degree ?? '').toLowerCase().includes(q) ||
        String(doc.Specialty ?? '').toLowerCase().includes(q) ||
        deptName.includes(q) ||
        hospName.includes(q) ||
        areaName.includes(q) ||
        subAreaName.includes(q) ||
        docType.includes(q) ||
        schedule.days.toLowerCase().includes(q) ||
        schedule.hours.toLowerCase().includes(q) ||
        String(doc.Phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [
    scopedDoctorsBase,
    isSingleAreaScoped,
    dataset.Departments,
    dataset.Chambers,
    searchQuery,
    doctorDirectoryAreaFilter,
    doctorDirectorySubAreaFilter,
    doctorDirectoryHospitalFilter,
    doctorDirectorySpecialtyFilter,
    doctorTypeFilter,
    hospitalMap,
    areaMap,
    departmentMap,
  ]);

  const activeFilterCount =
    (doctorDirectoryAreaFilter ? 1 : 0) +
    (doctorDirectorySubAreaFilter ? 1 : 0) +
    (doctorDirectoryHospitalFilter ? 1 : 0) +
    (doctorDirectorySpecialtyFilter ? 1 : 0) +
    (doctorTypeFilter ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const selectedDoctor = useMemo(
    () => dataset.Doctors.find((d) => d.Doctor_ID === selectedDoctorId) || null,
    [dataset.Doctors, selectedDoctorId]
  );

  const selectedDoctorChambers = useMemo(
    () =>
      selectedDoctor
        ? dataset.Chambers.filter((c) => c.Doctor_ID === selectedDoctor.Doctor_ID)
        : [],
    [dataset.Chambers, selectedDoctor]
  );

  const selectedDoctorSchedule = useMemo(
    () => (selectedDoctor ? getDoctorSchedule(selectedDoctor, dataset.Chambers) : null),
    [selectedDoctor, dataset.Chambers]
  );

  const selectedDoctorDetailing = useMemo(
    () =>
      selectedDoctor
        ? dataset.Doctor_Product_Detailing.filter(
            (d) =>
              (d.Specialist &&
                selectedDoctor.Specialty &&
                matchSpecialistName(d.Specialist, selectedDoctor.Specialty)) ||
              (d.Doctor_ID && d.Doctor_ID === selectedDoctor.Doctor_ID)
          )
        : [],
    [dataset.Doctor_Product_Detailing, selectedDoctor]
  );

  const resetFilters = () => {
    setSearchQuery('');
    setDoctorDirectoryAreaFilter('');
    setDoctorDirectorySubAreaFilter('');
    setDoctorDirectoryHospitalFilter('');
    setDoctorDirectorySpecialtyFilter('');
    setDoctorTypeFilter('');
  };

  const activeHospitalLabel = doctorDirectoryHospitalFilter
    ? hospitalMap.get(doctorDirectoryHospitalFilter)?.Hospital_Name || doctorDirectoryHospitalFilter
    : '';

  return (
    <div className="space-y-3">
      {!embeddedInTeam && (
        <h1 className="text-xl font-display font-bold text-[#0D2B45] dark:text-white tracking-tight">
          Doctors
        </h1>
      )}

      {/* Row 1: Compact Search Input + Sleek + Add Button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search
            className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ডাক্তার, ডিগ্রি বা এরিয়া খুঁজুন..."
            aria-label="Search doctors by name, degree, or area"
            className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
          />
        </div>

        {!isReadOnlySuperiorView && (
          <button
            type="button"
            onClick={() =>
              openAddModal(
                'Doctors',
                isSingleAreaScoped
                  ? {
                      Area_ID: areaScopeId,
                      ...(doctorDirectorySubAreaFilter
                        ? { Sub_Area: doctorDirectorySubAreaFilter }
                        : {}),
                    }
                  : undefined
              )
            }
            className="min-h-[42px] px-3.5 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        )}
      </div>

      {/* Row 2: Clean 3-Pill Filter Row (সব | নিয়মিত | গেস্ট) */}
      <div
        role="group"
        aria-label="Filter doctors by type"
        className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10"
      >
        {(
          [
            { value: '', label: 'সব (All)', count: scopedDoctorsBase.length },
            { value: 'Regular', label: 'নিয়মিত (Regular)', count: doctorTypeCounts.regular },
            { value: 'Guest', label: 'গেস্ট (Guest)', count: doctorTypeCounts.guest },
          ] as const
        ).map((opt) => {
          const active = doctorTypeFilter === opt.value;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setDoctorTypeFilter(opt.value)}
              className={`min-h-[36px] px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                active
                  ? opt.value === 'Guest'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                  : 'text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 hover:bg-[#F4F8FC] dark:hover:bg-[#071522]'
              }`}
            >
              {opt.label}{' '}
              <span className="font-mono tabular-nums text-[10px] opacity-80">({opt.count})</span>
            </button>
          );
        })}
      </div>

      {/* Optional Active Context Chip (only when jumped from Areas or Hospitals tab) */}
      {(doctorDirectorySubAreaFilter || activeHospitalLabel || doctorDirectorySpecialtyFilter) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {doctorDirectorySubAreaFilter && (
            <button
              type="button"
              onClick={() => setDoctorDirectorySubAreaFilter('')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E6FBF3] dark:bg-[#0C2E2B] text-[#0E7C7B] dark:text-[#22E3D0] font-semibold cursor-pointer"
            >
              <MapPin className="w-3 h-3" />
              <span>{doctorDirectorySubAreaFilter}</span>
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}
          {activeHospitalLabel && (
            <button
              type="button"
              onClick={() => setDoctorDirectoryHospitalFilter('')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EBF4FA] dark:bg-[#102E47] text-[#0D2B45] dark:text-[#9FD8F5] font-semibold cursor-pointer"
            >
              <Building2 className="w-3 h-3" />
              <span className="truncate max-w-[180px]">{activeHospitalLabel}</span>
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}
          {doctorDirectorySpecialtyFilter && (
            <button
              type="button"
              onClick={() => setDoctorDirectorySpecialtyFilter('')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EBF4FA] dark:bg-[#102E47] text-[#0D2B45] dark:text-[#9FD8F5] font-semibold cursor-pointer"
            >
              <span>{doctorDirectorySpecialtyFilter}</span>
              <X className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Doctors List Grid */}
      {filteredDoctors.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center">
          <p className="text-sm sm:text-base font-display font-semibold text-[#0D2B45] dark:text-white">
            {activeFilterCount > 0 ? 'No matching doctors found' : 'No doctors added yet'}
          </p>
          <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1">
            {activeFilterCount > 0
              ? 'Try another search keyword or switch back to সব (All).'
              : 'Tap + Add above to save your first territory doctor.'}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-3.5 inline-flex items-center px-3.5 py-2 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDoctors.map((doc, idx) => {
            const hospital = hospitalMap.get(doc.Primary_Hospital_ID);
            const area = areaMap.get(doc.Area_ID);
            const deptName =
              departmentMap.get(doc.Department_ID)?.Department_Name || doc.Specialty;
            const subAreaText = (doc.Sub_Area || doc.areaName || area?.Area_Name || '').trim();
            const hospitalText = (hospital?.Hospital_Name || doc.Primary_Hospital_ID || '').trim();
            const docType = getDoctorType(doc);
            const schedule = getDoctorSchedule(doc, dataset.Chambers);
            const visitingSummary = [schedule.days, schedule.hours].filter(Boolean).join(' · ');

            return (
              <div
                key={`${doc.Doctor_ID}-${idx}`}
                onClick={() => setSelectedDoctorId(doc.Doctor_ID)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDoctorId(doc.Doctor_ID);
                  }
                }}
                className="group cursor-pointer rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 hover:border-[#0E7C7B] p-3.5 sm:p-4 flex flex-col justify-between gap-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-[#0E7C7B]"
              >
                <div className="space-y-1.5">
                  {/* Name + Regular/Guest Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white group-hover:text-[#0E7C7B] dark:group-hover:text-[#22E3D0] transition-colors truncate">
                          {doc.Doctor_Name}
                        </h2>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-bold shrink-0 ${
                            docType === 'Guest'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                              : 'bg-[#E6FBF3] text-[#0E7C7B] dark:bg-[#0E7C7B]/20 dark:text-[#22E3D0]'
                          }`}
                        >
                          {docType === 'Guest' ? 'Guest' : 'Regular'}
                        </span>
                      </div>

                      {/* Degree & Specialty Inline */}
                      {(doc.Degree || deptName) && (
                        <p className="text-xs text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 mt-0.5 truncate">
                          {doc.Degree && <span>{doc.Degree}</span>}
                          {doc.Degree && deptName && (
                            <span className="mx-1.5 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35">·</span>
                          )}
                          {deptName && (
                            <span className="font-semibold text-[#0E7C7B] dark:text-[#22E3D0]">
                              {deptName}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#0D2B45]/35 dark:text-[#EBF4FA]/35 group-hover:text-[#0E7C7B] shrink-0 mt-0.5" />
                  </div>

                  {/* Hospital · Sub-Area · Visiting Time (Compact & Crisp) */}
                  <div className="pt-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 space-y-1 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                    {(hospitalText || subAreaText) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {hospitalText && (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <Building2 className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                            <span className="font-medium text-[#0D2B45] dark:text-white truncate">
                              {hospitalText}
                            </span>
                          </span>
                        )}
                        {hospitalText && subAreaText && (
                          <span className="text-[#0D2B45]/35 dark:text-[#EBF4FA]/35">·</span>
                        )}
                        {subAreaText && (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                            <span className="font-medium truncate">{subAreaText}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {visitingSummary && (
                      <div className="flex items-center gap-1.5 text-[11.5px] text-[#0D2B45]/70 dark:text-[#EBF4FA]/70">
                        <Clock className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                        <span className="truncate">{visitingSummary}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Footer: Phone + Edit / Delete / Detailing */}
                <div className="pt-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 truncate">
                    {doc.Phone ? (
                      <a
                        href={`tel:${doc.Phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 font-mono text-[11.5px] text-[#0D2B45]/70 dark:text-[#EBF4FA]/75 hover:text-[#0E7C7B] hover:underline"
                      >
                        <Phone className="w-3 h-3 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                        <span className="truncate">{doc.Phone}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-[#0D2B45]/40 dark:text-[#EBF4FA]/40">
                        Tap for profile
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isReadOnlySuperiorView && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal('Doctors', doc as unknown as Record<string, unknown>);
                          }}
                          aria-label={`Edit ${doc.Doctor_Name}`}
                          title="Edit doctor"
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#22E3D0] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/60 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            requestDeleteRecord(
                              'Doctors',
                              doc as unknown as Record<string, unknown>,
                              doc.Doctor_Name
                            );
                          }}
                          aria-label={`Delete ${doc.Doctor_Name}`}
                          title="Delete doctor"
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startDetailingFlow({ specialist: doc.Specialty, subTab: 'detailing' });
                      }}
                      className="min-h-[34px] px-2.5 rounded-lg bg-[#EBF4FA] dark:bg-[#133859] font-semibold text-xs text-[#0E7C7B] dark:text-[#7CE0DF] hover:bg-[#dcecf7] dark:hover:bg-[#1B4A73] whitespace-nowrap shrink-0 inline-flex items-center justify-center cursor-pointer transition-colors"
                    >
                      Detailing
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Doctor Profile Slide-Over / Full-Screen Mobile View */}
      {selectedDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end bg-black/60"
          onClick={() => setSelectedDoctorId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedDoctor.Doctor_Name} details`}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[540px] h-[100dvh] sm:h-full bg-white dark:bg-[#0D2235] sm:rounded-l-2xl sm:border-l border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 flex flex-col overflow-hidden"
          >
            {/* Mobile Sticky Top Back Bar */}
            <div className="sm:hidden shrink-0 bg-[#0B2239] text-white px-3.5 py-2.5 flex items-center justify-between gap-2 pt-safe border-b border-white/10">
              <button
                type="button"
                onClick={() => setSelectedDoctorId(null)}
                className="min-h-[44px] -ml-1 px-2.5 rounded-xl text-white hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              {!isReadOnlySuperiorView && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      openEditModal('Doctors', selectedDoctor as unknown as Record<string, unknown>)
                    }
                    aria-label={`Edit ${selectedDoctor.Doctor_Name}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-white/85 hover:bg-white/10"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      requestDeleteRecord(
                        'Doctors',
                        selectedDoctor as unknown as Record<string, unknown>,
                        selectedDoctor.Doctor_Name
                      )
                    }
                    aria-label={`Delete ${selectedDoctor.Doctor_Name}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-rose-300 hover:bg-white/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Header */}
            <div className="px-4 sm:px-5 py-4 border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium text-[#0E7C7B] dark:text-[#149A99]">
                    {departmentMap.get(selectedDoctor.Department_ID)?.Department_Name ||
                      selectedDoctor.Specialty}
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      getDoctorType(selectedDoctor) === 'Guest'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                        : 'bg-[#EBF4FA] text-[#0E7C7B] dark:bg-[#0E7C7B]/20 dark:text-[#149A99]'
                    }`}
                  >
                    {getDoctorType(selectedDoctor) === 'Guest'
                      ? 'Guest · গেস্ট'
                      : 'Regular · নিয়মিত'}
                  </span>
                </div>
                <h2 className="text-xl font-display font-bold text-[#0D2B45] dark:text-white mt-0.5">
                  {selectedDoctor.Doctor_Name}
                </h2>
                <p className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                  {selectedDoctor.Degree}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {!isReadOnlySuperiorView && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openEditModal('Doctors', selectedDoctor as unknown as Record<string, unknown>)
                      }
                      aria-label={`Edit ${selectedDoctor.Doctor_Name}`}
                      title="Edit doctor"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99] hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        requestDeleteRecord(
                          'Doctors',
                          selectedDoctor as unknown as Record<string, unknown>,
                          selectedDoctor.Doctor_Name
                        )
                      }
                      aria-label={`Delete ${selectedDoctor.Doctor_Name}`}
                      title="Delete doctor"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDoctorId(null)}
                  aria-label="Close doctor profile"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#0D2B45]/60 hover:text-[#0D2B45] dark:text-[#EBF4FA]/60 dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 pb-10 pb-safe space-y-6">
              {/* Primary Actions */}
              <div className={`grid ${isReadOnlySuperiorView ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <button
                  type="button"
                  onClick={() => {
                    const spec = selectedDoctor.Specialty;
                    setSelectedDoctorId(null);
                    startDetailingFlow({ specialist: spec, subTab: 'detailing' });
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Pill className="w-4 h-4" />
                  <span>Detailing Guide</span>
                </button>
                {!isReadOnlySuperiorView && (
                  <button
                    type="button"
                    onClick={() =>
                      openEditModal('Doctors', selectedDoctor as unknown as Record<string, unknown>)
                    }
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#EBF4FA] dark:bg-[#133859] text-[#0D2B45] dark:text-white hover:bg-[#dcecf7] dark:hover:bg-[#1C4A73] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
                    <span>Edit Doctor</span>
                  </button>
                )}
              </div>

              {/* Affiliation, Hospital / Chamber & Visiting Schedule */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                      Hospital / Chamber
                    </div>
                    <div className="font-semibold text-[#0D2B45] dark:text-white">
                      {hospitalMap.get(selectedDoctor.Primary_Hospital_ID)?.Hospital_Name ||
                        selectedDoctor.Primary_Hospital_ID}
                    </div>
                    <div className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                      Specialist:{' '}
                      {departmentMap.get(selectedDoctor.Department_ID)?.Department_Name ||
                        selectedDoctor.Specialty ||
                        selectedDoctor.Department_ID}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                  <MapPin className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                  <span>
                    <strong className="text-[#0D2B45] dark:text-white">
                      {selectedDoctor.Sub_Area ||
                        selectedDoctor.areaName ||
                        areaMap.get(selectedDoctor.Area_ID)?.Area_Name ||
                        '—'}
                    </strong>
                    {areaMap.get(selectedDoctor.Area_ID)?.Area_Name &&
                    (selectedDoctor.Sub_Area || selectedDoctor.areaName)
                      ? ` · ${areaMap.get(selectedDoctor.Area_ID)?.Area_Name}`
                      : ''}
                  </span>
                </div>
                {(selectedDoctorSchedule?.days || selectedDoctorSchedule?.hours) && (
                  <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 px-3.5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                    {selectedDoctorSchedule.days && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#0D2B45] dark:text-white">
                        <Calendar className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        <span>{selectedDoctorSchedule.days}</span>
                      </span>
                    )}
                    {selectedDoctorSchedule.hours && (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[#0D2B45]/85 dark:text-[#EBF4FA]/85">
                        <Clock className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        <span>{selectedDoctorSchedule.hours}</span>
                      </span>
                    )}
                  </div>
                )}
                {selectedDoctor.Phone && (
                  <div className="flex items-center gap-2.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75 font-mono">
                    <Phone className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                    <a href={`tel:${selectedDoctor.Phone}`} className="hover:underline">
                      {selectedDoctor.Phone}
                    </a>
                  </div>
                )}
                {selectedDoctor.Email && (
                  <div className="flex items-center gap-2.5 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                    <Mail className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99] shrink-0" />
                    <span>{selectedDoctor.Email}</span>
                  </div>
                )}
              </div>

              {/* Chamber & Visiting Schedule */}
              <div className="pt-4 border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10">
                <h3 className="text-sm font-display font-semibold text-[#0D2B45] dark:text-white mb-3">
                  Chamber &amp; Visiting Schedule ({Math.max(1, selectedDoctorChambers.length)})
                </h3>
                {selectedDoctorChambers.length === 0 ? (
                  <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 p-3.5">
                    <div className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                      {hospitalMap.get(selectedDoctor.Primary_Hospital_ID)?.Hospital_Name ||
                        selectedDoctor.Primary_Hospital_ID ||
                        'Primary Hospital Chamber'}
                    </div>
                    {hospitalMap.get(selectedDoctor.Primary_Hospital_ID)?.Address && (
                      <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                        {hospitalMap.get(selectedDoctor.Primary_Hospital_ID)?.Address}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        {selectedDoctorSchedule?.days || 'Days not specified'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        {selectedDoctorSchedule?.hours || 'Time not specified'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                    {selectedDoctorChambers.map((chm, cIdx) => (
                      <div key={`${chm.Chamber_ID}-${cIdx}`} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-[#0D2B45] dark:text-white">
                            {chm.Chamber_Name}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal('Chambers', chm as unknown as Record<string, unknown>)
                              }
                              aria-label={`Edit ${chm.Chamber_Name}`}
                              className="p-1.5 rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99]"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestDeleteRecord(
                                  'Chambers',
                                  chm as unknown as Record<string, unknown>,
                                  chm.Chamber_Name
                                )
                              }
                              aria-label={`Delete ${chm.Chamber_Name}`}
                              className="p-1.5 rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {chm.Address && (
                          <div className="text-xs text-[#0D2B45]/65 dark:text-[#EBF4FA]/65 mt-0.5">
                            {chm.Address}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                            {chm.Visiting_Days || '—'}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                            {chm.Visiting_Hours || '—'}
                          </span>
                        </div>
                        {chm.Assistant_Phone && (
                          <div className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-1 font-mono">
                            Assistant: {chm.Assistant_Phone}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommended Specialist Detailing Scripts */}
              <div className="pt-4 border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-display font-semibold text-[#0D2B45] dark:text-white">
                    Detailing Scripts ({selectedDoctor.Specialty || 'All'}) · {selectedDoctorDetailing.length}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const spec = selectedDoctor.Specialty;
                      setSelectedDoctorId(null);
                      startDetailingFlow({ specialist: spec, subTab: 'detailing' });
                    }}
                    className="text-xs font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline whitespace-nowrap"
                  >
                    Open Guide
                  </button>
                </div>
                {selectedDoctorDetailing.length === 0 ? (
                  <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                    No specialist detailing scripts saved for {selectedDoctor.Specialty || 'this specialty'} yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                    {selectedDoctorDetailing.map((dtl) => {
                      const linkedIds = parseProductIds(dtl.Product_ID);
                      const firstProd = linkedIds[0] ? productMap.get(linkedIds[0]) : undefined;
                      const brandLabel = formatLinkedProductNames(dtl.Product_ID, productMap);
                      return (
                        <div key={dtl.Detailing_ID} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const spec = dtl.Specialist || selectedDoctor.Specialty;
                                setSelectedDoctorId(null);
                                startDetailingFlow({
                                  productId: linkedIds[0] || dtl.Product_ID,
                                  specialist: spec,
                                  subTab: 'detailing',
                                });
                              }}
                              className="text-left text-sm font-semibold text-[#0D2B45] dark:text-white hover:text-[#0E7C7B] dark:hover:text-[#149A99]"
                            >
                              {brandLabel}
                              {linkedIds.length === 1 && firstProd?.Generic_Name && (
                                <span className="font-normal text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 ml-1.5">
                                  ({firstProd.Generic_Name})
                                </span>
                              )}
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    'Doctor_Product_Detailing',
                                    dtl as unknown as Record<string, unknown>
                                  )
                                }
                                aria-label={`Edit ${brandLabel} detailing script`}
                                className="p-1 rounded-lg text-[#0D2B45]/60 hover:text-[#0E7C7B] dark:text-[#EBF4FA]/60 dark:hover:text-[#149A99]"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  requestDeleteRecord(
                                    'Doctor_Product_Detailing',
                                    dtl as unknown as Record<string, unknown>,
                                    `${brandLabel} (${dtl.Specialist || 'Script'})`
                                  )
                                }
                                aria-label={`Delete ${brandLabel} detailing script`}
                                className="p-1 rounded-lg text-[#0D2B45]/55 hover:text-rose-600 dark:text-[#EBF4FA]/55 dark:hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="text-[11px] font-medium text-[#0E7C7B] dark:text-[#149A99] mt-0.5">
                            {dtl.Specialist || selectedDoctor.Specialty}
                            {dtl.Detailing_BN && dtl.Detailing_EN
                              ? ' · বাংলা · English'
                              : dtl.Detailing_BN
                              ? ' · বাংলা'
                              : dtl.Detailing_EN
                              ? ' · English'
                              : ''}
                          </div>
                          {dtl.Detailing_BN && (
                            <p className="text-xs text-[#0D2B45]/85 dark:text-[#EBF4FA]/85 mt-1.5 leading-relaxed line-clamp-2">
                              {dtl.Detailing_BN}
                            </p>
                          )}
                          {dtl.Detailing_EN && (
                            <p className="text-xs text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 mt-1 leading-relaxed line-clamp-2">
                              {dtl.Detailing_EN}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
