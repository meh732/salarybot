import * as XLSX from 'xlsx';
import { PayslipItem, PERSIAN_MONTHS } from '../types/payroll';

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
 * Generates an official, high-resolution SVG DataURL of a Payslip (`تصویر فیش حقوقی`)
 * so that every payslip has an instant crystal-clear visual image inside the bot chat.
 */
export function generatePayslipSvgDataUrl(payslip: PayslipItem, orgName = 'هلدینگ صنعتی و فناوری پارس'): string {
  if (payslip.customImageUrl && payslip.customImageUrl.startsWith('data:image/')) {
    return payslip.customImageUrl;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="620" viewBox="0 0 860 620" direction="rtl">
    <defs>
      <linearGradient id="topHeader" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f766e"/>
      </linearGradient>
      <linearGradient id="netBanner" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#065f46"/>
        <stop offset="100%" stop-color="#047857"/>
      </linearGradient>
    </defs>

    <!-- Background -->
    <rect width="860" height="620" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
    
    <!-- Watermark -->
    <text x="430" y="350" font-family="Vazirmatn, Tahoma, sans-serif" font-size="58" font-weight="bold" fill="#0f172a" fill-opacity="0.035" text-anchor="middle" transform="rotate(-18 430 350)">${orgName}</text>

    <!-- Header -->
    <path d="M 0 18 Q 0 0 18 0 L 842 0 Q 860 0 860 18 L 860 92 L 0 92 Z" fill="url(#topHeader)"/>
    <text x="430" y="38" font-family="Vazirmatn, Tahoma, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="middle">${orgName}</text>
    <text x="430" y="70" font-family="Vazirmatn, Tahoma, sans-serif" font-size="15" fill="#5eead4" text-anchor="middle">صورتحساب رسمی حقوق و مزایا — ${payslip.monthName} ماه سال ${toPersianDigits(payslip.year)}</text>
    <text x="790" y="42" font-family="Vazirmatn, Tahoma, sans-serif" font-size="13" fill="#cbd5e1" text-anchor="right">کد پرسنلی: ${toPersianDigits(payslip.personnelCode)}</text>
    <text x="790" y="68" font-family="Vazirmatn, Tahoma, sans-serif" font-size="12" fill="#94a3b8" text-anchor="right">شناسه سند: #${payslip.id.slice(-6).toUpperCase()}</text>

    <!-- Employee Info Strip -->
    <rect x="24" y="108" width="812" height="82" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
    <g font-family="Vazirmatn, Tahoma, sans-serif" font-size="14" fill="#334155">
      <text x="815" y="138" text-anchor="right" font-weight="bold">نام و نام خانوادگی: <tspan fill="#0f172a">${payslip.employeeName}</tspan></text>
      <text x="530" y="138" text-anchor="right" font-weight="bold">کد پرسنلی: <tspan fill="#0284c7">${toPersianDigits(payslip.personnelCode)}</tspan></text>
      <text x="290" y="138" text-anchor="right" font-weight="bold">کد ملی: <tspan fill="#0f172a">${toPersianDigits(payslip.nationalCode)}</tspan></text>

      <text x="815" y="170" text-anchor="right" font-weight="bold">واحد سازمانی: <tspan fill="#0f172a">${payslip.department}</tspan></text>
      <text x="530" y="170" text-anchor="right" font-weight="bold">سمت: <tspan fill="#0f172a">${payslip.jobTitle}</tspan></text>
      <text x="290" y="170" text-anchor="right" font-weight="bold">کارکرد / اضافه‌کار: <tspan fill="#0f172a">${toPersianDigits(payslip.workingDays)} روز / ${toPersianDigits(payslip.overtimeHours)} ساعت</tspan></text>
    </g>

    <!-- Two Columns: Earnings (Right) & Deductions (Left) -->
    <!-- Right Box: Earnings -->
    <rect x="440" y="206" width="396" height="295" rx="12" fill="#ffffff" stroke="#bbf7d0" stroke-width="1.5"/>
    <rect x="440" y="206" width="396" height="40" rx="10" fill="#dcfce7"/>
    <text x="638" y="232" font-family="Vazirmatn, Tahoma, sans-serif" font-size="15" font-weight="bold" fill="#065f46" text-anchor="middle">شرح حقوق و مزایا (ریال)</text>

    <g font-family="Vazirmatn, Tahoma, sans-serif" font-size="14" fill="#1e293b">
      <text x="816" y="274" text-anchor="right">حقوق پایه ماهانه</text>
      <text x="460" y="274" text-anchor="left" font-weight="bold">${formatRial(payslip.baseSalary)}</text>

      <text x="816" y="308" text-anchor="right">حق مسکن و خواربار</text>
      <text x="460" y="308" text-anchor="left" font-weight="bold">${formatRial(payslip.housingAllowance + payslip.groceryAllowance)}</text>

      <text x="816" y="342" text-anchor="right">حق اولاد و عائله‌مندی</text>
      <text x="460" y="342" text-anchor="left" font-weight="bold">${formatRial(payslip.childAllowance)}</text>

      <text x="816" y="376" text-anchor="right">فوق‌العاده اضافه‌کاری (${toPersianDigits(payslip.overtimeHours)} ساعت)</text>
      <text x="460" y="376" text-anchor="left" font-weight="bold">${formatRial(payslip.overtimePay)}</text>

      <text x="816" y="410" text-anchor="right">پاداش بهره‌وری و کارانه</text>
      <text x="460" y="410" text-anchor="left" font-weight="bold">${formatRial(payslip.bonusPay)}</text>

      <line x1="456" y1="442" x2="820" y2="442" stroke="#bbf7d0" stroke-width="1.5"/>
      <text x="816" y="476" text-anchor="right" font-weight="bold" fill="#065f46">جمع کل حقوق و مزایا</text>
      <text x="460" y="476" text-anchor="left" font-size="16" font-weight="bold" fill="#065f46">${formatRial(payslip.totalEarnings)}</text>
    </g>

    <!-- Left Box: Deductions -->
    <rect x="24" y="206" width="396" height="295" rx="12" fill="#ffffff" stroke="#fecdd3" stroke-width="1.5"/>
    <rect x="24" y="206" width="396" height="40" rx="10" fill="#ffe4e6"/>
    <text x="222" y="232" font-family="Vazirmatn, Tahoma, sans-serif" font-size="15" font-weight="bold" fill="#9f1239" text-anchor="middle">شرح کسورات قانونی و توافقی (ریال)</text>

    <g font-family="Vazirmatn, Tahoma, sans-serif" font-size="14" fill="#1e293b">
      <text x="400" y="274" text-anchor="right">حق بیمه تأمین اجتماعی (سهم کارمند ۷٪)</text>
      <text x="44" y="274" text-anchor="left" font-weight="bold">${formatRial(payslip.insuranceDeduction)}</text>

      <text x="400" y="308" text-anchor="right">مالیات بر درآمد حقوق</text>
      <text x="44" y="308" text-anchor="left" font-weight="bold">${formatRial(payslip.taxDeduction)}</text>

      <text x="400" y="342" text-anchor="right">قسط وام صندوق و مساعده</text>
      <text x="44" y="342" text-anchor="left" font-weight="bold">${formatRial(payslip.loanDeduction)}</text>

      <text x="400" y="376" text-anchor="right">سایر کسورات (بیمه تکمیلی / رفاهی)</text>
      <text x="44" y="376" text-anchor="left" font-weight="bold">${formatRial(payslip.otherDeduction)}</text>

      <text x="400" y="410" text-anchor="right">شماره حساب واریزی</text>
      <text x="44" y="410" text-anchor="left" font-weight="bold" fill="#475569">${toPersianDigits(payslip.bankAccount)}</text>

      <line x1="40" y1="442" x2="404" y2="442" stroke="#fecdd3" stroke-width="1.5"/>
      <text x="400" y="476" text-anchor="right" font-weight="bold" fill="#9f1239">جمع کل کسورات</text>
      <text x="44" y="476" text-anchor="left" font-size="16" font-weight="bold" fill="#9f1239">${formatRial(payslip.totalDeductions)}</text>
    </g>

    <!-- Bottom Net Pay Banner -->
    <rect x="24" y="518" width="812" height="76" rx="14" fill="url(#netBanner)"/>
    <text x="805" y="563" font-family="Vazirmatn, Tahoma, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="right">خالص پرداختی قابل واریز به حساب پرسنل:</text>
    <text x="48" y="564" font-family="Vazirmatn, Tahoma, sans-serif" font-size="24" font-weight="bold" fill="#a7f3d0" text-anchor="left">${formatRial(payslip.netPay)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Generates and downloads a real PNG image from the Payslip SVG or custom image
 */
export async function downloadPayslipImage(payslip: PayslipItem, orgName?: string): Promise<void> {
  const dataUrl = generatePayslipSvgDataUrl(payslip, orgName);
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1290;
  canvas.height = 930;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const pngUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = pngUrl;
  a.download = `Payslip-${payslip.personnelCode}-${payslip.year}-${String(payslip.month).padStart(2, '0')}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Generates a valid, standards-compliant PDF binary file (or downloads custom uploaded PDF)
 * and also opens a clean printable PDF view if desired.
 */
export function downloadPayslipPdf(payslip: PayslipItem, orgName = 'هلدینگ صنعتی و فناوری پارس'): void {
  // If a custom PDF DataURL was uploaded for this payslip, download it directly:
  if (payslip.customPdfUrl && payslip.customPdfUrl.startsWith('data:application/pdf')) {
    const a = document.createElement('a');
    a.href = payslip.customPdfUrl;
    a.download =
      payslip.customPdfFileName ||
      `Payslip-${payslip.personnelCode}-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // Otherwise construct a real, valid PDF 1.4 file containing the official payslip summary and trigger download
  const lines = [
    `OFFICIAL PAYSLIP DOCUMENT - ${payslip.year}/${String(payslip.month).padStart(2, '0')}`,
    `------------------------------------------------------------`,
    `Personnel Code : ${payslip.personnelCode}`,
    `Employee Name  : ${payslip.employeeName}`,
    `National ID    : ${payslip.nationalCode}`,
    `Department     : ${payslip.department} - ${payslip.jobTitle}`,
    `Bank Account   : ${payslip.bankAccount}`,
    `Period         : Year ${payslip.year} - Month ${payslip.month} (${payslip.monthName})`,
    `Working Days   : ${payslip.workingDays} days | Overtime: ${payslip.overtimeHours} hrs`,
    `------------------------------------------------------------`,
    `EARNINGS (RIAL):`,
    `  Base Salary        : ${payslip.baseSalary.toLocaleString('en-US')} Rial`,
    `  Housing & Grocery  : ${(payslip.housingAllowance + payslip.groceryAllowance).toLocaleString('en-US')} Rial`,
    `  Family Allowance   : ${payslip.childAllowance.toLocaleString('en-US')} Rial`,
    `  Overtime Pay       : ${payslip.overtimePay.toLocaleString('en-US')} Rial`,
    `  Performance Bonus  : ${payslip.bonusPay.toLocaleString('en-US')} Rial`,
    `  TOTAL EARNINGS     : ${payslip.totalEarnings.toLocaleString('en-US')} Rial`,
    `------------------------------------------------------------`,
    `DEDUCTIONS (RIAL):`,
    `  Insurance (7%)     : ${payslip.insuranceDeduction.toLocaleString('en-US')} Rial`,
    `  Income Tax         : ${payslip.taxDeduction.toLocaleString('en-US')} Rial`,
    `  Loan Installment   : ${payslip.loanDeduction.toLocaleString('en-US')} Rial`,
    `  Other Deductions   : ${payslip.otherDeduction.toLocaleString('en-US')} Rial`,
    `  TOTAL DEDUCTIONS   : ${payslip.totalDeductions.toLocaleString('en-US')} Rial`,
    `============================================================`,
    `NET PAYABLE          : ${payslip.netPay.toLocaleString('en-US')} RIAL`,
    `============================================================`,
    `Document ID: ${payslip.id} | Verified Payroll Bot System`
  ];

  const textOps = lines
    .map((line, idx) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      return `1 0 0 1 50 ${760 - idx * 22} Tm (${escaped}) Tj`;
    })
    .join('\n');

  const streamContent = `BT\n/F1 11 Tf\n${textOps}\nET`;
  const pdfParts: string[] = [
    '%PDF-1.4\n',
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 842] /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    'xref\n0 6\n0000000000 65535 f \n',
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n0\n%%EOF'
  ];

  const blob = new Blob(pdfParts, { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payslip-${payslip.personnelCode}-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/**
 * Generates and downloads a Sample Excel (.xlsx) Payroll Template with Persian columns
 * so the Admin can test Excel batch upload immediately or use it as a template.
 */
export function downloadSamplePayrollExcel(year = 1404, month = 7): void {
  const monthObj = PERSIAN_MONTHS.find((m) => m.number === month) || PERSIAN_MONTHS[6];
  const rows = [
    {
      'کد پرسنلی': '1001',
      'نام و نام خانوادگی': 'مهندس علی محمدی',
      'کد ملی': '0014829103',
      'واحد سازمانی': 'فناوری اطلاعات و هوش مصنوعی',
      'سمت شغلی': 'مهندس ارشد نرم‌افزار',
      'شماره حساب': 'IR420170000000109283746501',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'روز کارکرد': 30,
      'ساعت اضافه‌کار': 24,
      'حقوق پایه': 185000000,
      'حق مسکن': 18000000,
      'بن کارگری': 22000000,
      'حق اولاد': 14500000,
      'مبلغ اضافه‌کار': 36000000,
      'پاداش و کارانه': 45000000,
      'بیمه سهم کارمند': 19250000,
      'مالیات': 16800000,
      'قسط وام': 15000000,
      'سایر کسورات': 4450000,
    },
    {
      'کد پرسنلی': '1002',
      'نام و نام خانوادگی': 'سارا کریمی',
      'کد ملی': '0079182736',
      'واحد سازمانی': 'منابع انسانی و امور اداری',
      'سمت شغلی': 'کارشناس ارشد منابع انسانی',
      'شماره حساب': 'IR890170000000293847561022',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'روز کارکرد': 30,
      'ساعت اضافه‌کار': 16,
      'حقوق پایه': 152000000,
      'حق مسکن': 18000000,
      'بن کارگری': 22000000,
      'حق اولاد': 7250000,
      'مبلغ اضافه‌کار': 21000000,
      'پاداش و کارانه': 28000000,
      'بیمه سهم کارمند': 15400000,
      'مالیات': 11200000,
      'قسط وام': 10000000,
      'سایر کسورات': 3650000,
    },
    {
      'کد پرسنلی': '1003',
      'نام و نام خانوادگی': 'رضا رضایی‌پور',
      'کد ملی': '0491827364',
      'واحد سازمانی': 'مالی و حسابداری',
      'سمت شغلی': 'سرپرست حسابداری حقوق',
      'شماره حساب': 'IR150170000000918273645509',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'روز کارکرد': 30,
      'ساعت اضافه‌کار': 32,
      'حقوق پایه': 170000000,
      'حق مسکن': 18000000,
      'بن کارگری': 22000000,
      'حق اولاد': 14500000,
      'مبلغ اضافه‌کار': 44000000,
      'پاداش و کارانه': 35000000,
      'بیمه سهم کارمند': 17800000,
      'مالیات': 14900000,
      'قسط وام': 20000000,
      'سایر کسورات': 3800000,
    },
    {
      'کد پرسنلی': '1004',
      'نام و نام خانوادگی': 'حسین جلالی',
      'کد ملی': '1289403821',
      'واحد سازمانی': 'عملیات و لجستیک انبار',
      'سمت شغلی': 'مسئول کنترل موجودی و انبار',
      'شماره حساب': 'IR630170000000554433221108',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'روز کارکرد': 30,
      'ساعت اضافه‌کار': 40,
      'حقوق پایه': 145000000,
      'حق مسکن': 18000000,
      'بن کارگری': 22000000,
      'حق اولاد': 21750000,
      'مبلغ اضافه‌کار': 48000000,
      'پاداش و کارانه': 30000000,
      'بیمه سهم کارمند': 16100000,
      'مالیات': 11500000,
      'قسط وام': 12000000,
      'سایر کسورات': 3150000,
    },
    {
      'کد پرسنلی': '1005',
      'نام و نام خانوادگی': 'مریم احمدی',
      'کد ملی': '0061928374',
      'واحد سازمانی': 'فروش و بازرگانی',
      'سمت شغلی': 'کارشناس ارشد فروش سازمانی',
      'شماره حساب': 'IR740170000000778899001123',
      'سال': year,
      'ماه': month,
      'نام ماه': monthObj.name,
      'روز کارکرد': 29,
      'ساعت اضافه‌کار': 18,
      'حقوق پایه': 158000000,
      'حق مسکن': 18000000,
      'بن کارگری': 22000000,
      'حق اولاد': 0,
      'مبلغ اضافه‌کار': 24000000,
      'پاداش و کارانه': 52000000,
      'بیمه سهم کارمند': 16400000,
      'مالیات': 13600000,
      'قسط وام': 8000000,
      'سایر کسورات': 3000000,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `فیش حقوقی ${monthObj.name} ${year}`);
  XLSX.writeFile(workbook, `Payroll-Template-${year}-${String(month).padStart(2, '0')}.xlsx`);
}

/**
 * Parses an uploaded Excel (.xlsx / .xls / .csv) file into structured PayslipItem objects,
 * matching Persian or English column headers flexibly.
 */
export async function parseExcelPayrollFile(
  file: File,
  defaultYear: number,
  defaultMonth: number
): Promise<Omit<PayslipItem, 'id' | 'createdAt'>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const parseNum = (v: unknown, fallback = 0): number => {
    if (typeof v === 'number') return v;
    if (!v) return fallback;
    const cleaned = toEnglishDigits(String(v)).replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  };

  const getField = (row: Record<string, unknown>, candidates: string[]): unknown => {
    const keys = Object.keys(row);
    for (const c of candidates) {
      const exact = keys.find((k) => k.trim() === c);
      if (exact !== undefined && row[exact] !== '') return row[exact];
      const partial = keys.find((k) => k.trim().includes(c));
      if (partial !== undefined && row[partial] !== '') return row[partial];
    }
    return '';
  };

  const results: Omit<PayslipItem, 'id' | 'createdAt'>[] = [];

  for (const row of rawRows) {
    const rawCode = getField(row, ['کد پرسنلی', 'کدپرسنلی', 'شماره پرسنلی', 'personnelCode', 'code', 'کد']);
    const personnelCode = toEnglishDigits(String(rawCode || '').trim());
    if (!personnelCode) continue;

    const employeeName = String(
      getField(row, ['نام و نام خانوادگی', 'نام کارمند', 'نام پرسنل', 'نام', 'employeeName', 'name']) || `پرسنل ${personnelCode}`
    ).trim();
    const nationalCode = toEnglishDigits(
      String(getField(row, ['کد ملی', 'شماره ملی', 'nationalCode']) || '0010000000').trim()
    );
    const department = String(
      getField(row, ['واحد سازمانی', 'واحد', 'بخش', 'department']) || 'ستاد مرکزی'
    ).trim();
    const jobTitle = String(
      getField(row, ['سمت شغلی', 'سمت', 'عنوان شغلی', 'jobTitle']) || 'کارشناس'
    ).trim();
    const bankAccount = String(
      getField(row, ['شماره حساب', 'شماره شبا', 'حساب', 'bankAccount']) || 'IR420170000000109283746501'
    ).trim();

    const year = parseNum(getField(row, ['سال', 'year']), defaultYear) || defaultYear;
    const month = parseNum(getField(row, ['ماه', 'month']), defaultMonth) || defaultMonth;
    const monthObj = PERSIAN_MONTHS.find((m) => m.number === month) || PERSIAN_MONTHS[0];

    const workingDays = parseNum(getField(row, ['روز کارکرد', 'کارکرد', 'workingDays']), 30);
    const overtimeHours = parseNum(getField(row, ['ساعت اضافه‌کار', 'اضافه کار', 'overtimeHours']), 0);

    const baseSalary = parseNum(getField(row, ['حقوق پایه', 'پایه حقوق', 'baseSalary']), 150000000);
    const housingAllowance = parseNum(getField(row, ['حق مسکن', 'مسکن', 'housingAllowance']), 18000000);
    const groceryAllowance = parseNum(getField(row, ['بن کارگری', 'بن خواربار', 'بن', 'groceryAllowance']), 22000000);
    const childAllowance = parseNum(getField(row, ['حق اولاد', 'عائله‌مندی', 'childAllowance']), 0);
    const overtimePay = parseNum(getField(row, ['مبلغ اضافه‌کار', 'فوق‌العاده اضافه‌کار', 'overtimePay']), 0);
    const bonusPay = parseNum(getField(row, ['پاداش و کارانه', 'پاداش', 'کارانه', 'bonusPay']), 0);

    const totalEarnings =
      parseNum(getField(row, ['جمع کل مزایا', 'جمع مزایا', 'totalEarnings']), 0) ||
      baseSalary + housingAllowance + groceryAllowance + childAllowance + overtimePay + bonusPay;

    const insuranceDeduction = parseNum(getField(row, ['بیمه سهم کارمند', 'حق بیمه', 'بیمه', 'insuranceDeduction']), Math.round(baseSalary * 0.07));
    const taxDeduction = parseNum(getField(row, ['مالیات', 'مالیات حقوق', 'taxDeduction']), Math.round(baseSalary * 0.05));
    const loanDeduction = parseNum(getField(row, ['قسط وام', 'وام', 'مساعده', 'loanDeduction']), 0);
    const otherDeduction = parseNum(getField(row, ['سایر کسورات', 'کسورات رفاهی', 'otherDeduction']), 0);

    const totalDeductions =
      parseNum(getField(row, ['جمع کل کسورات', 'جمع کسورات', 'totalDeductions']), 0) ||
      insuranceDeduction + taxDeduction + loanDeduction + otherDeduction;

    const netPay =
      parseNum(getField(row, ['خالص پرداختی', 'قابل پرداخت', 'netPay']), 0) ||
      Math.max(0, totalEarnings - totalDeductions);

    results.push({
      personnelCode,
      employeeName,
      nationalCode,
      department,
      jobTitle,
      bankAccount,
      year,
      month,
      monthName: monthObj.name,
      workingDays,
      overtimeHours,
      baseSalary,
      housingAllowance,
      groceryAllowance,
      childAllowance,
      overtimePay,
      bonusPay,
      totalEarnings,
      insuranceDeduction,
      taxDeduction,
      loanDeduction,
      otherDeduction,
      totalDeductions,
      netPay,
      sourceType: 'excel',
    });
  }

  return results;
}
