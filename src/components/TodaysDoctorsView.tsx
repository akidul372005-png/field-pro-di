import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Search,
  Stethoscope,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  filterDoctorsAvailableToday,
  getDoctorSchedule,
  getDoctorType,
  getTodayWeekdayInfo,
} from '../services/api';

export const TodaysDoctorsView: React.FC = () => {
  const {
    dataset,
    teamSession,
    effectiveTeamId,
    activeTerritoryName,
    areaMap,
    hospitalMap,
    departmentMap,
    navigateHome,
    openTeamSection,
    startDetailingFlow,
  } = useApp();

  const [selectedSubArea, setSelectedSubArea] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const todayInfo = useMemo(() => getTodayWeekdayInfo(), []);

  // Strictly scope to the logged-in Team's private Doctors list
  const teamPrivateDoctors = useMemo(() => {
    if (!teamSession) return [];
    if (teamSession.loginMode === 'firebase') {
      return effectiveTeamId ? dataset.Doctors : [];
    }
    if (teamSession.areaId && teamSession.areaId !== 'ALL') {
      return dataset.Doctors.filter((d) => d.Area_ID === teamSession.areaId);
    }
    return dataset.Doctors;
  }, [dataset.Doctors, teamSession, effectiveTeamId]);

  const todaysDoctors = useMemo(
    () => filterDoctorsAvailableToday(teamPrivateDoctors, dataset.Chambers),
    [teamPrivateDoctors, dataset.Chambers]
  );

  // Build Sub-Area filter options with live counts from today's doctors
  const subAreaOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of todaysDoctors) {
      const sub = (
        doc.Sub_Area ||
        doc.areaName ||
        areaMap.get(doc.Area_ID)?.Area_Name ||
        ''
      ).trim();
      if (!sub) continue;
      counts.set(sub, (counts.get(sub) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [todaysDoctors, areaMap]);

  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return todaysDoctors.filter((doc) => {
      const subArea = (
        doc.Sub_Area ||
        doc.areaName ||
        areaMap.get(doc.Area_ID)?.Area_Name ||
        ''
      ).trim();

      if (selectedSubArea !== 'ALL' && subArea.toLowerCase() !== selectedSubArea.toLowerCase()) {
        return false;
      }

      if (!q) return true;
      const hospitalName = String(
        hospitalMap.get(doc.Primary_Hospital_ID)?.Hospital_Name ?? ''
      ).toLowerCase();
      const deptName = String(
        departmentMap.get(doc.Department_ID)?.Department_Name || doc.Specialty || ''
      ).toLowerCase();
      const schedule = getDoctorSchedule(doc, dataset.Chambers);

      return (
        String(doc.Doctor_Name ?? '').toLowerCase().includes(q) ||
        String(doc.Degree ?? '').toLowerCase().includes(q) ||
        deptName.includes(q) ||
        hospitalName.includes(q) ||
        subArea.toLowerCase().includes(q) ||
        schedule.hours.toLowerCase().includes(q) ||
        String(doc.Phone ?? '').toLowerCase().includes(q)
      );
    });
  }, [todaysDoctors, selectedSubArea, searchQuery, areaMap, hospitalMap, departmentMap, dataset.Chambers]);

  return (
    <div className="min-h-[100dvh] bg-[#F4F8FC] dark:bg-[#071522] flex flex-col">
      {/* Sticky Full-Screen Top Bar */}
      <header className="sticky top-0 z-30 bg-white dark:bg-[#0B1E30] border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 pt-safe">
        <div className="max-w-4xl mx-auto w-full min-h-[56px] px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={navigateHome}
            aria-label="Back to Home"
            className="min-h-[40px] -ml-1.5 px-2.5 rounded-xl text-[#0D2B45] dark:text-white hover:bg-[#EAF4FB] dark:hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-1 shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back</span>
          </button>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="font-display font-bold text-[15px] sm:text-base text-[#0D2B45] dark:text-white truncate leading-tight">
              আজকের ডাক্তার
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-[#0E7C7B] dark:text-[#22E3D0] truncate">
              {todayInfo.labelBn} · {todayInfo.fullEn}
              {activeTerritoryName ? ` · ${activeTerritoryName}` : ''}
            </p>
          </div>

          <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full bg-[#E6FBF3] dark:bg-[#0C2E2B] text-[#0E7C7B] dark:text-[#22E3D0] text-xs font-bold tabular-nums whitespace-nowrap">
            {todaysDoctors.length} জন
          </span>
        </div>

        {/* Sub-Area Filter Pills */}
        {subAreaOptions.length > 1 && (
          <div className="max-w-4xl mx-auto w-full px-3.5 sm:px-5 pb-2.5 pt-0.5">
            <div
              role="tablist"
              aria-label="Filter today's doctors by sub-area"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedSubArea === 'ALL'}
                onClick={() => setSelectedSubArea('ALL')}
                className={`shrink-0 min-h-[34px] px-3 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedSubArea === 'ALL'
                    ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] text-white'
                    : 'bg-[#EAF4FB] dark:bg-[#10283E] text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 hover:bg-[#dcecf7] dark:hover:bg-[#153552]'
                }`}
              >
                সব এরিয়া{' '}
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  ({todaysDoctors.length})
                </span>
              </button>

              {subAreaOptions.map((opt) => {
                const active = selectedSubArea === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedSubArea(opt.name)}
                    className={`shrink-0 min-h-[34px] px-3 rounded-full text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0E7C7B] text-white'
                        : 'bg-[#EAF4FB] dark:bg-[#10283E] text-[#0D2B45]/80 dark:text-[#EBF4FA]/80 hover:bg-[#dcecf7] dark:hover:bg-[#153552]'
                    }`}
                  >
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{opt.name}</span>
                    <span className="font-mono tabular-nums text-[11px] opacity-85">
                      ({opt.count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main List Body */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-3.5 sm:px-5 py-3.5 pb-10 pb-safe space-y-3">
        {/* Compact Search Box */}
        {todaysDoctors.length > 0 && (
          <div className="relative">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ডাক্তার, স্পেশালিটি বা হাসপাতাল খুঁজুন..."
              aria-label="Search today's doctors"
              className="w-full min-h-[42px] pl-9 pr-9 rounded-xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/45 focus:outline-none focus:border-[#0E7C7B]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#0D2B45]/50 hover:text-[#0D2B45] dark:text-[#EBF4FA]/50 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Empty States or Doctor Cards */}
        {todaysDoctors.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#E6FBF3] dark:bg-[#0C2E2B] text-[#0E7C7B] dark:text-[#22E3D0] flex items-center justify-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h2 className="font-display font-bold text-base text-[#0D2B45] dark:text-white">
              আজ ({todayInfo.labelBn}) কোনো ডাক্তারের শিডিউল পাওয়া যায়নি
            </h2>
            <p className="text-xs sm:text-sm text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 max-w-sm mx-auto leading-relaxed">
              Team → Doctors-এ ডাক্তারদের Visiting Days (যেমন Daily, Sat-Thu বা {todayInfo.code}) সেট করা থাকলে তারা এখানে স্বয়ংক্রিয়ভাবে দেখাবে।
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => openTeamSection('doctors')}
                className="min-h-[42px] px-4 rounded-xl bg-[#0D2B45] dark:bg-[#0E7C7B] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Stethoscope className="w-4 h-4" />
                <span>Manage Team Doctors</span>
              </button>
            </div>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-8 text-center space-y-2">
            <p className="font-display font-bold text-sm text-[#0D2B45] dark:text-white">
              কোনো ডাক্তার পাওয়া যায়নি
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedSubArea('ALL');
                setSearchQuery('');
              }}
              className="min-h-[38px] px-4 rounded-xl bg-[#0E7C7B] text-white text-xs font-semibold cursor-pointer"
            >
              সব ডাক্তার দেখুন ({todaysDoctors.length})
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDoctors.map((doc, idx) => {
              const hospital = hospitalMap.get(doc.Primary_Hospital_ID);
              const area = areaMap.get(doc.Area_ID);
              const deptName =
                departmentMap.get(doc.Department_ID)?.Department_Name || doc.Specialty;
              const subAreaText = (doc.Sub_Area || doc.areaName || area?.Area_Name || '').trim();
              const hospitalText = (hospital?.Hospital_Name || doc.Primary_Hospital_ID || '').trim();
              const docType = getDoctorType(doc);
              const schedule = getDoctorSchedule(doc, dataset.Chambers);

              return (
                <article
                  key={`today-${doc.Doctor_ID}-${idx}`}
                  className="rounded-2xl bg-white dark:bg-[#0D2235] border border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 p-3.5 sm:p-4 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-2">
                    {/* Name + Regular/Guest Pill */}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h2 className="font-display font-bold text-[15px] text-[#0D2B45] dark:text-white truncate">
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

                    {/* Hospital · Sub-Area */}
                    {(hospitalText || subAreaText) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/75">
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

                    {/* Highlighted Visiting Time Banner */}
                    <div className="rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/8 dark:border-[#EBF4FA]/10 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#0D2B45] dark:text-white min-w-0">
                        <Clock className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                        <span className="truncate">
                          {schedule.hours || 'Time not set'}
                        </span>
                      </span>
                      {schedule.days && (
                        <span className="text-[11px] font-medium text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 whitespace-nowrap shrink-0">
                          {schedule.days}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer: Phone + Specialty-Scoped Detailing Button */}
                  <div className="pt-2 border-t border-[#0D2B45]/8 dark:border-[#EBF4FA]/8 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate">
                      {doc.Phone ? (
                        <a
                          href={`tel:${doc.Phone}`}
                          className="inline-flex items-center gap-1 font-mono text-xs text-[#0D2B45]/75 dark:text-[#EBF4FA]/80 hover:text-[#0E7C7B] hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#22E3D0] shrink-0" />
                          <span className="truncate">{doc.Phone}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#0D2B45]/45 dark:text-[#EBF4FA]/45">
                          No phone added
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        startDetailingFlow({
                          doctorId: doc.Doctor_ID,
                          doctorName: doc.Doctor_Name,
                          departmentId: doc.Department_ID,
                          specialist: deptName || doc.Specialty,
                          scopeToDoctorSpecialty: true,
                          returnTab: 'todays-doctors',
                          subTab: 'detailing',
                        })
                      }
                      className="min-h-[36px] px-3 rounded-xl bg-[#0E7C7B] hover:bg-[#095C5B] text-white font-semibold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors active:scale-[0.97] cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span>Detailing</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
