import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, ChevronDown, Clock, Pencil, Plus, Save, Search, Send, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  BANGLADESH_MEDICAL_DEGREES,
  Doctor,
  DoctorType,
  MEDICAL_SPECIALTIES,
  PRODUCT_GROUP_OPTIONS,
  Product,
  SheetName,
  VISITING_DAYS_LIST,
} from '../types';
import {
  addDaysToDate,
  buildGenericGroups,
  calculateBoxPrice,
  formatBDT,
  formatDoctorRemarks,
  formatProductGroupValue,
  formatTime24To12,
  formatVisitingDays,
  generateRecordId,
  getCurrentTimeHHMM,
  getDoctorSchedule,
  getDoctorType,
  getTodayISO,
  matchSpecialistName,
  normalizeGenericKey,
  normalizeProductGroup,
  parsePackUnits,
  parseProductIds,
  parseTimeRangeTo24,
  parseVisitingDaysToSelection,
} from '../services/api';

interface QuickAddModalProps {
  sheet: SheetName | null;
  mode?: 'add' | 'edit';
  initialRecord?: Record<string, unknown>;
  onClose: () => void;
}

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'tel'
  | 'email'
  | 'select'
  | 'ref'
  | 'products-multi'
  | 'product-ids-multi'
  | 'doctor-degree'
  | 'doctor-specialist'
  | 'doctor-type'
  | 'visiting-days'
  | 'visiting-time'
  | 'sub-area';

interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  refSheet?: 'Areas' | 'Departments' | 'Hospitals' | 'Doctors' | 'Products' | 'MPO_Users';
  fullWidth?: boolean;
}

const SHEET_META: Record<
  SheetName,
  {
    addTitle: string;
    editTitle: string;
    subtitle: string;
    idField: string;
    idPrefix: string;
    fields: FieldSpec[];
  }
