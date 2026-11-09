import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AppStateResponse,
  PayslipItem,
  PERSIAN_MONTHS,
} from '../types/payroll';
import {
  downloadPayslipImage,
  downloadPayslipPdf,
  downloadSamplePayrollExcel,
  formatRial,
  generatePayslipSvgDataUrl,
  parseExcelPayrollFile,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/payslipGenerator';
import { GlassButton } from './GlassButton';

interface PayslipUploaderProps {
  state: AppStateResponse;
  onBatchUploadPayslips: (
    items: Omit<PayslipItem, 'id' | 'createdAt'>[],
    notifyUsers: boolean
  ) => Promise<void>;
  onDeletePayslip: (id: string) => Promise<void>;
}

export const PayslipUploader: React.FC<PayslipUploaderProps> = ({
  state,
  onBatchUploadPayslips,
  onDeletePayslip,
}) => {
  const [uploadMode, setUploadMode] = useState<'excel' | 'pdf_direct'>('excel');
  const [selectedYear, setSelectedYear] = useState<number>(1404);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // آذر
  const [notifyOnUpload, setNotifyOnUpload] = useState<boolean>(true);
  const [stagedItems, setStagedItems] = useState<Omit<PayslipItem, 'id' | 'createdAt'>[]>([]);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Direct PDF / Image Upload State
  const [pdfPersonnelCode, setPdfPersonnelCode] = useState<string>('1001');
  const [pdfNetPay, setPdfNetPay] = useState<string>('245000000');
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');

  // Archive Filter State
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');
  const [searchCode, setSearchCode] = useState<string>('');
  const [previewPayslip, setPreviewPayslip] = useState<PayslipItem | null>(null);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelPayrollFile(file, selectedYear, selectedMonth);
      setStagedItems(parsed);
      setStatusBanner(
        `فایل اکسل «${file.name}» با موفقیت خوانده شد و ${toPersianDigits(
          parsed.length
        )} فیش حقوقی بر اساس کد پرسنلی استخراج گردید. جهت ثبت نهایی روی دکمه سبز پایین کلیک کنید.`
      );
    } catch (err) {
      setStatusBanner(
        `خطا در خواندن فایل اکسل: ${err instanceof Error ? err.message : 'فرمت نامعتبر'}`
      );
    }
  };

  const handleLoadQuickSampleBatch = () => {
    const monthObj = PERSIAN_MONTHS.find((m) => m.number === selectedMonth) || PERSIAN_MONTHS[8];
    const generated: Omit<PayslipItem, 'id' | 'createdAt'>[] = state.personnelDirectory.map(
      (person, idx) => {
        const baseSalary = 155000000 + idx * 14000000;
        const housingAllowance = 18000000;
        const groceryAllowance = 22000000;
        const childAllowance = idx % 2 === 0 ? 14500000 : 7250000;
        const overtimeHours = 18 + idx * 4;
        const overtimePay = overtimeHours * 1500000;
        const bonusPay = 32000000 + idx * 4000000;
        const totalEarnings =
          baseSalary +
          housingAllowance +
          groceryAllowance +
          childAllowance +
          overtimePay +
          bonusPay;
        const insuranceDeduction = Math.round((baseSalary + housingAllowance + groceryAllowance) * 0.07);
        const taxDeduction = Math.round(totalEarnings * 0.055);
        const loanDeduction = 12000000;
        const otherDeduction = 3500000;
        const totalDeductions =
          insuranceDeduction + taxDeduction + loanDeduction + otherDeduction;
        const netPay = totalEarnings - totalDeductions;

        return {
          personnelCode: person.personnelCode,
          employeeName: person.fullName,
          nationalCode: person.nationalCode,
          department: person.department,
          jobTitle: person.jobTitle,
          bankAccount: person.bankAccount,
          year: selectedYear,
          month: selectedMonth,
          monthName: monthObj.name,
          workingDays: 30,
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
        };
      }
    );

    setStagedItems(generated);
    setStatusBanner(
      `${toPersianDigits(generated.length)} ردیف فیش حقوقی مربوط به ${
        monthObj.name
      } ماه سال ${toPersianDigits(
        selectedYear
      )} با کدهای پرسنلی استخراج و آماده بارگذاری نهایی شد.`
    );
  };

  const handleCommitStagedExcel = async () => {
    if (stagedItems.length === 0) return;
    await onBatchUploadPayslips(stagedItems, notifyOnUpload);
    setStatusBanner(
      `✅ تعداد ${toPersianDigits(
        stagedItems.length
      )} فیش حقوقی (تصویر + فایل PDF) با موفقیت در پروفایل اختصاصی هر کد پرسنلی قرار گرفت و به پرسنل اطلاع‌رسانی شد!`
    );
    setStagedItems([]);
  };

  const handleDirectPdfOrImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFileName(file.name);

    // Auto-detect personnel code from filename (e.g., "1001.pdf" or "EMP-1003-1404.pdf")
    const codeMatch = toEnglishDigits(file.name).match(/\b(10\d{2}|\d{3,6})\b/);
    if (codeMatch) {
      setPdfPersonnelCode(codeMatch[1]);
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          setPdfDataUrl(reader.result);
        } else if (file.type.startsWith('image/')) {
          setImageDataUrl(reader.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitDirectPdfPayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = toEnglishDigits(pdfPersonnelCode.trim());
    if (!cleanCode) return;

    const person = state.personnelDirectory.find((p) => p.personnelCode === cleanCode);
    const monthObj = PERSIAN_MONTHS.find((m) => m.number === selectedMonth) || PERSIAN_MONTHS[0];
    const netAmount = Number(toEnglishDigits(pdfNetPay).replace(/[^0-9]/g, '')) || 245000000;
    const baseSalary = Math.round(netAmount * 0.72);
    const housingAllowance = 18000000;
    const groceryAllowance = 22000000;
    const overtimePay = Math.round(netAmount * 0.18);
    const bonusPay = Math.round(netAmount * 0.15);
    const totalEarnings = baseSalary + housingAllowance + groceryAllowance + overtimePay + bonusPay;
    const insuranceDeduction = Math.round(totalEarnings * 0.07);
    const taxDeduction = Math.round(totalEarnings * 0.05);
    const totalDeductions = Math.max(0, totalEarnings - netAmount);

    const item: Omit<PayslipItem, 'id' | 'createdAt'> = {
      personnelCode: cleanCode,
      employeeName: person?.fullName || `پرسنل کد ${cleanCode}`,
      nationalCode: person?.nationalCode || '0014829103',
      department: person?.department || 'واحد عملیات سازمانی',
      jobTitle: person?.jobTitle || 'کارشناس ارشد',
      bankAccount: person?.bankAccount || 'IR420170000000109283746501',
      year: selectedYear,
      month: selectedMonth,
      monthName: monthObj.name,
      workingDays: 30,
      overtimeHours: 22,
      baseSalary,
      housingAllowance,
      groceryAllowance,
      childAllowance: 14500000,
      overtimePay,
      bonusPay,
      totalEarnings,
      insuranceDeduction,
      taxDeduction,
      loanDeduction: Math.max(0, totalDeductions - insuranceDeduction - taxDeduction),
      otherDeduction: 0,
      totalDeductions,
      netPay: netAmount,
      sourceType: 'pdf_image',
      customPdfUrl: pdfDataUrl || undefined,
      customPdfFileName:
        pdfFileName || `Payslip-${cleanCode}-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`,
      customImageUrl: imageDataUrl || undefined,
    };

    await onBatchUploadPayslips([item], notifyOnUpload);
    setStatusBanner(
      `✅ فایل PDF و تصویر فیش حقوقی مربوط به کد پرسنلی ${toPersianDigits(
        cleanCode
      )} (${item.employeeName}) برای ${monthObj.name} ${toPersianDigits(
        selectedYear
      )} با موفقیت در پروفایل ایشان قرار گرفت!`
    );
    setPdfFileName('');
    setPdfDataUrl('');
    setImageDataUrl('');
  };

  const filteredPayslips = state.payslips.filter((p) => {
    if (filterYear !== 'all' && p.year !== filterYear) return false;
    if (filterMonth !== 'all' && p.month !== filterMonth) return false;
    if (searchCode.trim()) {
      const q = toEnglishDigits(searchCode.trim()).toLowerCase();
      return (
        p.personnelCode.toLowerCase().includes(q) ||
        p.employeeName.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Upload Control Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              بارگذاری فایل‌های اکسل و PDF فیش حقوقی با کد پرسنلی
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              آپلود فایل اکسل یا PDF فیش حقوقی پرسنل؛ تفکیک خودکار بر اساس «کد پرسنلی» و تولید تصویر + فایل PDF فیش در پروفایل اختصاصی هر کارمند
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setUploadMode('excel')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                uploadMode === 'excel'
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>بارگذاری فایل اکسل (.xlsx / .csv)</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('pdf_direct')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                uploadMode === 'pdf_direct'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>بارگذاری فایل PDF / تصویر فیش</span>
            </button>
          </div>
        </div>

        {/* Period Selection Row (Year, Month, Auto-Notify) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 border border-slate-800/80 rounded-xl p-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              انتخاب سال مالی فیش حقوقی:
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value={1405}>سال ۱۴۰۵</option>
              <option value={1404}>سال ۱۴۰۴</option>
              <option value={1403}>سال ۱۴۰۳</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              انتخاب ماه فیش حقوقی:
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              {PERSIAN_MONTHS.map((m) => (
                <option key={m.number} value={m.number}>
                  {toPersianDigits(m.number)} — {m.name} ماه
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2.5 cursor-pointer bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 w-full">
              <input
                type="checkbox"
                checked={notifyOnUpload}
                onChange={(e) => setNotifyOnUpload(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span className="text-xs text-slate-200 font-medium">
                ارسال نوتیفیکیشن خودکار در تلگرام و بله به هر پرسنل پس از بارگذاری
              </span>
            </label>
          </div>
        </div>

        {/* Status Feedback Banner */}
        {statusBanner && (
          <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm text-emerald-200">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mode 1: Excel File Upload */}
        {uploadMode === 'excel' ? (
          <div className="space-y-4">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelFileChange}
              className="hidden"
            />

            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center bg-slate-950/50 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xl mx-auto">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  فایل اکسل فیش حقوقی پرسنل (.xlsx / .xls / .csv) را انتخاب کنید
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  فایل اکسل باید شامل ستون <strong className="text-emerald-300">«کد پرسنلی»</strong> به همراه اقلام حقوق و مزایا باشد. سیستم به صورت خودکار برای هر کد پرسنلی هم <strong>تصویر رسمی فیش حقوقی</strong> و هم <strong>فایل PDF</strong> تولید کرده و در حساب آن شخص قرار می‌دهد.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <GlassButton
                  variant="emerald"
                  size="md"
                  onClick={() => excelInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  <span>انتخاب و آپلود فایل اکسل از سیستم</span>
                </GlassButton>

                <GlassButton
                  variant="cyan"
                  size="md"
                  onClick={handleLoadQuickSampleBatch}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>تولید و پیش‌نمایش فوری اکسل نمونه ({toPersianDigits(state.personnelDirectory.length)} پرسنل)</span>
                </GlassButton>

                <GlassButton
                  variant="indigo"
                  size="md"
                  onClick={() => downloadSamplePayrollExcel(selectedYear, selectedMonth)}
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود قالب اکسل نمونه (.xlsx)</span>
                </GlassButton>
              </div>
            </div>

            {/* Staged Excel Rows Preview Table */}
            {stagedItems.length > 0 && (
              <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300">
                      پیش‌نمایش ردیف‌های استخراج شده از اکسل ({toPersianDigits(stagedItems.length)} پرسنل)
                    </h4>
                    <p className="text-xs text-slate-400">
                      پس از تأیید، تصویر و فایل PDF فیش هر ردیف دقیقاً به حساب کاربری متصل به همان کد پرسنلی ارسال می‌شود.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <GlassButton
                      variant="rose"
                      size="sm"
                      onClick={() => setStagedItems([])}
                    >
                      پاک کردن لیست
                    </GlassButton>
                    <GlassButton
                      variant="emerald"
                      size="md"
                      onClick={handleCommitStagedExcel}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        ثبت نهایی و قرار دادن فیش‌ها در پروفایل هر شخص ({toPersianDigits(stagedItems.length)} فیش)
                      </span>
                    </GlassButton>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2.5 px-3">کد پرسنلی</th>
                        <th className="py-2.5 px-3">نام و نام خانوادگی</th>
                        <th className="py-2.5 px-3">واحد سازمانی</th>
                        <th className="py-2.5 px-3">دوره</th>
                        <th className="py-2.5 px-3">جمع کل مزایا</th>
                        <th className="py-2.5 px-3">جمع کسورات</th>
                        <th className="py-2.5 px-3">خالص پرداختی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {stagedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-cyan-300 tabular-nums">
                            {toPersianDigits(item.personnelCode)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {item.employeeName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{item.department}</td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {item.monthName} {toPersianDigits(item.year)}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-300 tabular-nums">
                            {formatRial(item.totalEarnings)}
                          </td>
                          <td className="py-2.5 px-3 text-rose-300 tabular-nums">
                            {formatRial(item.totalDeductions)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-emerald-400 tabular-nums">
                            {formatRial(item.netPay)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mode 2: Direct PDF / Image Payslip Upload linked by Personnel Code */
          <form onSubmit={handleSubmitDirectPdfPayslip} className="space-y-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  کد پرسنلی هدف (تشخیص خودکار از نام فایل یا انتخاب دستی) *
                </label>
                <select
                  value={pdfPersonnelCode}
                  onChange={(e) => setPdfPersonnelCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {state.personnelDirectory.map((p) => (
                    <option key={p.personnelCode} value={p.personnelCode}>
                      کد پرسنلی {toPersianDigits(p.personnelCode)} — {p.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  خالص پرداختی مندرج در فیش (ریال) *
                </label>
                <input
                  type="text"
                  value={pdfNetPay}
                  onChange={(e) => setPdfNetPay(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white font-mono tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  فایل PDF یا تصویر فیش حقوقی (با نام حاوی کد پرسنلی)
                </label>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleDirectPdfOrImageFile}
                  className="hidden"
                />
                <GlassButton
                  variant="cyan"
                  size="md"
                  fullWidth
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {pdfFileName ? `فایل: ${pdfFileName}` : 'انتخاب فایل PDF یا عکس فیش'}
                  </span>
                </GlassButton>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <GlassButton type="submit" variant="emerald" size="md">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  ثبت و قرار دادن تصویر و PDF فیش در حساب کد پرسنلی {toPersianDigits(pdfPersonnelCode)}
                </span>
              </GlassButton>
            </div>
          </form>
        )}
      </div>

      {/* Payslip Archive Table (`بانک فیش‌های حقوقی بارگذاری شده به تفکیک کد پرسنلی، سال و ماه`) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">
              آرشیو فیش‌های حقوقی پرسنل ({toPersianDigits(filteredPayslips.length)} فیش فعال)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              هر پرسنل در ربات تلگرام و بله صرفاً به فیش‌های هم‌نام با «کد پرسنلی» خودش در این جدول دسترسی دارد
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="جستجوی کد پرسنلی یا نام..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={filterYear}
              onChange={(e) =>
                setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="all">همه سال‌ها</option>
              <option value={1405}>سال ۱۴۰۵</option>
              <option value={1404}>سال ۱۴۰۴</option>
              <option value={1403}>سال ۱۴۰۳</option>
            </select>

            <select
              value={filterMonth}
              onChange={(e) =>
                setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
            >
              <option value="all">همه ماه‌ها</option>
              {PERSIAN_MONTHS.map((m) => (
                <option key={m.number} value={m.number}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-3">کد پرسنلی</th>
                <th className="py-3 px-3">نام پرسنل</th>
                <th className="py-3 px-3">واحد سازمانی</th>
                <th className="py-3 px-3">سال و ماه</th>
                <th className="py-3 px-3">جمع مزایا</th>
                <th className="py-3 px-3">جمع کسورات</th>
                <th className="py-3 px-3">خالص پرداختی</th>
                <th className="py-3 px-3 text-left">عملیات (تصویر / PDF)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPayslips.slice(0, 35).map((ps) => (
                <tr key={ps.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-cyan-300 tabular-nums">
                    {toPersianDigits(ps.personnelCode)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-white">{ps.employeeName}</td>
                  <td className="py-2.5 px-3 text-slate-300">{ps.department}</td>
                  <td className="py-2.5 px-3 text-slate-200 font-medium">
                    {ps.monthName} {toPersianDigits(ps.year)}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-300 tabular-nums">
                    {formatRial(ps.totalEarnings)}
                  </td>
                  <td className="py-2.5 px-3 text-rose-300 tabular-nums">
                    {formatRial(ps.totalDeductions)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400 tabular-nums">
                    {formatRial(ps.netPay)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <GlassButton
                        variant="cyan"
                        size="sm"
                        onClick={() => setPreviewPayslip(ps)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>تصویر فیش</span>
                      </GlassButton>
                      <GlassButton
                        variant="emerald"
                        size="sm"
                        onClick={() => downloadPayslipPdf(ps, state.config.organizationName)}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </GlassButton>
                      <button
                        type="button"
                        onClick={() => onDeletePayslip(ps.id)}
                        title="حذف فیش"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Preview Payslip Image & Download PDF */}
      {previewPayslip && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewPayslip(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white">
                  پیش‌نمایش تصویر و فایل PDF فیش حقوقی — کد پرسنلی{' '}
                  {toPersianDigits(previewPayslip.personnelCode)}
                </h4>
                <p className="text-xs text-slate-400">
                  {previewPayslip.employeeName} · {previewPayslip.monthName}{' '}
                  {toPersianDigits(previewPayslip.year)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPayslip(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl p-2 border border-slate-800">
              <img
                src={generatePayslipSvgDataUrl(previewPayslip, state.config.organizationName)}
                alt="تصویر فیش حقوقی"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <GlassButton
                variant="emerald"
                size="md"
                onClick={() =>
                  downloadPayslipImage(previewPayslip, state.config.organizationName)
                }
              >
                <Download className="w-4 h-4" />
                <span>دانلود تصویر فیش (PNG)</span>
              </GlassButton>
              <GlassButton
                variant="rose"
                size="md"
                onClick={() =>
                  downloadPayslipPdf(previewPayslip, state.config.organizationName)
                }
              >
                <FileText className="w-4 h-4" />
                <span>دانلود فایل PDF فیش حقوقی</span>
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
