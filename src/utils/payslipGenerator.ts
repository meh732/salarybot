import * as XLSX from 'xlsx';
import { PayslipItem, PERSIAN_MONTHS } from '../types/payroll';
import {
  extractCleanPersonnelCode,
  formatExcelDurationCommon,
  parseExcelWorkbookCommon,
} from './excelPayrollScanner';
import {
  RSS_LOGO_BOTTOM_DATA_URL,
  RSS_LOGO_TOP_DATA_URL,
} from './rssLogos';

export { extractCleanPersonnelCode, formatExcelDurationCommon };

export function toPersianDigits(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(val).replace(/[0-9]/g, (w) => persian[+w]);
}

export function toEnglishDigits(val: string): string {
  return val
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatRial(amount: number): string {
  const formatted = new Intl.NumberFormat('fa-IR').format(Math.round(amount || 0));
  return `${formatted} ریال`;
}

/**
 * Dynamically computes the current Solar Hijri (Shamsi) year (e.g. 1405)
 */
export function getCurrentSolarYear(): number {
  try {
    const parts = new Date().toLocaleDateString('fa-IR-u-nu-latn').split('/');
    if (parts.length > 0) {
      const parsedYear = Number(String(parts[0]).replace(/[^0-9]/g, ''));
      if (parsedYear >= 1400 && parsedYear <= 1499) {
        return parsedYear;
      }
    }
  } catch (err) {
    console.error('Error computing solar year:', err);
  }
  return 1405; // Default for 2026
}

/**
 * Array of Solar Hijri years spanning 1400 to 1499
 */
export const SOLAR_YEARS: number[] = Array.from({ length: 100 }, (_, i) => 1400 + i);

/**
 * Generates an official, high-resolution SVG/DataURL image of an Iranian Smart National ID Card
 * for demo/testing or renders the user's uploaded photo.
 */
export function generateNationalCardSvgDataUrl(
  fullName: string,
  nationalCode: string,
  birthDate = '۱۳۷۱/۰۶/۱۵',
  fatherName = 'محمدرضا'
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" direction="rtl">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0f2fe"/>
        <stop offset="50%" stop-color="#f0fdf4"/>
        <stop offset="100%" stop-color="#fef3c7"/>
      </linearGradient>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#065f46"/>
        <stop offset="50%" stop-color="#047857"/>
        <stop offset="100%" stop-color="#0f766e"/>
      </linearGradient>
      <pattern id="guilloche" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#0d9488" stroke-width="0.4" stroke-opacity="0.18"/>
        <path d="M 0 12 Q 12 0 24 12 Q 12 24 0 12" fill="none" stroke="#0284c7" stroke-width="0.4" stroke-opacity="0.15"/>
      </pattern>
    </defs>
    <rect width="640" height="400" rx="22" fill="url(#bgGrad)" stroke="#94a3b8" stroke-width="2"/>
    <rect width="640" height="400" rx="22" fill="url(#guilloche)"/>
    <path d="M 0 22 Q 0 0 22 0 L 618 0 Q 640 0 640 22 L 640 76 L 0 76 Z" fill="url(#headerGrad)"/>
    <text x="320" y="34" font-family="Vazirmatn, Tahoma, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">جمهوری اسلامی ایران - سازمان ثبت احوال کشور</text>
    <text x="320" y="60" font-family="Vazirmatn, Tahoma, sans-serif" font-size="14" fill="#a7f3d0" text-anchor="middle">کارت هوشمند ملی (نسخه احراز هویت پرسنلی)</text>

    <!-- Smart Chip -->
    <rect x="515" y="110" width="68" height="52" rx="8" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/>
    <line x1="515" y1="127" x2="583" y2="127" stroke="#b45309" stroke-width="1"/>
    <line x1="515" y1="145" x2="583" y2="145" stroke="#b45309" stroke-width="1"/>
    <line x1="549" y1="110" x2="549" y2="162" stroke="#b45309" stroke-width="1"/>

    <!-- Photo Frame -->
    <rect x="44" y="102" width="150" height="195" rx="12" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <circle cx="119" cy="166" r="34" fill="#64748b"/>
    <path d="M 65 275 C 65 222 173 222 173 275 Z" fill="#64748b"/>
    <rect x="54" y="310" width="130" height="28" rx="6" fill="#065f46" fill-opacity="0.12"/>
    <text x="119" y="329" font-family="Vazirmatn, Tahoma, sans-serif" font-size="12" font-weight="bold" fill="#065f46" text-anchor="middle">تصویر تأیید شده</text>

    <!-- Fields -->
    <g font-family="Vazirmatn, Tahoma, sans-serif" text-anchor="right">
      <text x="485" y="130" font-size="14" fill="#475569">شماره ملی:</text>
      <text x="395" y="130" font-size="18" font-weight="bold" fill="#0f172a">${toPersianDigits(nationalCode)}</text>

      <text x="485" y="175" font-size="14" fill="#475569">نام و نام خانوادگی:</text>
      <text x="355" y="175" font-size="18" font-weight="bold" fill="#0f172a">${fullName}</text>

      <text x="485" y="220" font-size="14" fill="#475569">تاریخ تولد:</text>
      <text x="395" y="220" font-size="16" font-weight="bold" fill="#0f172a">${toPersianDigits(birthDate)}</text>

      <text x="485" y="265" font-size="14" fill="#475569">نام پدر:</text>
      <text x="415" y="265" font-size="16" font-weight="bold" fill="#0f172a">${fatherName}</text>

      <text x="485" y="310" font-size="14" fill="#475569">اعتبار کارت:</text>
      <text x="395" y="310" font-size="15" font-weight="bold" fill="#047857">۱۴۱۰/۱۲/۲۹</text>
    </g>

    <rect x="36" y="352" width="568" height="30" rx="6" fill="#0f172a" fill-opacity="0.06"/>
    <text x="320" y="372" font-family="monospace" font-size="13" fill="#334155" text-anchor="middle">IDIRN${nationalCode}<<<<<<PERS-AUTH-VERIFIED</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Formats a Rial number with Persian digits and standard comma separators, or '-' if 0.
 */
function formatCellMoneyOrDash(amount: number | undefined | null): string {
  const n = Math.round(Number(amount) || 0);
  if (n <= 0) return '-';
  const withCommas = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toPersianDigits(withCommas);
}

/**
 * Generates an official, high-resolution SVG DataURL of a Payslip (`تصویر فیش حقوقی`)
 * using the exact geometric coordinates, table grid, and embedded RSS logos of the
 * official Royal Sanat Samaneh (`شرکت رویال صنعت سامانه`) PDF template (`595.2 x 420.72`).
 */
export function generatePayslipSvgDataUrl(payslip: PayslipItem, orgName = 'رویال صنعت سامانه'): string {
  if (payslip.customImageUrl && payslip.customImageUrl.startsWith('data:image/')) {
    return payslip.customImageUrl;
  }

  const isDefaultAppTitle =
    !orgName ||
    orgName.includes('سامانه جامع') ||
    orgName.includes('فیش حقوقی') ||
    orgName.includes('رویال');
  const cleanOrg = isDefaultAppTitle
    ? 'شرکت رویال صنعت سامانه'
    : orgName.startsWith('شرکت')
    ? orgName
    : `شرکت ${orgName}`;

  const baseSalary = Number(payslip.baseSalary) || 0;
  const specPay = Number(payslip.specializationPay) || 0;
  const groceryPay = Number(payslip.groceryAllowance) || 0;
  const housingPay = Number(payslip.housingAllowance) || 0;
  const marAllowance = Number(payslip.maritalAllowance) || 0;
  const childPay = Number(payslip.childAllowance) || 0;
  const senPay = Number(payslip.seniorityPay) || 0;
  const missionPay = Number(payslip.missionPay) || 0;
  const overtimePay = Number(payslip.overtimePay) || 0;
  const holPay = Number(payslip.holidayPay) || 0;
  const bonusOrService = Number(payslip.bonusPay) || 0;
  const extDayPay = Number(payslip.extraDayPay) || 0;

  const computedEarn =
    baseSalary +
    specPay +
    groceryPay +
    housingPay +
    marAllowance +
    childPay +
    senPay +
    missionPay +
    overtimePay +
    holPay +
    bonusOrService +
    extDayPay;
  const totalEarn = Number(payslip.totalEarnings) || computedEarn;

  const insDed = Number(payslip.insuranceDeduction) || 0;
  const suppIns = Number(payslip.supplementaryInsurance) || 0;
  const taxDed = Number(payslip.taxDeduction) || 0;
  const loanDed = Number(payslip.loanDeduction) || 0;
  const lunchDed = Number(payslip.lunchDeduction) || 0;
  const otherDed = Number(payslip.otherDeduction) || 0;

  const computedDed = insDed + suppIns + taxDed + loanDed + lunchDed + otherDed;
  const totalDed = Number(payslip.totalDeductions) || computedDed;
  const netPay = Number(payslip.netPay) || Math.max(0, totalEarn - totalDed);

  // Format Attendance values cleanly (converting Excel time fractions like 0.11180555555555556 -> ۲:۴۱:۰۰)
  const workingDaysStr = toPersianDigits((Number(payslip.workingDays) || 30).toFixed(1));
  const rawOt =
    formatExcelDurationCommon(payslip.overtimeHoursStr) ||
    (payslip.overtimeHours ? formatExcelDurationCommon(payslip.overtimeHours) : '') ||
    '0:00:00';
  const otStr = toPersianDigits(rawOt);

  const rawHol =
    formatExcelDurationCommon(payslip.holidayHoursStr) ||
    '0:00:00';
  const holStr = toPersianDigits(rawHol);

  const leaveStr =
    payslip.leaveHoursStr && payslip.leaveHoursStr !== '-'
      ? toPersianDigits(formatExcelDurationCommon(payslip.leaveHoursStr) || payslip.leaveHoursStr)
      : '-';

  const empNameClean = (payslip.employeeName || `پرسنل ${payslip.personnelCode}`).trim();
  const pCodeClean = toEnglishDigits(String(payslip.personnelCode || '').trim());
  const yearClean = toEnglishDigits(String(payslip.year || getCurrentSolarYear()));
  const monthLabel = `${payslip.monthName} ${yearClean}`;

  // Dynamic center X for "نام و نام خانوادگی : <Name>" so its right edge aligns neatly at x ~ 526
  const fullNameLine = `نام و نام خانوادگی : ${empNameClean}`;
  const nameCenterX = Math.max(375, Math.min(462, 528 - fullNameLine.length * 2.35));

  // Notice: Every single <text> uses text-anchor="middle" and the root <svg> does NOT use direction="rtl",
  // eliminating browser RTL text-anchor inversion bugs and preventing any clipping or border overlap.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1190" height="841" viewBox="0 0 595.2 420.72">
    <style>
      .f-fa { font-family: Tahoma, Vazirmatn, Arial, sans-serif; fill: #000000; direction: rtl; unicode-bidi: embed; }
      .f-num { font-family: Tahoma, Vazirmatn, Arial, sans-serif; fill: #000000; }
      .bold { font-weight: bold; }
      .grid-line { stroke: #000000; stroke-width: 0.96; stroke-linecap: square; }
    </style>

    <!-- Pure White Page Background -->
    <rect width="595.2" height="420.72" fill="#ffffff"/>

    <!-- Top-Left Official RSS Logo -->
    <image x="70.47" y="30.24" width="74.01" height="39.69" href="${RSS_LOGO_TOP_DATA_URL}" xlink:href="${RSS_LOGO_TOP_DATA_URL}" preserveAspectRatio="xMidYMid meet"/>

    <!-- Header Text Above Table -->
    <text x="380" y="48.8" font-size="16.5" class="f-fa bold" text-anchor="middle">فیش حقوقی پرسنل ${cleanOrg}</text>
    <text x="${nameCenterX.toFixed(1)}" y="69.2" font-size="11.04" class="f-fa bold" text-anchor="middle">${fullNameLine}</text>

    <text x="496.5" y="85.2" font-size="11.04" class="f-fa bold" text-anchor="middle">شماره پرسنلی</text>
    <text x="430.5" y="85.2" font-size="11.04" class="f-num bold" text-anchor="middle">${pCodeClean}</text>

    <text x="106.0" y="85.2" font-size="11.04" class="f-fa bold" text-anchor="middle">${monthLabel}</text>

    <!-- Shaded Gray Fills (#d9d9d9) -->
    <!-- 1. Table Header Row -->
    <rect x="69.36" y="89.42" width="461.82" height="13.8" fill="#d9d9d9"/>
    <!-- 2. Net Pay Highlight Box -->
    <rect x="324.85" y="328.6" width="79.8" height="19.1" fill="#d9d9d9"/>

    <!-- Table Horizontal Lines -->
    <!-- Top Border of Table -->
    <line x1="69.36" y1="89.42" x2="531.18" y2="89.42" class="grid-line"/>
    <!-- Bottom of Header Row -->
    <line x1="69.36" y1="103.22" x2="531.18" y2="103.22" class="grid-line"/>
    <!-- Top of Totals Row -->
    <line x1="69.36" y1="310.8" x2="531.18" y2="310.8" class="grid-line"/>
    <!-- Double Line Separating Totals Row and Net Pay Footer Row -->
    <line x1="69.36" y1="327.2" x2="531.18" y2="327.2" class="grid-line"/>
    <line x1="69.36" y1="328.6" x2="531.18" y2="328.6" class="grid-line"/>
    <!-- Bottom Border of Table -->
    <line x1="69.36" y1="348.2" x2="531.18" y2="348.2" class="grid-line"/>

    <!-- Table Vertical Lines -->
    <!-- Far Left Outer Border -->
    <line x1="69.36" y1="89.42" x2="69.36" y2="348.2" class="grid-line"/>
    <!-- Col 1 | Col 2 (Deductions Values | Deductions Labels) -->
    <line x1="142.76" y1="103.22" x2="142.76" y2="310.8" class="grid-line"/>
    <!-- Col 2 | Col 3 (Deductions | Earnings) -->
    <line x1="257.99" y1="89.42" x2="257.99" y2="310.8" class="grid-line"/>
    <!-- Col 3 | Col 4 (Earnings Values | Earnings Labels) -->
    <line x1="324.85" y1="103.22" x2="324.85" y2="310.8" class="grid-line"/>
    <!-- Col 4 | Col 5 (Earnings | Attendance) -->
    <line x1="404.65" y1="89.42" x2="404.65" y2="310.8" class="grid-line"/>
    <!-- Col 5 | Col 6 (Attendance Values | Attendance Labels - extends to Totals bottom) -->
    <line x1="456.28" y1="103.22" x2="456.28" y2="327.2" class="grid-line"/>
    <!-- Far Right Outer Border -->
    <line x1="531.18" y1="89.42" x2="531.18" y2="348.2" class="grid-line"/>

    <!-- Table Header Titles -->
    <text x="163.67" y="99.6" font-size="11.04" class="f-fa bold" text-anchor="middle">کسورات</text>
    <text x="331.32" y="99.6" font-size="11.04" class="f-fa bold" text-anchor="middle">حقوق و دستمزد ( ریال )</text>

    <!-- ================= COL 1 & COL 2: DEDUCTIONS (کسورات) ================= -->
    <g font-size="9.96" text-anchor="middle">
      <!-- Row 1: بیمه تامین اجتماعی -->
      <text x="200.37" y="114.2" class="f-fa bold">بیمه تامین اجتماعی</text>
      <text x="106.06" y="114.2" class="f-num bold">${formatCellMoneyOrDash(insDed)}</text>

      <!-- Row 2: بیمه تکمیلی -->
      <text x="200.37" y="130.16" class="f-fa bold">بیمه تکمیلی</text>
      <text x="106.06" y="130.16" class="f-num bold">${formatCellMoneyOrDash(suppIns)}</text>

      <!-- Row 3: مالیات حقوق -->
      <text x="200.37" y="146.12" class="f-fa bold">مالیات حقوق</text>
      <text x="106.06" y="146.12" class="f-num bold">${formatCellMoneyOrDash(taxDed)}</text>

      <!-- Row 4: قسط وام -->
      <text x="200.37" y="162.08" class="f-fa bold">قسط وام</text>
      <text x="106.06" y="162.08" class="f-num bold">${formatCellMoneyOrDash(loanDed)}</text>

      <!-- Row 5: کسر کار -->
      <text x="200.37" y="178.04" class="f-fa bold">کسر کار</text>
      <text x="106.06" y="178.04" class="f-num bold">-</text>

      <!-- Row 6: مساعده -->
      <text x="200.37" y="194.0" class="f-fa bold">مساعده</text>
      <text x="106.06" y="194.0" class="f-num bold">${formatCellMoneyOrDash(otherDed)}</text>

      <!-- Row 7: ناهار یا نقطه -->
      <text x="200.37" y="209.96" class="f-fa bold">${lunchDed > 0 ? 'ناهار' : '.'}</text>
      <text x="106.06" y="209.96" class="f-num bold">${lunchDed > 0 ? formatCellMoneyOrDash(lunchDed) : '.'}</text>
    </g>

    <!-- ================= COL 3 & COL 4: EARNINGS (حقوق و دستمزد) ================= -->
    <g font-size="9.96" text-anchor="middle">
      <!-- Row 1: پایه -->
      <text x="364.75" y="114.2" class="f-fa bold">پایه</text>
      <text x="291.42" y="114.2" class="f-num bold">${formatCellMoneyOrDash(baseSalary)}</text>

      <!-- Row 2: حق تخصص -->
      <text x="364.75" y="130.16" class="f-fa bold">حق تخصص</text>
      <text x="291.42" y="130.16" class="f-num bold">${formatCellMoneyOrDash(specPay)}</text>

      <!-- Row 3: حق بن -->
      <text x="364.75" y="146.12" class="f-fa bold">حق بن</text>
      <text x="291.42" y="146.12" class="f-num bold">${formatCellMoneyOrDash(groceryPay)}</text>

      <!-- Row 4: حق مسکن -->
      <text x="364.75" y="162.08" class="f-fa bold">حق مسکن</text>
      <text x="291.42" y="162.08" class="f-num bold">${formatCellMoneyOrDash(housingPay)}</text>

      <!-- Row 5: حق تاهل -->
      <text x="364.75" y="178.04" class="f-fa bold">حق تاهل</text>
      <text x="291.42" y="178.04" class="f-num bold">${formatCellMoneyOrDash(marAllowance)}</text>

      <!-- Row 6: حق اولاد -->
      <text x="364.75" y="194.0" class="f-fa bold">حق اولاد</text>
      <text x="291.42" y="194.0" class="f-num bold">${formatCellMoneyOrDash(childPay)}</text>

      <!-- Row 7: پایه سنوات -->
      <text x="364.75" y="209.96" class="f-fa bold">پایه سنوات</text>
      <text x="291.42" y="209.96" class="f-num bold">${formatCellMoneyOrDash(senPay)}</text>

      <!-- Row 8: حق ماموریت -->
      <text x="364.75" y="225.92" class="f-fa bold">حق ماموریت</text>
      <text x="291.42" y="225.92" class="f-num bold">${formatCellMoneyOrDash(missionPay)}</text>

      <!-- Row 9: اضافه کار -->
      <text x="364.75" y="241.88" class="f-fa bold">اضافه کار</text>
      <text x="291.42" y="241.88" class="f-num bold">${formatCellMoneyOrDash(overtimePay)}</text>

      <!-- Row 10: تعطیل کاری -->
      <text x="364.75" y="257.84" class="f-fa bold">تعطیل کاری</text>
      <text x="291.42" y="257.84" class="f-num bold">${formatCellMoneyOrDash(holPay)}</text>

      <!-- Row 11: معوقه -->
      <text x="364.75" y="273.8" class="f-fa bold">معوقه</text>
      <text x="291.42" y="273.8" class="f-num bold">-</text>

      <!-- Row 12: سرویس / کارانه -->
      <text x="364.75" y="289.76" class="f-fa bold">سرویس</text>
      <text x="291.42" y="289.76" class="f-num bold">${formatCellMoneyOrDash(bonusOrService)}</text>

      <!-- Row 13: یک روز اضافه ماه -->
      <text x="364.75" y="305.72" class="f-fa bold">یک روز اضافه ماه</text>
      <text x="291.42" y="305.72" class="f-num bold">${formatCellMoneyOrDash(extDayPay)}</text>
    </g>

    <!-- ================= COL 5 & COL 6: ATTENDANCE (کارکرد) ================= -->
    <g font-size="9.96" text-anchor="middle">
      <!-- Item 1: کارکرد / روز -->
      <text x="493.73" y="122.1" class="f-fa bold">کارکرد / روز</text>
      <text x="430.46" y="129.8" class="f-num bold">${workingDaysStr}</text>

      <!-- Item 2: اضافه کار -->
      <text x="493.73" y="154.0" class="f-fa bold">اضافه کار</text>
      <text x="430.46" y="161.7" class="f-num bold">${otStr}</text>

      <!-- Item 3: ماموریت -->
      <text x="493.73" y="185.9" class="f-fa bold">ماموریت</text>

      <!-- Item 4: کسر کار -->
      <text x="493.73" y="217.8" class="f-fa bold">کسر کار</text>
      <text x="430.46" y="225.5" class="f-num bold">.</text>

      <!-- Item 5: تعطیل کاری -->
      <text x="493.73" y="249.8" class="f-fa bold">تعطیل کاری</text>
      <text x="430.46" y="257.5" class="f-num bold">${holStr}</text>

      <!-- Item 6: مانده مرخصی ( ساعت) -->
      <text x="493.73" y="274.5" class="f-fa bold">مانده مرخصی</text>
      <text x="493.73" y="289.0" class="f-fa bold">( ساعت)</text>
      <text x="430.46" y="289.0" class="f-num bold">${leaveStr}</text>
    </g>

    <!-- ================= TOTALS ROW (جمع کل) ================= -->
    <g font-size="11.04" text-anchor="middle">
      <text x="106.06" y="322.2" class="f-num bold">${formatCellMoneyOrDash(totalDed)}</text>
      <text x="291.42" y="322.2" class="f-num bold">${formatCellMoneyOrDash(totalEarn)}</text>
    </g>

    <!-- ================= FOOTER ROW (خالص پرداختی) ================= -->
    <image x="70.02" y="329.2" width="73.32" height="18.2" href="${RSS_LOGO_BOTTOM_DATA_URL}" xlink:href="${RSS_LOGO_BOTTOM_DATA_URL}" preserveAspectRatio="xMidYMid meet"/>
    <text x="312.5" y="341.6" font-size="11.04" class="f-fa" text-anchor="middle">ریال</text>
    <text x="364.75" y="341.8" font-size="11.5" class="f-num bold" text-anchor="middle">${formatCellMoneyOrDash(netPay)}</text>
    <text x="493.73" y="341.4" font-size="11.5" class="f-fa bold" text-anchor="middle">خالص پرداختی</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Renders the Payslip SVG onto a high-resolution HTML5 Canvas (1786 x 1262, 300 DPI)
 */
async function renderPayslipToCanvas(payslip: PayslipItem, orgName?: string): Promise<HTMLCanvasElement> {
  const dataUrl = generatePayslipSvgDataUrl(payslip, orgName);
  const [svgImg, topLogoImg, bottomLogoImg] = await Promise.all([
    loadImageElement(dataUrl),
    loadImageElement(RSS_LOGO_TOP_DATA_URL).catch(() => null),
    loadImageElement(RSS_LOGO_BOTTOM_DATA_URL).catch(() => null),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = 1786;
  canvas.height = 1262;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(svgImg, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 595.2;
    const scaleY = canvas.height / 420.72;
    if (topLogoImg) {
      ctx.drawImage(
        topLogoImg,
        70.47 * scaleX,
        30.24 * scaleY,
        74.01 * scaleX,
        39.69 * scaleY
      );
    }
    if (bottomLogoImg) {
      ctx.drawImage(
        bottomLogoImg,
        70.02 * scaleX,
        329.2 * scaleY,
        73.32 * scaleX,
        18.2 * scaleY
      );
    }
  }
  return canvas;
}

/**
 * Packs a JPEG Uint8Array into a standards-compliant, single-page PDF 1.4 binary
 * with exact page dimensions [0 0 595.2 420.72] matching the official RSS payslip PDF.
 */
function buildPdfFromJpegBytes(jpegBytes: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  const pageW = 595.2;
  const pageH = 420.72;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // index 0 is unused (object 0)
  let currentOffset = 0;

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    currentOffset += b.byteLength;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    currentOffset += b.byteLength;
  };

  // PDF Header
  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog
  offsets[1] = currentOffset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets[2] = currentOffset;
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page
  offsets[3] = currentOffset;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 4 0 R >> /ProcSet [/PDF /ImageC] >> /MediaBox [0 0 ${pageW} ${pageH}] /Contents 5 0 R >>\nendobj\n`
  );

  // Object 4: Image XObject (DCTDecode JPEG)
  offsets[4] = currentOffset;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Interpolate true /Length ${jpegBytes.byteLength} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  // Object 5: Page Content Stream
  const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im1 Do\nQ\n`;
  offsets[5] = currentOffset;
  pushStr(
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
  );

  // XRef Table
  const xrefOffset = currentOffset;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  // Trailer
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const totalOut = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    totalOut.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return totalOut;
}

/**
 * Generates and downloads a real PNG image from the Payslip SVG or custom image
 */
export async function downloadPayslipImage(payslip: PayslipItem, orgName?: string): Promise<void> {
  const canvas = await renderPayslipToCanvas(payslip, orgName);
  const pngUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = pngUrl;
  a.download = `Payslip-${payslip.personnelCode}-${payslip.year}-${String(payslip.month).padStart(2, '0')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Generates a real, standards-compliant PDF 1.4 file matching the official RSS Royal Sanat Samaneh
 * corporate template format (`595.2 x 420.72`) and triggers immediate PDF download.
 */
export async function downloadPayslipPdf(payslip: PayslipItem, orgName = 'رویال صنعت سامانه'): Promise<void> {
  const fileName =
    payslip.customPdfFileName ||
    `Payslip-${payslip.personnelCode}-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`;

  try {
    const canvas = await renderPayslipToCanvas(payslip, orgName);
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.96);
    const base64Part = jpegDataUrl.split(',')[1] || '';
    const binaryStr = atob(base64Part);
    const jpegBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      jpegBytes[i] = binaryStr.charCodeAt(i);
    }

    const pdfBytes = buildPdfFromJpegBytes(jpegBytes, canvas.width, canvas.height);
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const pdfBlobUrl = URL.createObjectURL(blob);

    // Download the real .pdf file directly
    const a = document.createElement('a');
    a.href = pdfBlobUrl;
    a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(pdfBlobUrl), 60000);
  } catch (err) {
    console.error('Error generating PDF payslip:', err);
  }
}

/**
 * Generates and downloads a Sample Excel (.xlsx) Payroll Template matching the official RSS Royal Sanat Samaneh format
 */
export function downloadSamplePayrollExcel(year = 1405, month = 6): void {
  const monthObj = PERSIAN_MONTHS.find((m) => m.number === month) || PERSIAN_MONTHS[5];
  const rows = [
    {
      'شماره پرسنلی': '971050',
      'نام و نام خانوادگی': 'اکبر اسمعیلی',
      'کد ملی': '0014829103',
      'واحد سازمانی': 'رویال صنعت سامانه - مدیریت فنی',
      'سمت شغلی': 'سرپرست تولید و ماشین‌آلات',
      'شماره حساب': 'IR420170000000109283746501',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'کارکرد / روز': 31.0,
      'ساعت اضافه‌کار': '114:33:00',
      'ساعت تعطیل کاری': '44:46:00',
      'حقوق پایه': 195436436,
      'حق تخصص': 110589381,
      'حق بن': 22000000,
      'حق مسکن': 30000000,
      'حق تاهل': 5000000,
      'حق اولاد': 16625550,
      'پایه سنوات': 34317060,
      'حق ماموریت': 0,
      'مبلغ اضافه‌کار': 284274933,
      'مبلغ تعطیل کاری': 142837651,
      'پاداش و کارانه': 0,
      'یک روز اضافه ماه': 13798948,
      'جمع حقوق و دستمزد': 854879959,
      'بیمه تامین اجتماعی': 27624519,
      'بیمه تکمیلی': 6820000,
      'مالیات حقوق': 0,
      'قسط وام': 0,
      'کسر کار': 0,
      'مساعده': 0,
      'ناهار': 30000000,
      'جمع کسورات': 64444519,
      'خالص پرداختی': 790435440,
    },
    {
      'شماره پرسنلی': '1001',
      'نام و نام خانوادگی': 'مهندس علی محمدی',
      'کد ملی': '0014829103',
      'واحد سازمانی': 'فناوری اطلاعات و هوش مصنوعی',
      'سمت شغلی': 'مهندس ارشد نرم‌افزار',
      'شماره حساب': 'IR420170000000109283746501',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'کارکرد / روز': 30.0,
      'ساعت اضافه‌کار': '24:00:00',
      'ساعت تعطیل کاری': '00:00:00',
      'حقوق پایه': 185000000,
      'حق تخصص': 100000000,
      'حق بن': 22000000,
      'حق مسکن': 30000000,
      'حق تاهل': 5000000,
      'حق اولاد': 14500000,
      'پایه سنوات': 30000000,
      'حق ماموریت': 0,
      'مبلغ اضافه‌کار': 36000000,
      'مبلغ تعطیل کاری': 0,
      'پاداش و کارانه': 45000000,
      'یک روز اضافه ماه': 12000000,
      'جمع حقوق و دستمزد': 479500000,
      'بیمه تامین اجتماعی': 19250000,
      'بیمه تکمیلی': 6820000,
      'مالیات حقوق': 16800000,
      'قسط وام': 15000000,
      'کسر کار': 0,
      'مساعده': 0,
      'ناهار': 20000000,
      'جمع کسورات': 77870000,
      'خالص پرداختی': 401630000,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `فیش حقوقی ${monthObj.name} ${year}`);
  XLSX.writeFile(workbook, `Payroll-Template-RSS-${year}-${String(month).padStart(2, '0')}.xlsx`);
}

/**
 * Parses an uploaded Excel (.xlsx / .xls / .csv) file into structured PayslipItem objects.
 * Scans ALL sheets in the workbook (1 to 100+ sheets), supporting both row/form-layout payslips
 * (like "فیش حقوقی پرسنل شرکت رویال صنعت سامانه" / باستان.xlsx) and multi-row tabular sheets.
 */
export async function parseExcelPayrollFile(
  file: File,
  defaultYear: number,
  defaultMonth: number
): Promise<Omit<PayslipItem, 'id' | 'createdAt'>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const result = parseExcelWorkbookCommon(workbook, defaultYear, defaultMonth, file.name);
  return result.payslips;
}

/**
 * Parses an uploaded PDF payslip file (single-page or multi-page Excel-exported PDF like "حقوق رویال 405.pdf")
 * via the server-side PDF stream scanner so every page's exact personnel code, name, and Rial amounts are extracted.
 */
export async function parsePdfPayrollFile(
  file: File,
  defaultYear: number,
  defaultMonth: number
): Promise<Omit<PayslipItem, 'id' | 'createdAt'>[]> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خطا در خواندن فایل PDF'));
    reader.readAsDataURL(file);
  });

  try {
    const res = await fetch('/api/payslips/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfDataUrl: dataUrl,
        fileName: file.name,
        defaultYear,
        defaultMonth,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.payslips) && data.payslips.length > 0) {
        return data.payslips;
      }
    }
  } catch (err) {
    console.error('Error parsing PDF on server:', err);
  }
  return [];
}