> = {
  Hospitals: {
    addTitle: 'Add Hospital',
    editTitle: 'Edit Hospital',
    subtitle: 'Manage hospital record in the Hospitals sheet',
    idField: 'Hospital_ID',
    idPrefix: 'HSP',
    fields: [
      { name: 'Hospital_ID', label: 'Hospital_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Hospital_Name',
        label: 'Hospital_Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Dhaka Medical College Hospital',
        fullWidth: true,
      },
      {
        name: 'Sub_Area',
        label: 'Sub-Area / Market',
        type: 'sub-area',
        required: true,
        fullWidth: true,
      },
      {
        name: 'Hospital_Type',
        label: 'Hospital_Type',
        type: 'select',
        options: [
          'Government Medical College',
          'University Hospital',
          'Private Tertiary',
          'Specialized Hospital',
          'Diagnostic Center',
          'Clinic',
        ],
      },
      {
        name: 'Address',
        label: 'Address',
        type: 'text',
        placeholder: 'Street, Thana, District',
        fullWidth: true,
      },
      { name: 'Phone', label: 'Phone', type: 'tel', placeholder: '+880 ...' },
    ],
  },
  Doctors: {
    addTitle: 'Add Doctor',
    editTitle: 'Edit Doctor',
    subtitle: 'Manage physician profile, chamber hospital, and visiting schedule',
    idField: 'Doctor_ID',
    idPrefix: 'DOC',
    fields: [
      { name: 'Doctor_ID', label: 'Doctor_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Doctor_Name',
        label: 'Doctor Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Prof. Dr. Mahmudul Hasan',
        fullWidth: true,
      },
      {
        name: 'Degree',
        label: 'Degree',
        type: 'doctor-degree',
        required: true,
        fullWidth: true,
      },
      {
        name: 'Department_ID',
        label: 'Specialist',
        type: 'doctor-specialist',
        refSheet: 'Departments',
        required: true,
      },
      {
        name: 'Primary_Hospital_ID',
        label: 'Hospital / Chamber',
        type: 'ref',
        refSheet: 'Hospitals',
        required: true,
      },
      {
        name: 'Sub_Area',
        label: 'Sub-Area / Market',
        type: 'sub-area',
        required: true,
      },
      { name: 'Phone', label: 'Phone', type: 'tel', placeholder: '+880 1XXX-XXXXXX' },
      {
        name: 'Doctor_Type',
        label: 'Doctor Type (নিয়মিত / গেস্ট)',
        type: 'doctor-type',
        required: true,
        fullWidth: true,
      },
      {
        name: 'Visiting_Days',
        label: 'Visiting Days (দিন)',
        type: 'visiting-days',
        fullWidth: true,
      },
      {
        name: 'Visiting_Hours',
        label: 'Visiting Time (সময়)',
        type: 'visiting-time',
        fullWidth: true,
      },
      { name: 'Email', label: 'Email', type: 'email', placeholder: 'doctor@hospital.org', fullWidth: true },
    ],
  },
  Chambers: {
    addTitle: 'Add Chamber',
    editTitle: 'Edit Chamber',
    subtitle: 'Manage consultation chamber in the Chambers sheet',
    idField: 'Chamber_ID',
    idPrefix: 'CHM',
    fields: [
      { name: 'Chamber_ID', label: 'Chamber_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Doctor_ID',
        label: 'Doctor_ID',
        type: 'ref',
        refSheet: 'Doctors',
        required: true,
        fullWidth: true,
      },
      {
        name: 'Chamber_Name',
        label: 'Chamber_Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Popular Diagnostic Centre, Dhanmondi',
        fullWidth: true,
      },
      { name: 'Area_ID', label: 'Area_ID', type: 'ref', refSheet: 'Areas', required: true },
      {
        name: 'Assistant_Phone',
        label: 'Assistant_Phone',
        type: 'tel',
        placeholder: '+880 1XXX-XXXXXX',
      },
      {
        name: 'Address',
        label: 'Address',
        type: 'text',
        placeholder: 'House, Road, Area',
        fullWidth: true,
      },
      { name: 'Visiting_Days', label: 'Visiting_Days', type: 'text', placeholder: 'e.g., Sat, Mon, Wed' },
      {
        name: 'Visiting_Hours',
        label: 'Visiting_Hours',
        type: 'text',
        placeholder: 'e.g., 5:00 PM – 9:00 PM',
      },
    ],
  },
  Departments: {
    addTitle: 'Add Specialist',
    editTitle: 'Edit Specialist',
    subtitle: 'Manage medical specialist category in the Departments sheet',
    idField: 'Department_ID',
    idPrefix: 'DEPT',
    fields: [
      { name: 'Department_ID', label: 'Department_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Department_Name',
        label: 'Specialist Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Medicine / Internal Medicine, Cardiology, Pediatrics',
        fullWidth: true,
      },
      {
        name: 'Preferred_Generics',
        label: 'Preferred Generics (comma-separated)',
        type: 'textarea',
        placeholder: 'e.g., Esomeprazole, Cefixime, Azithromycin, Paracetamol',
        fullWidth: true,
      },
      {
        name: 'Clinical_Indications',
        label: 'Clinical Indications (comma-separated)',
        type: 'textarea',
        placeholder: 'e.g., Essential Hypertension, GERD, Community-Acquired Pneumonia',
        fullWidth: true,
      },
    ],
  },
  Indications: {
    addTitle: 'Add Indication',
    editTitle: 'Edit Indication',
    subtitle: 'Manage clinical indication entry in the Indications sheet',
    idField: 'Indication_ID',
    idPrefix: 'IND',
    fields: [
      { name: 'Indication_ID', label: 'Indication_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Indication_Name',
        label: 'Indication Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Essential Hypertension, GERD, Type 2 Diabetes Mellitus',
        fullWidth: true,
      },
      {
        name: 'Category',
        label: 'Category',
        type: 'text',
        required: true,
        placeholder: 'e.g., Cardiology, Gastroenterology, Infectious Disease',
        fullWidth: true,
      },
      {
        name: 'Relevant_Specialists',
        label: 'Relevant Specialists (comma-separated)',
        type: 'textarea',
        placeholder: 'e.g., Cardiology, Internal Medicine, Nephrology',
        fullWidth: true,
      },
      {
        name: 'Key_Generics',
        label: 'Key Generics (comma-separated)',
        type: 'textarea',
        placeholder: 'e.g., Amlodipine, Losartan, Bisoprolol',
        fullWidth: true,
      },
      {
        name: 'Video_URL',
        label: 'Video_URL (YouTube Link)',
        type: 'text',
        placeholder: 'https://youtu.be/... or https://www.youtube.com/watch?v=...',
        fullWidth: true,
      },
    ],
  },
  Products: {
    addTitle: 'Add Product',
    editTitle: 'Edit Product',
    subtitle: 'Manage Drug International Limited product catalog and pricing in Products',
    idField: 'Product_ID',
    idPrefix: 'PRD',
    fields: [
      { name: 'Product_ID', label: 'Product_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Product_Group',
        label: 'Product_Group',
        type: 'select',
        options: [...PRODUCT_GROUP_OPTIONS],
      },
      {
        name: 'Brand_Name',
        label: 'Brand_Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Amlocard 5',
      },
      {
        name: 'Generic_Name',
        label: 'Generic_Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Amlodipine Besylate',
      },
      { name: 'Strength', label: 'Strength', type: 'text', required: true, placeholder: 'e.g., 5 mg' },
      {
        name: 'Dosage_Form',
        label: 'Dosage_Form',
        type: 'select',
        options: [
          'Tablet',
          'Enteric-Coated Tablet',
          'Film-Coated Tablet',
          'Capsule',
          'Syrup',
          'Suspension',
          'Injection',
          'Inhaler',
          'Cream / Ointment',
          'Drops',
        ],
      },
      {
        name: 'Therapeutic_Class',
        label: 'Therapeutic_Class',
        type: 'text',
        required: true,
        placeholder: 'e.g., Cardiovascular',
      },
      {
        name: 'Pack_Size',
        label: 'Pack_Size',
        type: 'text',
        placeholder: 'e.g., 3x10s, 7s, 10s, 60ml, 1s',
      },
      {
        name: 'Single_Price',
        label: 'Single_Price (Unit Price in BDT)',
        type: 'number',
        placeholder: 'e.g., 5.00',
      },
      {
        name: 'Box_Price',
        label: 'Box_Price (Auto-calculated BDT)',
        type: 'number',
        placeholder: 'Auto-calculated (editable)',
      },
      {
        name: 'Approved_Indications',
        label: 'Approved_Indications',
        type: 'textarea',
        placeholder: 'Approved clinical indications and therapeutic uses...',
        fullWidth: true,
      },
      {
        name: 'Video_URL',
        label: 'Video_URL (YouTube Link)',
        type: 'text',
        placeholder: 'https://youtu.be/... or https://www.youtube.com/watch?v=...',
        fullWidth: true,
      },
    ],
  },
  Doctor_Product_Detailing: {
    addTitle: 'Add Detailing Script',
    editTitle: 'Edit Detailing Script',
    subtitle: 'Link one or multiple strengths/dosage forms to a specialist bilingual detailing script',
    idField: 'Detailing_ID',
    idPrefix: 'DTL',
    fields: [
      { name: 'Detailing_ID', label: 'Detailing_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Specialist',
        label: 'Specialist',
        type: 'select',
        required: true,
        options: [...MEDICAL_SPECIALTIES],
        fullWidth: true,
      },
      {
        name: 'Product_ID',
        label: 'Products / Strengths (Product_ID)',
        type: 'product-ids-multi',
        required: true,
        fullWidth: true,
      },
      {
        name: 'Detailing_BN',
        label: 'Detailing_BN (বাংলা শর্ট ডিটেইলিং)',
        type: 'textarea',
        placeholder: 'চিকিৎসকদের জন্য সংক্ষিপ্ত বাংলা ডিটেইলিং স্ক্রিপ্ট লিখুন...',
        fullWidth: true,
      },
      {
        name: 'Detailing_EN',
        label: 'Detailing_EN (English Short Detailing)',
        type: 'textarea',
        placeholder: 'Concise English detailing script for this specialty...',
        fullWidth: true,
      },
    ],
  },
  Doctor_Visits: {
    addTitle: 'Log Doctor Visit',
    editTitle: 'Edit Doctor Visit',
    subtitle: 'Manage field call record in Doctor_Visits',
    idField: 'Visit_ID',
    idPrefix: 'VST',
    fields: [
      { name: 'Visit_ID', label: 'Visit_ID', type: 'text', required: true },
      { name: 'MPO_ID', label: 'MPO_ID', type: 'ref', refSheet: 'MPO_Users', required: true },
      { name: 'Doctor_ID', label: 'Doctor_ID', type: 'ref', refSheet: 'Doctors', required: true },
      {
        name: 'Primary_Hospital_ID',
        label: 'Primary_Hospital_ID',
        type: 'ref',
        refSheet: 'Hospitals',
        required: true,
      },
      { name: 'Visit_Date', label: 'Visit_Date', type: 'date', required: true },
      { name: 'Visit_Time', label: 'Visit_Time', type: 'time', required: true },
      {
        name: 'Visit_Type',
        label: 'Visit_Type',
        type: 'select',
        options: ['Chamber Call', 'Hospital Round', 'Follow-up Call', 'Clinical Meeting'],
      },
      { name: 'Next_Follow_Up', label: 'Next_Follow_Up', type: 'date' },
      {
        name: 'Products_Discussed',
        label: 'Products_Discussed',
        type: 'products-multi',
        required: true,
        fullWidth: true,
      },
      {
        name: 'Discussion_Summary',
        label: 'Discussion_Summary',
        type: 'textarea',
        required: true,
        placeholder: 'Summary of clinical discussion and physician feedback...',
        fullWidth: true,
      },
    ],
  },
  Daily_Activities: {
    addTitle: 'Add Daily Activity',
    editTitle: 'Edit Daily Activity',
    subtitle: 'Manage field activity record in Daily_Activities',
    idField: 'Activity_ID',
    idPrefix: 'ACT',
    fields: [
      { name: 'Activity_ID', label: 'Activity_ID', type: 'text', required: true },
      {
        name: 'Status',
        label: 'Status',
        type: 'select',
        options: ['Completed', 'In Progress', 'Planned'],
      },
      { name: 'MPO_ID', label: 'MPO_ID', type: 'ref', refSheet: 'MPO_Users', required: true },
      { name: 'Area_ID', label: 'Area_ID', type: 'ref', refSheet: 'Areas', required: true },
      { name: 'Activity_Date', label: 'Activity_Date', type: 'date', required: true },
      { name: 'Activity_Time', label: 'Activity_Time', type: 'time', required: true },
      {
        name: 'Activity_Type',
        label: 'Activity_Type',
        type: 'select',
        options: [
          'Hospital Round',
          'Chamber Visit',
          'Pharmacy Check',
          'Clinical Meeting',
          'Stockist Follow-up',
          'Territory Survey',
        ],
      },
      { name: 'Doctors_Met', label: 'Doctors_Met', type: 'number', placeholder: '0' },
      {
        name: 'Location',
        label: 'Location',
        type: 'text',
        required: true,
        placeholder: 'Hospital ward, pharmacy cluster, or clinic',
        fullWidth: true,
      },
      {
        name: 'Summary',
        label: 'Summary',
        type: 'textarea',
        required: true,
        placeholder: 'Key work completed...',
        fullWidth: true,
      },
      {
        name: 'Outcome',
        label: 'Outcome',
        type: 'text',
        placeholder: 'Follow-ups or restock orders triggered',
        fullWidth: true,
      },
    ],
  },
  Areas: {
    addTitle: 'Add Area',
    editTitle: 'Edit Area',
    subtitle: 'Manage sales territory & MPO assignment in the Areas sheet',
    idField: 'Area_ID',
    idPrefix: 'AREA',
    fields: [
      { name: 'Area_ID', label: 'Area_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'Area_Name',
        label: 'Area_Name',
        type: 'text',
        required: true,
        placeholder: 'e.g., Uttara Sector 1–14',
        fullWidth: true,
      },
      {
        name: 'Territory',
        label: 'Territory',
        type: 'text',
        required: true,
        placeholder: 'e.g., Dhaka North',
      },
      { name: 'District', label: 'District', type: 'text', required: true, placeholder: 'e.g., Dhaka' },
      {
        name: 'Assigned_MPO_ID',
        label: 'Assigned_MPO_ID',
        type: 'ref',
        refSheet: 'MPO_Users',
        fullWidth: true,
      },
    ],
  },
  MPO_Users: {
    addTitle: 'Add MPO User',
    editTitle: 'Edit MPO User',
    subtitle: 'Manage Medical Promotion Officer & role access in the MPO_Users sheet',
    idField: 'MPO_ID',
    idPrefix: 'MPO',
    fields: [
      { name: 'MPO_ID', label: 'MPO_ID', type: 'text', required: true },
      { name: 'Status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      {
        name: 'MPO_Name',
        label: 'MPO_Name',
        type: 'text',
        required: true,
        placeholder: 'Full name of MPO',
        fullWidth: true,
      },
      {
        name: 'Role',
        label: 'Role',
        type: 'select',
        options: ['MPO', 'Area Manager', 'Admin'],
      },
      { name: 'Employee_ID', label: 'Employee_ID', type: 'text', placeholder: 'e.g., DIL-2910' },
      { name: 'Area_ID', label: 'Area_ID', type: 'ref', refSheet: 'Areas' },
      { name: 'Territory', label: 'Territory', type: 'text', placeholder: 'e.g., Dhaka Central' },
      { name: 'Area', label: 'Area', type: 'text', placeholder: 'e.g., Dhanmondi & Shahbagh' },
      { name: 'Phone_Number', label: 'Phone_Number', type: 'tel', placeholder: '+880 1XXX-XXXXXX' },
      { name: 'Email', label: 'Email', type: 'email', placeholder: 'name@druginternational.com' },
      {
        name: 'Monthly_Visit_Target',
        label: 'Monthly_Visit_Target',
        type: 'number',
        placeholder: '50',
      },
    ],
  },
};

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  sheet,
  mode = 'add',
  initialRecord,
  onClose,
}) => {
  const {
    dataset,
    teamSession,
    effectiveTeamId,
    teamSubAreas,
    saveSubArea,
    activeMpoId,
    activeMpo,
    doctorMap,
    hospitalMap,
    departmentMap,
    areaMap,
    submitRecord,
    pushToast,
  } = useApp();

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productPickerSearch, setProductPickerSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline "+ Add Area" state for Doctors / Hospitals required Sub-Area dropdown
  const [showInlineSubArea, setShowInlineSubArea] = useState(false);
  const [inlineSubAreaName, setInlineSubAreaName] = useState('');
  const [savingInlineSubArea, setSavingInlineSubArea] = useState(false);

  // Specialized Doctor form state
  const [degreeText, setDegreeText] = useState<string>('');
  const [degreeMenuOpen, setDegreeMenuOpen] = useState<boolean>(false);
  const [specialistSearch, setSpecialistSearch] = useState<string>('');
  const [specialistMenuOpen, setSpecialistMenuOpen] = useState<boolean>(false);
  const [doctorType, setDoctorType] = useState<DoctorType>('Regular');
  const [visitingDaysSelected, setVisitingDaysSelected] = useState<string[]>([]);
  const [visitingIsDaily, setVisitingIsDaily] = useState<boolean>(false);
  const [visitingStartTime, setVisitingStartTime] = useState<string>('');
  const [visitingEndTime, setVisitingEndTime] = useState<string>('');
  const [visitingTimeText, setVisitingTimeText] = useState<string>('');

  const degreeComboRef = useRef<HTMLDivElement | null>(null);
  const specialistComboRef = useRef<HTMLDivElement | null>(null);

  const spec = sheet ? SHEET_META[sheet] : null;
  const isEdit = mode === 'edit' && Boolean(initialRecord);

  useEffect(() => {
    if (!sheet || !spec) return;
    const today = getTodayISO();
    const nowTime = getCurrentTimeHHMM();
    const defaults: Record<string, string> = {};

    spec.fields.forEach((field) => {
      if (initialRecord) {
        let existingVal = initialRecord[field.name];
        if (
          (existingVal === undefined || existingVal === null || String(existingVal) === '') &&
          sheet === 'Products'
        ) {
          if (field.name === 'Brand_Name') existingVal = initialRecord.Product_Name;
          if (field.name === 'Box_Price') existingVal = initialRecord.MRP_BDT;
          if (field.name === 'Approved_Indications') existingVal = initialRecord.Key_Message;
        }
        if (
          (existingVal === undefined || existingVal === null || String(existingVal) === '') &&
          sheet === 'MPO_Users'
        ) {
          if (field.name === 'Employee_ID') existingVal = initialRecord.Employee_Code;
          if (field.name === 'Phone_Number') existingVal = initialRecord.Phone;
        }
        if (
          (existingVal === undefined || existingVal === null || String(existingVal) === '') &&
          sheet === 'Areas'
        ) {
          if (field.name === 'Territory') existingVal = initialRecord.Zone;
        }
        if (
          sheet === 'Doctors' &&
          field.name === 'Department_ID' &&
          (!existingVal || !dataset.Departments.some((d) => d.Department_ID === String(existingVal)))
        ) {
          const specText = String(initialRecord.Specialty ?? existingVal ?? '').trim();
          const matchedDept = dataset.Departments.find(
            (d) =>
              d.Department_ID.toLowerCase() === specText.toLowerCase() ||
              matchSpecialistName(d.Department_Name, specText)
          );
          if (matchedDept) {
            existingVal = matchedDept.Department_ID;
          }
        }
        if (
          (existingVal === undefined || existingVal === null || String(existingVal) === '') &&
          field.name === 'Sub_Area'
        ) {
          existingVal = initialRecord.areaName;
        }
        if (existingVal !== undefined && existingVal !== null && String(existingVal) !== '') {
          // Canonicalize Specialist name if matching one of MEDICAL_SPECIALTIES
          if (sheet === 'Doctor_Product_Detailing' && field.name === 'Specialist') {
            const matchedSpec =
              MEDICAL_SPECIALTIES.find((s) => matchSpecialistName(s, String(existingVal))) ||
              String(existingVal);
            defaults[field.name] = matchedSpec;
            return;
          }
          if (sheet === 'Products' && field.name === 'Product_Group') {
            const code = normalizeProductGroup(existingVal);
            defaults[field.name] = code ? formatProductGroupValue(code) : 'None';
            return;
          }
          defaults[field.name] =
            field.type === 'date'
              ? String(existingVal).slice(0, 10)
              : String(existingVal);
          return;
        }
      }

      if (field.name === spec.idField) {
        defaults[field.name] = generateRecordId(spec.idPrefix);
      } else if (field.name === 'Status') {
        defaults[field.name] = sheet === 'Daily_Activities' ? 'Completed' : 'Active';
      } else if (field.name === 'MPO_ID') {
        defaults[field.name] = activeMpoId || dataset.MPO_Users[0]?.MPO_ID || '';
      } else if (field.name === 'Area_ID' && field.type === 'ref') {
        defaults[field.name] =
          effectiveTeamId || teamSession?.areaId || activeMpo?.Area_ID || dataset.Areas[0]?.Area_ID || '';
      } else if (field.name === 'Sub_Area') {
        defaults[field.name] = teamSubAreas[0]?.Area_Name || '';
      } else if (field.type === 'date') {
        defaults[field.name] =
          field.name === 'Next_Follow_Up' ? addDaysToDate(today, 7) : today;
      } else if (field.type === 'time') {
        defaults[field.name] = nowTime;
      } else if (field.type === 'select' && field.options && field.options.length > 0) {
        defaults[field.name] = field.options[0];
      } else if (field.name === 'Monthly_Visit_Target') {
        defaults[field.name] = '50';
      } else if (field.name === 'Samples_Given' || field.name === 'Doctors_Met') {
        defaults[field.name] = '0';
      } else {
        defaults[field.name] = '';
      }
    });

    setFormValues(defaults);
    setProductPickerSearch('');
    setShowInlineSubArea(false);
    setInlineSubAreaName('');

    // Initialize Doctors specialized controls
    if (sheet === 'Doctors') {
      const existingDegree = String(initialRecord?.Degree ?? '').trim();
      setDegreeText(existingDegree);
      setDegreeMenuOpen(false);

      const resolvedDeptId = defaults.Department_ID || '';
      const matchedDept = dataset.Departments.find((d) => d.Department_ID === resolvedDeptId);
      setSpecialistSearch(
        matchedDept?.Department_Name || String(initialRecord?.Specialty ?? '').trim()
      );
      setSpecialistMenuOpen(false);

      setDoctorType(initialRecord ? getDoctorType(initialRecord) : 'Regular');

      if (initialRecord && isEdit) {
        const schedule = getDoctorSchedule(
          initialRecord as unknown as Doctor,
          dataset.Chambers
        );
        const parsedDays = parseVisitingDaysToSelection(schedule.days);
        setVisitingDaysSelected(parsedDays.selectedDays);
        setVisitingIsDaily(parsedDays.isDaily);

        const hoursText = schedule.hours || '';
        setVisitingTimeText(hoursText);
        const parsedTime = parseTimeRangeTo24(hoursText);
        setVisitingStartTime(parsedTime.start);
        setVisitingEndTime(parsedTime.end);
      } else {
        setVisitingDaysSelected([]);
        setVisitingIsDaily(false);
        setVisitingStartTime('16:00');
        setVisitingEndTime('20:00');
        setVisitingTimeText('4:00 PM - 8:00 PM');
      }
    }

    if (initialRecord && sheet === 'Doctor_Visits') {
      const rawProducts = String(initialRecord.Products_Discussed ?? '');
      const parsed = rawProducts
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedProducts(parsed);
    } else {
      setSelectedProducts([]);
    }

    if (sheet === 'Doctor_Product_Detailing') {
      const prefilledIds = initialRecord?.Product_ID
        ? parseProductIds(String(initialRecord.Product_ID))
        : [];
      const allKnownIdsLower = new Set(
        dataset.Products.map((p) => String(p.Product_ID ?? '').trim().toLowerCase())
      );

      // If prefilled via Generic_Name or legacy shorthand (e.g. LZ4, LZS, Linezolid),
      // auto-select all Product_IDs belonging to the matched Generic group(s)
      const hasUnrecognizedToken = prefilledIds.some(
        (id) => !allKnownIdsLower.has(id.toLowerCase())
      );
      const explicitGeneric = String(initialRecord?.Generic_Name ?? '').trim();

      if (explicitGeneric && prefilledIds.length === 0) {
        const gKey = normalizeGenericKey(explicitGeneric);
        const matchingIds = dataset.Products.filter(
          (p) => normalizeGenericKey(p.Generic_Name || p.Brand_Name || p.Product_Name) === gKey
        ).map((p) => p.Product_ID);
        setSelectedProductIds(matchingIds.length > 0 ? matchingIds : [explicitGeneric]);
      } else if (hasUnrecognizedToken && initialRecord) {
        const groups = buildGenericGroups(dataset.Products, [
          {
            Detailing_ID: String(initialRecord.Detailing_ID ?? 'TEMP'),
            Product_ID: String(initialRecord.Product_ID ?? ''),
            Generic_Name: explicitGeneric || undefined,
            Specialist: String(initialRecord.Specialist ?? 'Internal Medicine'),
            Detailing_BN: String(initialRecord.Detailing_BN ?? ''),
            Detailing_EN: String(initialRecord.Detailing_EN ?? ''),
          },
        ]);
        const matchedGroup = groups.find((g) => g.scripts.length > 0 && g.productIds.length > 0);
        setSelectedProductIds(matchedGroup ? matchedGroup.productIds : prefilledIds);
      } else {
        setSelectedProductIds(prefilledIds);
      }
    } else {
      setSelectedProductIds([]);
    }
  }, [
    sheet,
    spec,
    isEdit,
    initialRecord,
    activeMpoId,
    activeMpo,
    dataset.MPO_Users,
    dataset.Areas,
    dataset.Products,
    dataset.Departments,
    dataset.Chambers,
  ]);

  useEffect(() => {
    if (!sheet) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (degreeMenuOpen || specialistMenuOpen) {
          setDegreeMenuOpen(false);
          setSpecialistMenuOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheet, onClose, degreeMenuOpen, specialistMenuOpen]);

  useEffect(() => {
    if (!degreeMenuOpen && !specialistMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        degreeMenuOpen &&
        degreeComboRef.current &&
        !degreeComboRef.current.contains(target)
      ) {
        setDegreeMenuOpen(false);
      }
      if (
        specialistMenuOpen &&
        specialistComboRef.current &&
        !specialistComboRef.current.contains(target)
      ) {
        setSpecialistMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [degreeMenuOpen, specialistMenuOpen]);

  const refOptions = useMemo(() => {
    return {
      Areas: dataset.Areas.map((a) => ({
        value: a.Area_ID,
        label: `${a.Area_Name} (${a.Area_ID})`,
      })),
      Departments: dataset.Departments.map((d) => ({
        value: d.Department_ID,
        label: d.Department_Name || d.Department_ID,
      })),
      Hospitals: dataset.Hospitals.map((h) => ({
        value: h.Hospital_ID,
        label: `${h.Hospital_Name} (${h.Hospital_ID})`,
      })),
      Doctors: dataset.Doctors.map((d) => ({
        value: d.Doctor_ID,
        label: `${d.Doctor_Name} · ${d.Specialty}`,
      })),
      Products: dataset.Products.map((p) => ({
        value: p.Product_ID,
        label: `${p.Product_Name} — ${p.Generic_Name}`,
      })),
      MPO_Users: dataset.MPO_Users.map((m) => ({
        value: m.MPO_ID,
        label: `${m.MPO_Name}${m.Role ? ` (${m.Role})` : ''}`,
      })),
    };
  }, [dataset]);

  // Group products by Generic_Name (or Brand family) for multi-strength detailing selection
  const groupedProductsForPicker = useMemo(() => {
    const q = productPickerSearch.trim().toLowerCase();
    const filtered = dataset.Products.filter((p) => {
      if (!q) return true;
      return (
        String(p.Brand_Name || p.Product_Name || '').toLowerCase().includes(q) ||
        String(p.Generic_Name || '').toLowerCase().includes(q) ||
        String(p.Strength || '').toLowerCase().includes(q) ||
        String(p.Dosage_Form || '').toLowerCase().includes(q) ||
        String(p.Product_ID || '').toLowerCase().includes(q)
      );
    });

    const groups = new Map<string, Product[]>();
    filtered.forEach((p) => {
      const groupKey =
        String(p.Generic_Name ?? '').trim() ||
        String(p.Brand_Name || p.Product_Name || 'Other Products')
          .split(/\s+/)[0]
          .trim() ||
        'Other Products';
      const existing = groups.get(groupKey) || [];
      existing.push(p);
      groups.set(groupKey, existing);
    });

    // Prioritize groups that already contain a selected product
    const selectedSet = new Set(selectedProductIds.map((id) => id.toLowerCase()));
    return Array.from(groups.entries()).sort(([nameA, itemsA], [nameB, itemsB]) => {
      const aHasSel = itemsA.some((p) => selectedSet.has(p.Product_ID.toLowerCase()));
      const bHasSel = itemsB.some((p) => selectedSet.has(p.Product_ID.toLowerCase()));
      if (aHasSel !== bHasSel) return aHasSel ? -1 : 1;
      return nameA.localeCompare(nameB);
    });
  }, [dataset.Products, productPickerSearch, selectedProductIds]);

  const productById = useMemo(
    () => new Map(dataset.Products.map((p) => [p.Product_ID, p])),
    [dataset.Products]
  );

  // Searchable Degree options (Bangladesh presets + any previously entered degrees in Doctors)
  const allDegreeOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    BANGLADESH_MEDICAL_DEGREES.forEach((deg) => {
      seen.add(deg.toLowerCase());
      list.push(deg);
    });
    dataset.Doctors.forEach((doc) => {
      const deg = String(doc.Degree ?? '').trim();
      if (deg && !seen.has(deg.toLowerCase())) {
        seen.add(deg.toLowerCase());
        list.push(deg);
      }
    });
    return list;
  }, [dataset.Doctors]);

  const filteredDegreeOptions = useMemo(() => {
    const q = degreeText.trim().toLowerCase();
    if (!q) return allDegreeOptions;
    return allDegreeOptions.filter((deg) => deg.toLowerCase().includes(q));
  }, [allDegreeOptions, degreeText]);

  const hasExactDegreeMatch = useMemo(() => {
    const q = degreeText.trim().toLowerCase();
    if (!q) return true;
    return allDegreeOptions.some((deg) => deg.toLowerCase() === q);
  }, [allDegreeOptions, degreeText]);

  // Searchable Specialist options from Departments sheet
  const filteredSpecialistOptions = useMemo(() => {
    const q = specialistSearch.trim().toLowerCase();
    if (!q) return dataset.Departments;
    return dataset.Departments.filter((dept) => {
      const name = String(dept.Department_Name ?? '').toLowerCase();
      const id = String(dept.Department_ID ?? '').toLowerCase();
      return (
        name.includes(q) ||
        id.includes(q) ||
        matchSpecialistName(dept.Department_Name, q)
      );
    });
  }, [dataset.Departments, specialistSearch]);

  if (!sheet || !spec) return null;

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormValues((prev) => {
      const next = { ...prev, [fieldName]: value };

      // Auto-calculate Box_Price whenever Pack_Size or Single_Price changes on Products
      if (sheet === 'Products' && (fieldName === 'Pack_Size' || fieldName === 'Single_Price')) {
        const nextSingle = fieldName === 'Single_Price' ? value : prev.Single_Price;
        const nextPack = fieldName === 'Pack_Size' ? value : prev.Pack_Size;
        const computed = calculateBoxPrice(nextSingle, nextPack);
        if (computed !== '') {
          next.Box_Price = computed;
        } else if (fieldName === 'Single_Price' && value.trim() === '') {
          next.Box_Price = '';
        }
      }

      if (sheet === 'Doctor_Visits' && fieldName === 'Doctor_ID') {
        const doc = doctorMap.get(value);
        if (doc?.Primary_Hospital_ID) {
          next.Primary_Hospital_ID = doc.Primary_Hospital_ID;
        }
      }
      if (sheet === 'Doctors' && fieldName === 'Primary_Hospital_ID') {
        const hosp = hospitalMap.get(value);
        if (hosp?.Area_ID && (!prev.Area_ID || !isEdit)) {
          next.Area_ID = hosp.Area_ID;
        }
        const hospSubArea = hosp?.Sub_Area || hosp?.areaName;
        if (hospSubArea && !prev.Sub_Area) {
          next.Sub_Area = hospSubArea;
        }
      }
      if (sheet === 'Chambers' && fieldName === 'Doctor_ID') {
        const doc = doctorMap.get(value);
        if (doc?.Area_ID && !prev.Area_ID) {
          next.Area_ID = doc.Area_ID;
        }
      }
      if (sheet === 'MPO_Users' && fieldName === 'Area_ID') {
        const area = areaMap.get(value);
        if (area) {
          next.Area = area.Area_Name;
          if (!prev.Territory) {
            next.Territory = area.Territory || area.Zone || area.District;
          }
        }
      }

      return next;
    });
  };

  const toggleProduct = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((item) => item !== productName)
        : [...prev, productName]
    );
  };

  const toggleProductId = (productId: string) => {
    setSelectedProductIds((prev) =>
      prev.some((id) => id.toLowerCase() === productId.toLowerCase())
        ? prev.filter((id) => id.toLowerCase() !== productId.toLowerCase())
        : [...prev, productId]
    );
  };

  const toggleProductGroup = (groupProducts: Product[]) => {
    const groupIds = groupProducts.map((p) => p.Product_ID);
    const allSelected = groupIds.every((gid) =>
      selectedProductIds.some((id) => id.toLowerCase() === gid.toLowerCase())
    );
    if (allSelected) {
      const lowerSet = new Set(groupIds.map((g) => g.toLowerCase()));
      setSelectedProductIds((prev) => prev.filter((id) => !lowerSet.has(id.toLowerCase())));
    } else {
      setSelectedProductIds((prev) => {
        const next = [...prev];
        groupIds.forEach((gid) => {
          if (!next.some((id) => id.toLowerCase() === gid.toLowerCase())) {
            next.push(gid);
          }
        });
        return next;
      });
    }
  };

  const toggleVisitingDay = (day: string) => {
    setVisitingIsDaily(false);
    setVisitingDaysSelected((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      if (next.length === VISITING_DAYS_LIST.length) {
        setVisitingIsDaily(true);
      }
      return next;
    });
  };

  const toggleVisitingDaily = () => {
    if (visitingIsDaily) {
      setVisitingIsDaily(false);
      setVisitingDaysSelected([]);
    } else {
      setVisitingIsDaily(true);
      setVisitingDaysSelected([...VISITING_DAYS_LIST]);
    }
  };

  const updateVisitingStartEnd = (nextStart: string, nextEnd: string) => {
    setVisitingStartTime(nextStart);
    setVisitingEndTime(nextEnd);
    if (nextStart && nextEnd) {
      setVisitingTimeText(`${formatTime24To12(nextStart)} - ${formatTime24To12(nextEnd)}`);
    } else if (nextStart) {
      setVisitingTimeText(formatTime24To12(nextStart));
    } else if (nextEnd) {
      setVisitingTimeText(formatTime24To12(nextEnd));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sheet === 'Doctor_Visits' && selectedProducts.length === 0) {
      pushToast({
        type: 'warning',
        title: 'Select Products_Discussed',
        message: 'Choose at least one product discussed during the visit.',
      });
      return;
    }

    if (sheet === 'Doctor_Product_Detailing') {
      if (selectedProductIds.length === 0) {
        pushToast({
          type: 'warning',
          title: 'Select at least one product',
          message: 'Check one or more products / strengths to link this detailing script.',
        });
        return;
      }
      if (!(formValues.Detailing_BN ?? '').trim() && !(formValues.Detailing_EN ?? '').trim()) {
        pushToast({
          type: 'warning',
          title: 'Enter a detailing script',
          message: 'Provide at least a Bengali or English detailing script.',
        });
        return;
      }
    }

    if ((sheet === 'Doctors' || sheet === 'Hospitals') && !(formValues.Sub_Area ?? '').trim()) {
      pushToast({
        type: 'warning',
        title: 'Select a Sub-Area',
        message: 'Choose a Sub-Area / Market or tap "+ Add Area" to create one.',
      });
      return;
    }

    let resolvedDoctorDeptId = (formValues.Department_ID ?? '').trim();
    if (sheet === 'Doctors') {
      if (!degreeText.trim()) {
        pushToast({
          type: 'warning',
          title: 'Enter medical degree',
          message: 'Select a medical degree or type a custom degree.',
        });
        return;
      }
      if (!resolvedDoctorDeptId) {
        // Attempt last-chance exact/alias match against Departments if user typed without clicking
        const typedSpec = specialistSearch.trim();
        const fallbackDept = typedSpec
          ? dataset.Departments.find(
              (d) =>
                d.Department_Name.toLowerCase() === typedSpec.toLowerCase() ||
                matchSpecialistName(d.Department_Name, typedSpec)
            )
          : undefined;
        if (fallbackDept) {
          resolvedDoctorDeptId = fallbackDept.Department_ID;
        } else {
          pushToast({
            type: 'warning',
            title: 'Select a Specialist',
            message: 'Search and choose a Specialist from the dropdown list.',
          });
          return;
        }
      }
    }

    // Preserve any extra custom columns from the original sheet row on edit
    const payload: Record<string, unknown> = isEdit && initialRecord ? { ...initialRecord } : {};
    spec.fields.forEach((field) => {
      if (field.type === 'products-multi') {
        payload[field.name] = selectedProducts.join(', ');
      } else if (field.type === 'product-ids-multi') {
        payload[field.name] = selectedProductIds.join(', ');
      } else if (field.type === 'doctor-degree') {
        payload[field.name] = degreeText.trim();
      } else if (field.type === 'doctor-specialist') {
        payload[field.name] = resolvedDoctorDeptId;
      } else if (field.type === 'doctor-type') {
        payload[field.name] = doctorType;
      } else if (field.type === 'visiting-days') {
        payload[field.name] = formatVisitingDays(visitingDaysSelected, visitingIsDaily);
      } else if (field.type === 'visiting-time') {
        payload[field.name] = visitingTimeText.trim();
      } else if (field.type === 'number') {
        const raw = formValues[field.name];
        if (raw === '' || raw === undefined) {
          payload[field.name] =
            field.name === 'Single_Price' || field.name === 'Box_Price' ? '' : 0;
        } else {
          payload[field.name] = Number(raw);
        }
      } else {
        payload[field.name] = (formValues[field.name] ?? '').trim();
      }
    });

    if (sheet === 'Doctors' || sheet === 'Hospitals') {
      const subAreaClean = String(payload.Sub_Area ?? formValues.Sub_Area ?? '').trim();
      payload.Sub_Area = subAreaClean;
      payload.areaName = subAreaClean;
      payload.Area_ID =
        effectiveTeamId ||
        teamSession?.areaId ||
        String(initialRecord?.Area_ID ?? dataset.Areas[0]?.Area_ID ?? '');
    }

    if (sheet === 'Doctors') {
      const selectedDeptId = String(payload.Department_ID ?? '').trim();
      const matchedDept = departmentMap.get(selectedDeptId);
      // Automatically sync Specialist name into Specialty column so doctors group cleanly
      payload.Specialty =
        matchedDept?.Department_Name ||
        String(initialRecord?.Specialty ?? selectedDeptId).trim();
      // Persist Regular/Guest Doctor Type cleanly in Category, Doctor_Type, and Remarks
      payload.Doctor_Type = doctorType;
      payload.Category = doctorType;
      const daysStr = formatVisitingDays(visitingDaysSelected, visitingIsDaily);
      const timeStr = visitingTimeText.trim();
      payload.Visiting_Days = daysStr;
      payload.Visiting_Hours = timeStr;
      payload.Remarks = formatDoctorRemarks(doctorType, daysStr, timeStr);
    }

    if (sheet === 'Products') {
      const brand = String(payload.Brand_Name ?? payload.Product_Name ?? '').trim();
      payload.Brand_Name = brand;
      payload.Product_Name = brand;
      const groupCode = normalizeProductGroup(payload.Product_Group);
      payload.Product_Group = formatProductGroupValue(groupCode);
      if (payload.Box_Price !== undefined && payload.Box_Price !== '') {
        payload.MRP_BDT = payload.Box_Price;
      }
    }

    if (sheet === 'Areas') {
      const territory = String(payload.Territory ?? payload.Zone ?? '').trim();
      payload.Territory = territory;
      payload.Zone = territory;
    }

    if (sheet === 'MPO_Users') {
      if (payload.Role) {
        payload.Designation = payload.Role;
      }
      if (payload.Employee_ID !== undefined) {
        payload.Employee_Code = payload.Employee_ID;
      }
      if (payload.Phone_Number !== undefined) {
        payload.Phone = payload.Phone_Number;
      }
    }

    const action = isEdit ? 'update' : 'add';

    setSubmitting(true);
    try {
      const result = await submitRecord(action, sheet, payload);

      // Auto-create or sync linked Chamber row using the selected Hospital as Chamber
      if (sheet === 'Doctors') {
        const doctorId = String(payload.Doctor_ID ?? '').trim();
        const hospitalId = String(payload.Primary_Hospital_ID ?? '').trim();
        const hosp = hospitalMap.get(hospitalId);
        const areaId = String(payload.Area_ID ?? hosp?.Area_ID ?? '').trim();
        const area = areaMap.get(areaId);
        const daysStr = formatVisitingDays(visitingDaysSelected, visitingIsDaily);
        const timeStr = visitingTimeText.trim();

        if (doctorId && (hosp || hospitalId)) {
          const existingChamber = dataset.Chambers.find((c) => c.Doctor_ID === doctorId);
          const chamberAction: 'add' | 'update' = existingChamber ? 'update' : 'add';
          const chamberPayload: Record<string, unknown> = {
            ...(existingChamber || {}),
            Chamber_ID: existingChamber?.Chamber_ID || generateRecordId('CHM'),
            Doctor_ID: doctorId,
            Chamber_Name: hosp?.Hospital_Name || hospitalId,
            Address: hosp?.Address || existingChamber?.Address || area?.Area_Name || '',
            Area_ID: areaId,
            Visiting_Days: daysStr,
            Visiting_Hours: timeStr,
            Assistant_Phone: existingChamber?.Assistant_Phone || '',
            Status: 'Active',
          };
          await submitRecord(chamberAction, 'Chambers', chamberPayload);
        }
      }

      const displaySheetName = sheet;
      pushToast({
        type: result.syncedImmediately ? 'success' : 'info',
        title: isEdit
          ? result.syncedImmediately
            ? `Updated in ${displaySheetName}`
            : `Updated locally & queued sync for ${displaySheetName}`
          : result.syncedImmediately
          ? `Added to ${displaySheetName} in Google Sheets`
          : `Saved to ${displaySheetName} locally & queued for sync`,
        message:
          sheet === 'Doctors'
            ? `Doctor & linked Hospital Chamber synced (${String(payload[spec.idField] || 'Saved')})`
            : `Record ID: ${String(payload[spec.idField] || 'Saved')}`,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle = isEdit ? spec.editTitle : spec.addTitle;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/65 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] bg-white dark:bg-[#0D2235] rounded-t-3xl sm:rounded-2xl border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-[#0D2B45]/20 dark:bg-[#EBF4FA]/20" />
        </div>

        <div className="px-5 py-4 border-b border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-[#0E7C7B] dark:text-[#149A99]">
              Sheet: {sheet} · {isEdit ? 'action: update' : 'action: add'}
            </p>
            <h2 className="text-lg sm:text-xl font-display font-bold text-[#0D2B45] dark:text-white mt-0.5 flex items-center gap-2">
              {isEdit ? (
                <Pencil className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              ) : (
                <Plus className="w-4 h-4 text-[#0E7C7B] dark:text-[#149A99]" />
              )}
              <span>{modalTitle}</span>
            </h2>
            <p className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 mt-0.5">
              {spec.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#0D2B45]/60 hover:text-[#0D2B45] dark:text-[#EBF4FA]/60 dark:hover:text-white hover:bg-[#EBF4FA] dark:hover:bg-[#133859]/50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {spec.fields.map((field) => {
              const inputId = `qa-${sheet}-${field.name}`;
              const value = formValues[field.name] ?? '';
              const isPrimaryKeyLocked = isEdit && field.name === spec.idField;

              if (field.type === 'product-ids-multi') {
                return (
                  <div key={field.name} className="sm:col-span-2 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      <span className="text-xs font-mono tabular-nums text-[#0E7C7B] dark:text-[#149A99] font-semibold">
                        {selectedProductIds.length} linked
                      </span>
                    </div>

                    {/* Selected Product Chips */}
                    {selectedProductIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProductIds.map((pid) => {
                          const prod = productById.get(pid);
                          const label = prod
                            ? `${prod.Brand_Name || prod.Product_Name}${
                                prod.Strength &&
                                !(prod.Brand_Name || prod.Product_Name)
                                  .toLowerCase()
                                  .includes(prod.Strength.toLowerCase())
                                  ? ` ${prod.Strength}`
                                  : ''
                              }`
                            : pid;
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-[#0D2B45] dark:bg-[#0E7C7B] text-white text-xs font-medium"
                            >
                              <span className="truncate max-w-[180px]">{label}</span>
                              <span className="font-mono text-[10px] text-[#EBF4FA]/75">
                                {pid}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleProductId(pid)}
                                aria-label={`Remove ${label}`}
                                className="p-0.5 rounded hover:bg-white/20 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Search input inside multi-product picker */}
                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={productPickerSearch}
                        onChange={(e) => setProductPickerSearch(e.target.value)}
                        placeholder="Search brand, generic, strength, or Product_ID..."
                        aria-label="Filter products to link"
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs sm:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                      />
                    </div>

                    {/* Grouped Checkboxes by Generic / Brand Family */}
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 bg-[#F4F8FC]/60 dark:bg-[#071522]/70 divide-y divide-[#0D2B45]/8 dark:divide-[#EBF4FA]/8">
                      {groupedProductsForPicker.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                          No matching products found.
                        </div>
                      ) : (
                        groupedProductsForPicker.map(([genericGroup, items]) => {
                          const allGroupSelected = items.every((p) =>
                            selectedProductIds.some(
                              (id) => id.toLowerCase() === p.Product_ID.toLowerCase()
                            )
                          );
                          return (
                            <div key={genericGroup} className="p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 px-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 truncate">
                                  {genericGroup} ({items.length})
                                </span>
                                {items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleProductGroup(items)}
                                    className="text-[11px] font-semibold text-[#0E7C7B] dark:text-[#149A99] hover:underline whitespace-nowrap"
                                  >
                                    {allGroupSelected ? 'Deselect group' : 'Select all strengths'}
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {items.map((prod, idx) => {
                                  const checked = selectedProductIds.some(
                                    (id) => id.toLowerCase() === prod.Product_ID.toLowerCase()
                                  );
                                  const brandLabel = prod.Brand_Name || prod.Product_Name || prod.Product_ID;
                                  return (
                                    <button
                                      key={`${prod.Product_ID}-${idx}`}
                                      type="button"
                                      onClick={() => toggleProductId(prod.Product_ID)}
                                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                                        checked
                                          ? 'bg-[#0E7C7B] border-[#0E7C7B] text-white'
                                          : 'bg-white dark:bg-[#0D2235] border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[#0D2B45] dark:text-white hover:border-[#0E7C7B]/60'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate">
                                          {brandLabel}
                                        </div>
                                        <div
                                          className={`text-[11px] truncate ${
                                            checked
                                              ? 'text-[#EBF4FA]/85'
                                              : 'text-[#0D2B45]/60 dark:text-[#EBF4FA]/60'
                                          }`}
                                        >
                                          {[prod.Strength, prod.Dosage_Form, prod.Product_ID]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </div>
                                      </div>
                                      <span
                                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                          checked
                                            ? 'bg-white/20 border-white/40'
                                            : 'border-[#0D2B45]/25 dark:border-[#EBF4FA]/25'
                                        }`}
                                      >
                                        {checked && <Check className="w-3 h-3" />}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 font-mono">
                      Stored in Product_ID: {selectedProductIds.length > 0 ? selectedProductIds.join(', ') : '—'}
                    </p>
                  </div>
                );
              }

              if (field.type === 'products-multi') {
                return (
                  <div key={field.name} className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      <span className="text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60 tabular-nums">
                        {selectedProducts.length} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {dataset.Products.map((prod, idx) => {
                        const checked = selectedProducts.includes(prod.Product_Name);
                        return (
                          <button
                            key={`${prod.Product_ID}-${idx}`}
                            type="button"
                            onClick={() => toggleProduct(prod.Product_Name)}
                            className={`min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                              checked
                                ? 'bg-[#0E7C7B] border-[#0E7C7B] text-white'
                                : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/12 dark:border-[#EBF4FA]/12 text-[#0D2B45] dark:text-white hover:border-[#0E7C7B]/60'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{prod.Product_Name}</div>
                              <div
                                className={`text-[11px] truncate ${
                                  checked
                                    ? 'text-[#EBF4FA]/85'
                                    : 'text-[#0D2B45]/60 dark:text-[#EBF4FA]/60'
                                }`}
                              >
                                {prod.Generic_Name}
                              </div>
                            </div>
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                checked
                                  ? 'bg-white/20 border-white/40'
                                  : 'border-[#0D2B45]/25 dark:border-[#EBF4FA]/25'
                              }`}
                            >
                              {checked && <Check className="w-3 h-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (field.type === 'doctor-degree') {
                return (
                  <div
                    key={field.name}
                    ref={degreeComboRef}
                    className="sm:col-span-2 relative"
                  >
                    <label
                      htmlFor={inputId}
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono mb-1.5"
                    >
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    <div className="relative">
                      <Search
                        className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id={inputId}
                        type="text"
                        role="combobox"
                        aria-expanded={degreeMenuOpen}
                        aria-autocomplete="list"
                        autoComplete="off"
                        required={field.required}
                        value={degreeText}
                        onFocus={() => setDegreeMenuOpen(true)}
                        onChange={(e) => {
                          setDegreeText(e.target.value);
                          setDegreeMenuOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && degreeMenuOpen) {
                            e.preventDefault();
                            if (filteredDegreeOptions.length > 0 && !degreeText.trim()) {
                              setDegreeText(filteredDegreeOptions[0]);
                            }
                            setDegreeMenuOpen(false);
                          }
                        }}
                        placeholder="Search or type degree (e.g., MBBS, FCPS, MD, DGO, BDS)..."
                        className="w-full h-11 pl-9 pr-16 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {degreeText && (
                          <button
                            type="button"
                            onClick={() => {
                              setDegreeText('');
                              setDegreeMenuOpen(true);
                            }}
                            aria-label="Clear degree"
                            className="p-1 rounded-lg text-[#0D2B45]/45 hover:text-[#0D2B45] dark:text-[#EBF4FA]/45 dark:hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDegreeMenuOpen((open) => !open)}
                          aria-label="Toggle degree options"
                          className="p-1 rounded-lg text-[#0D2B45]/55 hover:text-[#0D2B45] dark:text-[#EBF4FA]/55 dark:hover:text-white"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              degreeMenuOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {degreeMenuOpen && (
                      <div
                        role="listbox"
                        aria-label="Medical degree options"
                        className="absolute z-30 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-[#0A1C2D] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 shadow-xl divide-y divide-[#0D2B45]/6 dark:divide-[#EBF4FA]/8"
                      >
                        {degreeText.trim() && !hasExactDegreeMatch && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setDegreeText(degreeText.trim());
                              setDegreeMenuOpen(false);
                            }}
                            className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold text-[#0E7C7B] dark:text-[#149A99] bg-[#EBF4FA]/70 dark:bg-[#0E7C7B]/15 hover:bg-[#EBF4FA] dark:hover:bg-[#0E7C7B]/25 flex items-center gap-2"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              Use custom degree: &ldquo;{degreeText.trim()}&rdquo;
                            </span>
                          </button>
                        )}

                        {filteredDegreeOptions.length === 0 ? (
                          <div className="px-3.5 py-3 text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                            No preset degree matches. Keep typing to use your custom degree.
                          </div>
                        ) : (
                          filteredDegreeOptions.map((deg) => {
                            const isSelected =
                              degreeText.trim().toLowerCase() === deg.toLowerCase();
                            return (
                              <button
                                key={deg}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setDegreeText(deg);
                                  setDegreeMenuOpen(false);
                                }}
                                className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors ${
                                  isSelected
                                    ? 'bg-[#0E7C7B] text-white font-semibold'
                                    : 'text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/60'
                                }`}
                              >
                                <span className="truncate">{deg}</span>
                                {isSelected && <Check className="w-4 h-4 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                      Pick a Bangladeshi medical degree preset or type any custom degree directly.
                    </p>
                  </div>
                );
              }

              if (field.type === 'doctor-specialist') {
                const selectedDept = formValues.Department_ID
                  ? departmentMap.get(formValues.Department_ID)
                  : undefined;

                return (
                  <div
                    key={field.name}
                    ref={specialistComboRef}
                    className="relative"
                  >
                    <label
                      htmlFor={inputId}
                      className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono mb-1.5"
                    >
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    <div className="relative">
                      <Search
                        className="w-4 h-4 text-[#0D2B45]/45 dark:text-[#EBF4FA]/45 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id={inputId}
                        type="text"
                        role="combobox"
                        aria-expanded={specialistMenuOpen}
                        aria-autocomplete="list"
                        autoComplete="off"
                        value={specialistSearch}
                        onFocus={() => setSpecialistMenuOpen(true)}
                        onChange={(e) => {
                          const typed = e.target.value;
                          setSpecialistSearch(typed);
                          setSpecialistMenuOpen(true);
                          const exactMatch = dataset.Departments.find(
                            (d) =>
                              d.Department_Name.toLowerCase() === typed.trim().toLowerCase()
                          );
                          handleFieldChange(
                            'Department_ID',
                            exactMatch ? exactMatch.Department_ID : ''
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && specialistMenuOpen) {
                            e.preventDefault();
                            if (filteredSpecialistOptions.length > 0) {
                              const first = filteredSpecialistOptions[0];
                              handleFieldChange('Department_ID', first.Department_ID);
                              setSpecialistSearch(first.Department_Name);
                              setSpecialistMenuOpen(false);
                            }
                          }
                        }}
                        placeholder="Search specialist (e.g., Cardio, Med, Ped, Ortho)..."
                        className={`w-full h-11 pl-9 pr-16 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B] ${
                          selectedDept
                            ? 'border-[#0E7C7B]/60 dark:border-[#149A99]/60'
                            : 'border-[#0D2B45]/15 dark:border-[#EBF4FA]/15'
                        }`}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        {specialistSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setSpecialistSearch('');
                              handleFieldChange('Department_ID', '');
                              setSpecialistMenuOpen(true);
                            }}
                            aria-label="Clear specialist"
                            className="p-1 rounded-lg text-[#0D2B45]/45 hover:text-[#0D2B45] dark:text-[#EBF4FA]/45 dark:hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSpecialistMenuOpen((open) => !open)}
                          aria-label="Toggle specialist options"
                          className="p-1 rounded-lg text-[#0D2B45]/55 hover:text-[#0D2B45] dark:text-[#EBF4FA]/55 dark:hover:text-white"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              specialistMenuOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {specialistMenuOpen && (
                      <div
                        role="listbox"
                        aria-label="Specialist options"
                        className="absolute z-30 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-[#0A1C2D] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 shadow-xl divide-y divide-[#0D2B45]/6 dark:divide-[#EBF4FA]/8"
                      >
                        {filteredSpecialistOptions.length === 0 ? (
                          <div className="px-3.5 py-3 text-xs text-[#0D2B45]/60 dark:text-[#EBF4FA]/60">
                            No matching specialist found in Departments.
                          </div>
                        ) : (
                          filteredSpecialistOptions.map((dept, idx) => {
                            const isSelected = formValues.Department_ID === dept.Department_ID;
                            return (
                              <button
                                key={`${dept.Department_ID}-${idx}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleFieldChange('Department_ID', dept.Department_ID);
                                  setSpecialistSearch(dept.Department_Name);
                                  setSpecialistMenuOpen(false);
                                }}
                                className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors ${
                                  isSelected
                                    ? 'bg-[#0E7C7B] text-white font-semibold'
                                    : 'text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/60'
                                }`}
                              >
                                <span className="truncate">{dept.Department_Name}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-[11px] font-mono ${
                                      isSelected
                                        ? 'text-white/80'
                                        : 'text-[#0D2B45]/45 dark:text-[#EBF4FA]/45'
                                    }`}
                                  >
                                    {dept.Department_ID}
                                  </span>
                                  {isSelected && <Check className="w-4 h-4" />}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {selectedDept && (
                      <p className="mt-1 text-[11px] text-[#0E7C7B] dark:text-[#149A99] font-medium">
                        Linked: {selectedDept.Department_Name} ({selectedDept.Department_ID})
                      </p>
                    )}
                  </div>
                );
              }

              if (field.type === 'doctor-type') {
                return (
                  <div key={field.name} className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono mb-1.5">
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    <div
                      role="radiogroup"
                      aria-label="Doctor Type"
                      className="grid grid-cols-2 gap-2.5"
                    >
                      {(
                        [
                          {
                            value: 'Regular' as DoctorType,
                            title: 'Regular (নিয়মিত)',
                            hint: 'Permanent / regular physician at this hospital',
                          },
                          {
                            value: 'Guest' as DoctorType,
                            title: 'Guest (গেস্ট)',
                            hint: 'Visiting / guest consultant',
                          },
                        ] as const
                      ).map((opt) => {
                        const selected = doctorType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setDoctorType(opt.value)}
                            className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                              selected
                                ? opt.value === 'Guest'
                                  ? 'bg-amber-600 border-amber-600 text-white'
                                  : 'bg-[#0D2B45] dark:bg-[#0E7C7B] border-[#0D2B45] dark:border-[#149A99] text-white'
                                : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[#0D2B45] dark:text-white hover:border-[#0E7C7B]/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{opt.title}</span>
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  selected
                                    ? 'border-white bg-white/20'
                                    : 'border-[#0D2B45]/30 dark:border-[#EBF4FA]/30'
                                }`}
                              >
                                {selected && <Check className="w-2.5 h-2.5" />}
                              </span>
                            </div>
                            <div
                              className={`text-[11px] mt-0.5 ${
                                selected
                                  ? 'text-white/80'
                                  : 'text-[#0D2B45]/55 dark:text-[#EBF4FA]/55'
                              }`}
                            >
                              {opt.hint}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (field.type === 'visiting-days') {
                const formattedDays = formatVisitingDays(visitingDaysSelected, visitingIsDaily);
                return (
                  <div key={field.name} className="sm:col-span-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        <span>{field.label}</span>
                      </label>
                      <span className="text-[11px] font-medium text-[#0E7C7B] dark:text-[#149A99]">
                        {formattedDays || 'None selected'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={toggleVisitingDaily}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          visitingIsDaily
                            ? 'bg-[#0D2B45] dark:bg-[#0E7C7B] border-[#0D2B45] dark:border-[#149A99] text-white'
                            : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[#0D2B45] dark:text-[#EBF4FA] hover:border-[#0E7C7B]'
                        }`}
                      >
                        Daily (প্রতিদিন)
                      </button>
                      {VISITING_DAYS_LIST.map((day) => {
                        const active = !visitingIsDaily && visitingDaysSelected.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleVisitingDay(day)}
                            className={`min-h-[38px] min-w-[48px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                              active
                                ? 'bg-[#0E7C7B] border-[#0E7C7B] text-white'
                                : visitingIsDaily
                                ? 'bg-[#EBF4FA] dark:bg-[#133859]/60 border-[#0E7C7B]/40 text-[#0E7C7B] dark:text-[#149A99]'
                                : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[#0D2B45] dark:text-[#EBF4FA] hover:border-[#0E7C7B]'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (field.type === 'visiting-time') {
                return (
                  <div key={field.name} className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#0E7C7B] dark:text-[#149A99]" />
                        <span>{field.label}</span>
                      </span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <span className="block text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 mb-1">
                          Start Time
                        </span>
                        <input
                          type="time"
                          value={visitingStartTime}
                          onChange={(e) =>
                            updateVisitingStartEnd(e.target.value, visitingEndTime)
                          }
                          aria-label="Visiting start time"
                          className="w-full h-11 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 mb-1">
                          End Time
                        </span>
                        <input
                          type="time"
                          value={visitingEndTime}
                          onChange={(e) =>
                            updateVisitingStartEnd(visitingStartTime, e.target.value)
                          }
                          aria-label="Visiting end time"
                          className="w-full h-11 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                        />
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55 mb-1">
                          Formatted Schedule (editable)
                        </span>
                        <input
                          type="text"
                          value={visitingTimeText}
                          onChange={(e) => setVisitingTimeText(e.target.value)}
                          placeholder="e.g., 4:00 PM - 8:00 PM"
                          aria-label="Formatted visiting time"
                          className="w-full h-11 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-mono text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B]"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-[#0D2B45]/55 dark:text-[#EBF4FA]/55">
                      Automatically synced with the linked Hospital Chamber record in the Chambers sheet.
                    </p>
                  </div>
                );
              }

              if (field.type === 'sub-area') {
                const subAreaOptions = teamSubAreas.map((sa) => sa.Area_Name);
                const hasCurrentValue =
                  Boolean(value) &&
                  !subAreaOptions.some((opt) => opt.toLowerCase() === value.toLowerCase());

                const handleCreateInlineSubArea = async () => {
                  const trimmed = inlineSubAreaName.trim();
                  if (!trimmed) return;
                  setSavingInlineSubArea(true);
                  try {
                    const res = await saveSubArea({ Area_Name: trimmed });
                    if (res.ok && res.subArea) {
                      handleFieldChange('Sub_Area', res.subArea.Area_Name);
                      setInlineSubAreaName('');
                      setShowInlineSubArea(false);
                    } else if (res.error) {
                      pushToast({
                        type: 'error',
                        title: 'Could not add Sub-Area',
                        message: res.error,
                      });
                    }
                  } finally {
                    setSavingInlineSubArea(false);
                  }
                };

                return (
                  <div key={field.name} className={field.fullWidth ? 'sm:col-span-2' : ''}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        htmlFor={inputId}
                        className="text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono"
                      >
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowInlineSubArea((prev) => !prev)}
                        className="text-[11px] font-bold text-[#0E7C7B] dark:text-[#22E3D0] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{showInlineSubArea ? 'Close' : 'Add Area'}</span>
                      </button>
                    </div>

                    <select
                      id={inputId}
                      value={value}
                      onChange={(e) => handleFieldChange('Sub_Area', e.target.value)}
                      required={field.required}
                      className="w-full h-11 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    >
                      <option value="">
                        {subAreaOptions.length === 0
                          ? 'No Sub-Areas yet — tap "+ Add Area"'
                          : 'Select Sub-Area / Market *'}
                      </option>
                      {hasCurrentValue && <option value={value}>{value}</option>}
                      {subAreaOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {showInlineSubArea && (
                      <div className="mt-2 p-2.5 rounded-xl bg-[#EBF4FA]/70 dark:bg-[#0A1D30] border border-[#0E7C7B]/30 flex items-center gap-2">
                        <input
                          type="text"
                          value={inlineSubAreaName}
                          onChange={(e) => setInlineSubAreaName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleCreateInlineSubArea();
                            }
                          }}
                          placeholder="e.g., Eidgaon Bazar, Islamabad..."
                          aria-label="New Sub-Area name"
                          className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-xs sm:text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                        />
                        <button
                          type="button"
                          disabled={savingInlineSubArea || !inlineSubAreaName.trim()}
                          onClick={() => void handleCreateInlineSubArea()}
                          className="h-9 px-3 rounded-lg bg-[#0E7C7B] hover:bg-[#095C5B] disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                        >
                          {savingInlineSubArea ? 'Saving...' : 'Save Area'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              // Ensure existing value appears as an option in select dropdowns if live sheet has custom text
              const selectOptions =
                field.type === 'select' && field.options
                  ? value && !field.options.includes(value)
                    ? [value, ...field.options]
                    : field.options
                  : [];

              return (
                <div key={field.name} className={field.fullWidth ? 'sm:col-span-2' : ''}>
                  <label
                    htmlFor={inputId}
                    className="block text-xs font-semibold text-[#0D2B45] dark:text-[#EBF4FA] font-mono mb-1.5"
                  >
                    {field.label}
                    {field.required ? ' *' : ''}
                    {isPrimaryKeyLocked && (
                      <span className="ml-1.5 font-sans font-normal text-[11px] text-[#0D2B45]/50 dark:text-[#EBF4FA]/50">
                        (Key)
                      </span>
                    )}
                  </label>

                  {field.type === 'ref' && field.refSheet ? (
                    <select
                      id={inputId}
                      value={value}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      className="w-full h-11 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    >
                      <option value="">Select {field.label}...</option>
                      {value &&
                        !refOptions[field.refSheet].some((o) => o.value === value) && (
                          <option value={value}>{value}</option>
                        )}
                      {refOptions[field.refSheet].map((opt, idx) => (
                        <option key={`${opt.value}-${idx}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'select' ? (
                    <select
                      id={inputId}
                      value={value}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      className="w-full h-11 px-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white focus:outline-none focus:border-[#0E7C7B]"
                    >
                      {selectOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      id={inputId}
                      rows={field.name === 'Detailing_BN' || field.name === 'Detailing_EN' ? 4 : 3}
                      value={value}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full p-3 rounded-xl bg-[#F4F8FC] dark:bg-[#071522] border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40 focus:outline-none focus:border-[#0E7C7B] leading-relaxed"
                    />
                  ) : (
                    <>
                      <input
                        id={inputId}
                        type={field.type}
                        step={field.type === 'number' ? 'any' : undefined}
                        min={field.type === 'number' ? '0' : undefined}
                        value={value}
                        readOnly={isPrimaryKeyLocked}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        required={field.required}
                        placeholder={field.placeholder}
                        className={`w-full h-11 px-3 rounded-xl border text-sm focus:outline-none focus:border-[#0E7C7B] ${
                          isPrimaryKeyLocked
                            ? 'bg-[#EBF4FA]/70 dark:bg-[#0A1C2D] border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 text-[#0D2B45]/70 dark:text-[#EBF4FA]/70 cursor-not-allowed'
                            : 'bg-[#F4F8FC] dark:bg-[#071522] border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-[#0D2B45] dark:text-white placeholder:text-[#0D2B45]/45 dark:placeholder:text-[#EBF4FA]/40'
                        } ${
                          field.name === spec.idField ||
                          field.type === 'date' ||
                          field.type === 'time' ||
                          field.type === 'number'
                            ? 'font-mono tabular-nums'
                            : ''
                        }`}
                      />
                      {sheet === 'Products' && field.name === 'Box_Price' && (
                        <p className="mt-1 text-[11px] font-mono tabular-nums text-[#0E7C7B] dark:text-[#149A99]">
                          {formValues.Single_Price !== undefined &&
                          formValues.Single_Price !== '' ? (
                            <>
                              Auto: {parsePackUnits(formValues.Pack_Size)} unit
                              {parsePackUnits(formValues.Pack_Size) === 1 ? '' : 's'} ×{' '}
                              {formatBDT(formValues.Single_Price)} ={' '}
                              {formatBDT(
                                calculateBoxPrice(formValues.Single_Price, formValues.Pack_Size)
                              )}{' '}
                              (editable)
                            </>
                          ) : (
                            <>
                              Parsed units from Pack_Size: {parsePackUnits(formValues.Pack_Size)} unit
                              {parsePackUnits(formValues.Pack_Size) === 1 ? '' : 's'}
                            </>
                          )}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-[#0D2B45]/10 dark:border-[#EBF4FA]/10 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-[#0D2B45]/15 dark:border-[#EBF4FA]/15 text-sm font-medium text-[#0D2B45] dark:text-[#EBF4FA] hover:bg-[#F4F8FC] dark:hover:bg-[#133859]/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0D2B45] hover:bg-[#133859] dark:bg-[#0E7C7B] dark:hover:bg-[#149A99] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              {isEdit ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              <span>
                {submitting
                  ? isEdit
                    ? 'Updating...'
                    : 'Saving...'
                  : isEdit
                  ? `Update ${sheet}`
                  : `Save to ${sheet}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
