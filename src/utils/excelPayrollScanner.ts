import * as XLSX from 'xlsx';
import { PayslipItem, PERSIAN_MONTHS } from '../types/payroll';

export function toEnglishDigitsCommon(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function parseNumberCommon(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (val === undefined || val === null) return fallback;
  const str = toEnglishDigitsCommon(String(val)).trim();
  if (!str || str === '-' || str === '.' || str === '—') return fallback;
  // Do not treat time strings like "114:33:00" or "2:41:00" as plain numbers
  if (str.includes(':')) return fallback;
  const cleaned = str.replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Converts Excel fractional day serial numbers (like 0.11180555555555556 -> "2:41:00"
 * or 4.772916666666667 -> "114:33:00") or raw time strings into clean "H:MM:SS" strings.
 */
export function formatExcelDurationCommon(val: unknown): string {
  if (val === undefined || val === null) return '';
  const str = toEnglishDigitsCommon(String(val)).trim();
  if (!str || str === '-' || str === '.' || str === '—') return '';
  if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(str)) {
    return str.split(':').length === 2 ? `${str}:00` : str;
  }
  const num = Number(str);
  if (Number.isFinite(num) && num >= 0 && num < 50) {
    if (num === 0) return '0:00:00';
    // If it has decimal fraction (Excel serial fraction of a 24h day)
    if (!Number.isInteger(num) || num < 1) {
      const totalSeconds = Math.round(num * 86400);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${num}:00:00`;
  }
  return '';
}

export interface ParsedPayrollResult {
  payslips: Omit<PayslipItem, 'id' | 'createdAt'>[];
  detectedColumns: string[];
  totalSheetsScanned: number;
}

const MONTH_NAMES = PERSIAN_MONTHS.map((m) => m.name);

export function containsPersianMonth(text: string): number | null {
  for (const m of PERSIAN_MONTHS) {
    const regex = new RegExp(`(^|[^آ-ی])${m.name}([^آ-ی]|$)`);
    if (regex.test(text)) {
      return m.number;
    }
  }
  return null;
}

function stripMonthAndYearText(text: string): string {
  let res = toEnglishDigitsCommon(text);
  for (const mName of MONTH_NAMES) {
    const rx1 = new RegExp(`${mName}\\s*1[34]\\d{2}`, 'g');
    const rx2 = new RegExp(`1[34]\\d{2}\\s*${mName}`, 'g');
    res = res.replace(rx1, ' ').replace(rx2, ' ');
  }
  return res;
}

/**
 * Extracts a clean, complete personnel code from a cell string.
 * Never truncates long codes (supports 2 to 20 digits, e.g., 14050609, 971050, 1001).
 */
export function extractCleanPersonnelCode(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  const cleaned = stripMonthAndYearText(String(raw))
    .replace(
      /شماره\s*پرسنلی|کد\s*پرسنلی|کدپرسنلی|شماره\s*پرسنل|کد\s*پرسنل|شماره\s*کارمند|کد\s*کارمند|personnel\s*code|code/gi,
      ' '
    )
    .replace(/[:：]/g, ' ')
    .trim();

  const compactDigits = cleaned.replace(/[,٬\s]/g, '');
  if (/^\d{2,20}$/.test(compactDigits)) {
    return compactDigits;
  }

  const matches = [...cleaned.matchAll(/\d{2,20}/g)].map((m) => m[0]);
  if (matches.length === 0) return '';

  // Prefer codes that are not a 4-digit solar year (1400-1499), unless that's the only number
  const nonYearMatches = matches.filter((m) => !(m.length === 4 && Number(m) >= 1400 && Number(m) <= 1499));
  const pool = nonYearMatches.length > 0 ? nonYearMatches : matches;
  pool.sort((a, b) => b.length - a.length);
  return pool[0];
}

/**
 * Universal, production-grade Excel payroll parser.
 * Supports:
 * 1. Multi-sheet workbooks (scans ALL sheets up to 100+ sheets, one or more employees per sheet).
 * 2. Row/Form-based layouts (like "فیش حقوقی پرسنل شرکت رویال صنعت سامانه" / باستان.xlsx)
 *    where "نام و نام خانوادگی" and "شماره پرسنلی" are in rows rather than column headers.
 * 3. Multiple stacked payslip forms inside a single sheet.
 * 4. Standard columnar tables (where each row is an employee).
 */
export function parseExcelWorkbookCommon(
  workbook: XLSX.WorkBook,
  defaultYear: number,
  defaultMonth: number,
  fileName = ''
): ParsedPayrollResult {
  const allPayslips: Omit<PayslipItem, 'id' | 'createdAt'>[] = [];
  const detectedColsSet = new Set<string>();
  const sheetNames = workbook.SheetNames || [];

  for (let sIdx = 0; sIdx < sheetNames.length; sIdx++) {
    const sheetName = sheetNames[sIdx];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const matrix2D = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    if (!matrix2D || matrix2D.length === 0) continue;

    // Step 1: Check if this sheet is a true multi-column tabular list
    if (isTrueTabularSheet(matrix2D)) {
      const tabularResult = tryParseTabularSheet(sheet, matrix2D, defaultYear, defaultMonth);
      if (tabularResult.items.length > 0) {
        tabularResult.detectedColumns.forEach((c) => detectedColsSet.add(c));
        allPayslips.push(...tabularResult.items);
        continue;
      }
    }

    // Step 2: Parse as Row/Form-Layout Payslip(s) (handles 1 or multiple payslips per sheet)
    const formPayslips = parseFormLayoutSheetBlocks(
      sheetName,
      matrix2D,
      defaultYear,
      defaultMonth,
      sheetNames.length === 1 ? fileName : ''
    );
    if (formPayslips.length > 0) {
      allPayslips.push(...formPayslips);
      detectedColsSet.add(`فیش فرمی (${sheetName})`);
      continue;
    }

    // Step 3: Fallback to tabular parser if form parser found nothing
    const fallbackTabular = tryParseTabularSheet(sheet, matrix2D, defaultYear, defaultMonth);
    if (fallbackTabular.items.length > 0) {
      fallbackTabular.detectedColumns.forEach((c) => detectedColsSet.add(c));
      allPayslips.push(...fallbackTabular.items);
    } else if (matrix2D[0]) {
      matrix2D[0]
        .map((c) => String(c || '').trim())
        .filter(Boolean)
        .forEach((c) => detectedColsSet.add(c));
    }
  }

  return {
    payslips: allPayslips,
    detectedColumns: Array.from(detectedColsSet),
    totalSheetsScanned: sheetNames.length,
  };
}

function isTrueTabularSheet(matrix2D: unknown[][]): boolean {
  let formMarkers = 0;
  for (let r = 0; r < Math.min(35, matrix2D.length); r++) {
    const rowStr = (matrix2D[r] || []).map((c) => String(c || '').trim()).join(' ');
    if (rowStr.includes('حقوق و دستمزد') && rowStr.includes('کسورات')) formMarkers += 2;
    if (rowStr.includes('بیمه تامین اجتماعی') && rowStr.includes('پایه')) formMarkers += 2;
    if (rowStr.includes('کارکرد / روز') || rowStr.includes('روز/ کارکرد') || rowStr.includes('یک روز اضافه ماه')) {
      formMarkers += 1;
    }
  }
  if (formMarkers >= 2) return false;

  for (let r = 0; r < Math.min(12, matrix2D.length); r++) {
    const cells = (matrix2D[r] || []).map((c) => toEnglishDigitsCommon(c).trim()).filter(Boolean);
    if (cells.length < 3) continue;

    const hasPureCodeHeader = cells.some(
      (c) =>
        (c === 'شماره پرسنلی' || c === 'کد پرسنلی' || c === 'کدپرسنلی' || c === 'personnelCode' || c === 'کد کارمند') &&
        !/\d/.test(c)
    );
    const hasPureNameHeader = cells.some(
      (c) =>
        (c === 'نام و نام خانوادگی' || c === 'نام کارمند' || c === 'نام پرسنل' || c === 'نام' || c === 'employeeName') &&
        !c.includes(':')
    );
    const hasSalaryHeader = cells.some(
      (c) =>
        c.includes('پایه') ||
        c.includes('خالص پرداختی') ||
        c.includes('مبلغ پرداختی') ||
        c.includes('جمع مزایا') ||
        c === 'baseSalary' ||
        c === 'netPay'
    );

    if (hasPureCodeHeader && hasPureNameHeader && hasSalaryHeader) {
      return true;
    }
  }
  return false;
}

export function parseFormLayoutSheetBlocks(
  sheetName: string,
  matrix2D: unknown[][],
  defaultYear: number,
  defaultMonth: number,
  fileName: string
): Omit<PayslipItem, 'id' | 'createdAt'>[] {
  const codeRowIndices: number[] = [];
  for (let r = 0; r < matrix2D.length; r++) {
    const row = matrix2D[r] || [];
    const hasCodeLabel = row.some((cell) => {
      const s = String(cell || '').trim();
      return (
        s.includes('شماره پرسنلی') ||
        s.includes('کد پرسنلی') ||
        s.includes('کدپرسنلی') ||
        s.includes('شماره پرسنل') ||
        s.includes('کد پرسنل') ||
        s.includes('شماره کارمند')
      );
    });
    if (hasCodeLabel) {
      if (codeRowIndices.length === 0 || r - codeRowIndices[codeRowIndices.length - 1] > 4) {
        codeRowIndices.push(r);
      }
    }
  }

  if (codeRowIndices.length <= 1) {
    const single = parseSingleFormBlock(sheetName, matrix2D, 0, matrix2D.length, defaultYear, defaultMonth, fileName);
    return single ? [single] : [];
  }

  const results: Omit<PayslipItem, 'id' | 'createdAt'>[] = [];
  for (let i = 0; i < codeRowIndices.length; i++) {
    const startRow = i === 0 ? 0 : Math.max(codeRowIndices[i - 1] + 2, codeRowIndices[i] - 3);
    const endRow =
      i + 1 < codeRowIndices.length
        ? Math.max(codeRowIndices[i] + 2, codeRowIndices[i + 1] - 3)
        : matrix2D.length;
    const item = parseSingleFormBlock(sheetName, matrix2D, startRow, endRow, defaultYear, defaultMonth, '');
    if (item) {
      results.push(item);
    }
  }
  return results;
}

function isPersianLabelCell(val: string): boolean {
  const s = val.trim();
  if (!s || s === '-' || s === '.' || s === '—') return false;
  if (s === 'ریال' || s === 'و') return false;
  return /[آ-ی]/.test(s);
}

function parseSingleFormBlock(
  sheetName: string,
  matrix2D: unknown[][],
  startRow: number,
  endRow: number,
  defaultYear: number,
  defaultMonth: number,
  fileName: string
): Omit<PayslipItem, 'id' | 'createdAt'> | null {
  let personnelCode = '';
  let employeeName = '';
  let nationalCode = '0010000000';
  let year = defaultYear;
  let month = defaultMonth;

  let baseSalary = 0;
  let specializationPay = 0;
  let groceryAllowance = 0;
  let housingAllowance = 0;
  let maritalAllowance = 0;
  let childAllowance = 0;
  let seniorityPay = 0;
  let missionPay = 0;
  let overtimePay = 0;
  let holidayPay = 0;
  let arrearsPay = 0;
  let servicePay = 0;
  let extraDayPay = 0;
  let bonusPay = 0;
  let totalEarnings = 0;

  let insuranceDeduction = 0;
  let supplementaryInsurance = 0;
  let taxDeduction = 0;
  let loanDeduction = 0;
  let lunchDeduction = 0;
  let otherDeduction = 0;
  let totalDeductions = 0;
  let netPay = 0;

  let workingDays = 30;
  let overtimeHoursStr = '';
  let holidayHoursStr = '';
  let leaveHoursStr = '-';

  // Determine sheet orientation using the boundary invariant:
  // In LTR sheets (where values are to the LEFT of Persian labels, i.e., col_value < col_label),
  // the first non-empty cell on data rows is a value (number or '-'), and the last is a label.
  // In RTL sheets (where values are to the RIGHT of Persian labels, i.e., col_value > col_label),
  // the first non-empty cell on data rows is a Persian label, and the last is a value.
  let leftVotes = 0;
  let rightVotes = 0;
  for (let r = startRow; r < endRow; r++) {
    const nonEmpty = (matrix2D[r] || [])
      .map((c) => String(c ?? '').trim())
      .filter((s) => s !== '' && s !== 'ریال' && s !== 'و');
    if (nonEmpty.length < 2) continue;

    const first = nonEmpty[0];
    const last = nonEmpty[nonEmpty.length - 1];
    const firstIsNumOrDash = first === '-' || parseNumberCommon(first, -1) > 0;
    const lastIsNumOrDash = last === '-' || parseNumberCommon(last, -1) > 0;
    const firstIsLabel = isPersianLabelCell(first);
    const lastIsLabel = isPersianLabelCell(last);

    if (firstIsNumOrDash && lastIsLabel) leftVotes += 2;
    if (firstIsLabel && lastIsNumOrDash) rightVotes += 2;
  }
  const primaryDir: -1 | 1 = leftVotes >= rightVotes ? -1 : 1;

  /**
   * Finds the value cell corresponding to label at (r, c) by scanning in primaryDir first,
   * stopping if it hits another Persian label cell. If the value cell is "-", returns 0 immediately.
   */
  const getFieldValueInRow = (r: number, c: number): { num: number; raw: string; found: boolean } => {
    const row = matrix2D[r] || [];
    const dirs = [primaryDir, (primaryDir * -1) as -1 | 1];

    for (const dir of dirs) {
      for (let step = 1; step <= 5; step++) {
        const idx = c + dir * step;
        if (idx < 0 || idx >= row.length) break;
        const cellStr = String(row[idx] ?? '').trim();
        if (!cellStr || cellStr === 'ریال' || cellStr === 'و') continue;
        if (isPersianLabelCell(cellStr)) {
          break;
        }
        if (cellStr === '-' || cellStr === '.' || cellStr === '—') {
          return { num: 0, raw: '-', found: true };
        }
        const n = parseNumberCommon(cellStr, NaN);
        if (!Number.isNaN(n)) {
          return { num: n, raw: toEnglishDigitsCommon(cellStr), found: true };
        }
        return { num: 0, raw: toEnglishDigitsCommon(cellStr), found: true };
      }
    }
    return { num: 0, raw: '', found: false };
  };

  const detectedTimeStrings: string[] = [];

  for (let r = startRow; r < endRow; r++) {
    const row = matrix2D[r] || [];

    // 1. Detect Month & Year and Time strings (HH:MM:SS) anywhere in the row
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      if (!cellVal) continue;
      const engVal = toEnglishDigitsCommon(cellVal);

      if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(engVal)) {
        detectedTimeStrings.push(engVal);
      }

      const mNum = containsPersianMonth(cellVal);
      if (mNum !== null) {
        month = mNum;
        const sameCellYear = engVal.match(/(?:^|\D)(14\d{2})(?:\D|$)/);
        if (sameCellYear) {
          year = Number(sameCellYear[1]);
        } else {
          for (const adj of [c - 1, c + 1, c - 2, c + 2]) {
            const adjStr = toEnglishDigitsCommon(row[adj]).trim();
            if (/^14\d{2}$/.test(adjStr)) {
              year = Number(adjStr);
              break;
            }
          }
        }
      }
    }

    // 2. Scan cells in row for Labels
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '').trim();
      if (!cellVal) continue;
      const engCell = toEnglishDigitsCommon(cellVal);

      // A) Personnel Code ("شماره پرسنلی" / "کد پرسنلی")
      if (
        cellVal.includes('شماره پرسنلی') ||
        cellVal.includes('کد پرسنلی') ||
        cellVal.includes('کدپرسنلی') ||
        cellVal.includes('شماره پرسنل') ||
        cellVal.includes('کد پرسنل') ||
        cellVal.includes('شماره کارمند') ||
        cellVal.includes('کد کارمند')
      ) {
        const sameCellCode = extractCleanPersonnelCode(cellVal);
        if (sameCellCode) {
          personnelCode = sameCellCode;
        } else {
          const candidates: { code: string; dist: number; isPreferredDir: boolean; isYearLike: boolean }[] = [];
          for (let col = 0; col < row.length; col++) {
            if (col === c) continue;
            const otherRaw = String(row[col] || '').trim();
            if (!otherRaw) continue;
            if (containsPersianMonth(otherRaw) !== null) continue;
            if (otherRaw.includes('نام') || otherRaw.includes('خانوادگی')) continue;

            const codeCand = extractCleanPersonnelCode(otherRaw);
            if (!codeCand) continue;

            const is4DigitYear = codeCand.length === 4 && Number(codeCand) >= 1400 && Number(codeCand) <= 1499;
            const nextToMonth =
              containsPersianMonth(String(row[col - 1] || '')) !== null ||
              containsPersianMonth(String(row[col + 1] || '')) !== null;

            candidates.push({
              code: codeCand,
              dist: Math.abs(col - c),
              isPreferredDir: Math.sign(col - c) === primaryDir,
              isYearLike: is4DigitYear && nextToMonth,
            });
          }

          if (candidates.length > 0) {
            candidates.sort((a, b) => {
              if (a.isYearLike !== b.isYearLike) return a.isYearLike ? 1 : -1;
              if (a.code.length !== b.code.length && (a.code.length >= 5 || b.code.length >= 5)) {
                return b.code.length - a.code.length;
              }
              if (a.dist !== b.dist) return a.dist - b.dist;
              if (a.isPreferredDir !== b.isPreferredDir) return a.isPreferredDir ? -1 : 1;
              return b.code.length - a.code.length;
            });
            personnelCode = candidates[0].code;
          } else {
            const belowCode = extractCleanPersonnelCode(matrix2D[r + 1]?.[c]);
            if (belowCode) personnelCode = belowCode;
          }
        }
      }

      // B) Employee Name ("نام و نام خانوادگی")
      if (
        cellVal.includes('نام و نام خانوادگی') ||
        cellVal.includes('نام پرسنل') ||
        cellVal.includes('نام کارمند') ||
        cellVal.startsWith('نام :') ||
        cellVal.startsWith('نام:') ||
        cellVal.endsWith(':نام و نام خانوادگی')
      ) {
        const stripped = cellVal
          .replace(/نام\s*و\s*نام\s*خانوادگی|نام\s*پرسنل|نام\s*کارمند|^نام/g, '')
          .replace(/شماره\s*پرسنلی.*$/g, '')
          .replace(/کد\s*پرسنلی.*$/g, '')
          .replace(/[:：]/g, '')
          .trim();

        if (stripped && /[آ-ی]/.test(stripped) && !stripped.includes('شرکت')) {
          employeeName = stripped;
        } else {
          const dirs = [primaryDir, (primaryDir * -1) as -1 | 1];
          for (const dir of dirs) {
            if (employeeName) break;
            for (let step = 1; step <= 5; step++) {
              const adjVal = String(row[c + dir * step] || '').trim();
              if (!adjVal) continue;
              if (
                /[آ-ی]/.test(adjVal) &&
                !adjVal.includes('شماره') &&
                !adjVal.includes('کد') &&
                containsPersianMonth(adjVal) === null
              ) {
                employeeName = adjVal.replace(/^[:：]\s*|\s*[:：]$/g, '').trim();
                break;
              }
            }
          }
        }
      }

      // C) National Code ("کد ملی" / "شماره ملی")
      if (cellVal.includes('کد ملی') || cellVal.includes('شماره ملی')) {
        const m = engCell.match(/\b(\d{8,10})\b/);
        if (m) {
          nationalCode = m[1];
        } else {
          const fv = getFieldValueInRow(r, c);
          if (fv.raw && /^\d{8,10}$/.test(fv.raw.replace(/\D/g, ''))) {
            nationalCode = fv.raw.replace(/\D/g, '');
          }
        }
      }

      // D) Financial Earnings
      if (cellVal === 'پایه' || cellVal === 'حقوق پایه' || cellVal === 'مزد پایه') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) baseSalary = fv.num;
      } else if (cellVal.includes('حق تخصص') || cellVal === 'تخصص' || cellVal.includes('فوق العاده شغل')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) specializationPay = fv.num;
      } else if (cellVal.includes('حق بن') || cellVal.includes('بن کارگری') || cellVal.includes('بن خواربار') || cellVal === 'بن') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) groceryAllowance = fv.num;
      } else if (cellVal.includes('حق مسکن') || cellVal === 'مسکن') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) housingAllowance = fv.num;
      } else if (cellVal.includes('حق تاهل') || cellVal.includes('حق تأهل') || cellVal === 'تاهل') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) maritalAllowance = fv.num;
      } else if (cellVal.includes('حق اولاد') || cellVal === 'اولاد') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) childAllowance = fv.num;
      } else if (cellVal.includes('پایه سنوات') || cellVal === 'سنوات') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) seniorityPay = fv.num;
      } else if (cellVal.includes('حق ماموریت') || cellVal.includes('حق مأموریت')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) missionPay = fv.num;
      } else if (cellVal === 'اضافه کار' || cellVal === 'اضافه‌کار' || cellVal.includes('مبلغ اضافه')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) {
          if (fv.raw.includes(':')) {
            overtimeHoursStr = fv.raw;
          } else if (fv.num > 1000) {
            overtimePay = fv.num;
          } else if (fv.num > 0 && !overtimeHoursStr) {
            overtimeHoursStr = formatExcelDurationCommon(fv.num) || String(fv.num);
          }
        }
        // Check r + 1 for vertically merged 2-row Attendance "اضافه کار" cell
        if (!overtimeHoursStr && r + 1 < endRow) {
          const nextRow = matrix2D[r + 1] || [];
          for (const step of [1, 2]) {
            const cand = nextRow[c + primaryDir * step];
            const dur = formatExcelDurationCommon(cand);
            if (dur) {
              overtimeHoursStr = dur;
              break;
            }
          }
        }
      } else if (cellVal === 'تعطیل کاری' || cellVal === 'تعطیل‌کاری' || cellVal.includes('مبلغ تعطیل')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) {
          if (fv.raw.includes(':')) {
            holidayHoursStr = fv.raw;
          } else if (fv.num > 1000) {
            holidayPay = fv.num;
          } else if (fv.num >= 0 && fv.raw !== '-' && !holidayHoursStr) {
            holidayHoursStr = formatExcelDurationCommon(fv.num) || String(fv.num);
          }
        }
        // Check r + 1 for vertically merged 2-row Attendance "تعطیل کاری" cell
        if (!holidayHoursStr && r + 1 < endRow) {
          const nextRow = matrix2D[r + 1] || [];
          for (const step of [1, 2]) {
            const cand = nextRow[c + primaryDir * step];
            const dur = formatExcelDurationCommon(cand);
            if (dur) {
              holidayHoursStr = dur;
              break;
            }
          }
        }
      } else if (cellVal === 'معوقه' || cellVal.includes('معوقات')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) arrearsPay = fv.num;
      } else if (cellVal === 'سرویس' || cellVal.includes('حق سرویس') || cellVal.includes('ایاب و ذهاب')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) servicePay = fv.num;
      } else if (cellVal.includes('یک روز اضافه ماه') || cellVal.includes('اضافه ماه')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) extraDayPay = fv.num;
      } else if (cellVal === 'کارانه' || cellVal === 'پاداش' || cellVal.includes('پاداش')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) bonusPay += fv.num;
      }

      // E) Deductions
      if (cellVal.includes('بیمه تامین اجتماعی') || cellVal.includes('بیمه تأمین اجتماعی') || cellVal === 'حق بیمه') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) insuranceDeduction = fv.num;
      } else if (cellVal.includes('بیمه تکمیلی')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) supplementaryInsurance = fv.num;
      } else if (cellVal.includes('مالیات حقوق') || cellVal === 'مالیات') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) taxDeduction = fv.num;
      } else if (cellVal.includes('قسط وام') || cellVal === 'وام') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) loanDeduction = fv.num;
      } else if (cellVal === 'ناهار' || cellVal.includes('کسر ناهار') || cellVal.includes('غذا')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found) lunchDeduction = fv.num;
      } else if (cellVal === 'مساعده' || cellVal === 'کسر کار' || cellVal === 'کسرکار') {
        const fv = getFieldValueInRow(r, c);
        if (fv.found && fv.num > 1000) {
          otherDeduction += fv.num;
        }
      }

      // F) Attendance (supports 2-row merged cells where value is on r or r + 1)
      if (cellVal.includes('کارکرد / روز') || cellVal.includes('روز/ کارکرد') || cellVal.includes('کارکرد روز')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found && fv.num > 0 && fv.num <= 366) {
          workingDays = fv.num;
        } else if (r + 1 < endRow) {
          const nextRow = matrix2D[r + 1] || [];
          for (let col = nextRow.length - 1; col >= 0; col--) {
            const n = parseNumberCommon(nextRow[col], 0);
            if (n > 0 && n <= 366) {
              workingDays = n;
              break;
            }
          }
        }
      } else if (cellVal.includes('مانده مرخصی')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found && fv.raw) {
          leaveHoursStr = fv.raw;
        }
      }

      // G) Net Pay
      if (cellVal.includes('خالص پرداختی') || cellVal.includes('مبلغ پرداختی') || cellVal.includes('خالص دریافتی')) {
        const fv = getFieldValueInRow(r, c);
        if (fv.found && fv.num > 0) {
          netPay = fv.num;
        } else {
          for (let col = 0; col < row.length; col++) {
            const n = parseNumberCommon(row[col], 0);
            if (n > netPay) netPay = n;
          }
        }
      }
    }
  }

  if (!overtimeHoursStr && detectedTimeStrings.length >= 1) {
    overtimeHoursStr = detectedTimeStrings[0];
  }
  if (!holidayHoursStr && detectedTimeStrings.length >= 2) {
    holidayHoursStr = detectedTimeStrings[1];
  }

  if (!personnelCode) {
    const fromSheet = extractCleanPersonnelCode(sheetName);
    if (fromSheet) {
      personnelCode = fromSheet;
    } else if (fileName) {
      const fromFile = extractCleanPersonnelCode(fileName.replace(/\.[^.]+$/, ''));
      if (
        fromFile &&
        fromFile !== '405' &&
        !(fromFile.length === 4 && Number(fromFile) >= 1400 && Number(fromFile) <= 1499)
      ) {
        personnelCode = fromFile;
      }
    }
  }

  if (!employeeName) {
    const cleanSheet = sheetName.replace(/[0-9۰-۹_-]/g, '').trim();
    if (cleanSheet.length >= 2 && !/sheet|page/i.test(cleanSheet) && !cleanSheet.includes('فیش')) {
      employeeName = cleanSheet;
    } else if (fileName) {
      const cleanFile = fileName
        .replace(/\.[^.]+$/, '')
        .replace(/فیش|حقوقی|حقوق|رویال|صنعت|سامانه|[0-9۰-۹_-]/g, '')
        .trim();
      if (cleanFile.length >= 2) {
        employeeName = cleanFile;
      }
    }
    if (!employeeName && personnelCode) {
      employeeName = `پرسنل ${personnelCode}`;
    }
  }

  if (!personnelCode) {
    return null;
  }

  bonusPay += arrearsPay + servicePay;

  const calculatedEarnings =
    baseSalary +
    specializationPay +
    groceryAllowance +
    housingAllowance +
    maritalAllowance +
    childAllowance +
    seniorityPay +
    missionPay +
    overtimePay +
    holidayPay +
    extraDayPay +
    bonusPay;

  const calculatedDeductions =
    insuranceDeduction +
    supplementaryInsurance +
    taxDeduction +
    loanDeduction +
    lunchDeduction +
    otherDeduction;

  totalEarnings = calculatedEarnings;
  totalDeductions = calculatedDeductions;

  if (!netPay && totalEarnings > 0) {
    netPay = Math.max(0, totalEarnings - totalDeductions);
  } else if (netPay > 0 && totalEarnings === 0) {
    totalEarnings = netPay + totalDeductions;
    if (baseSalary === 0) baseSalary = netPay;
  }

  const monthObj = PERSIAN_MONTHS.find((m) => m.number === month) || PERSIAN_MONTHS[0];

  return {
    personnelCode,
    employeeName: employeeName || `پرسنل ${personnelCode}`,
    nationalCode,
    department: 'شرکت رویال صنعت سامانه',
    jobTitle: 'پرسنل شرکت',
    bankAccount: 'IR420170000000109283746501',
    year,
    month,
    monthName: monthObj.name,
    workingDays,
    overtimeHours: parseNumberCommon(overtimeHoursStr.split(':')[0], 0),
    overtimeHoursStr: overtimeHoursStr || '0:00:00',
    holidayHoursStr: holidayHoursStr || '0:00:00',
    leaveHoursStr: leaveHoursStr || '-',
    baseSalary,
    specializationPay,
    housingAllowance,
    groceryAllowance,
    maritalAllowance,
    childAllowance,
    seniorityPay,
    missionPay,
    overtimePay,
    holidayPay,
    extraDayPay,
    bonusPay,
    totalEarnings,
    insuranceDeduction,
    supplementaryInsurance,
    taxDeduction,
    loanDeduction,
    lunchDeduction,
    otherDeduction,
    totalDeductions,
    netPay,
    sourceType: 'excel',
  };
}

function tryParseTabularSheet(
  sheet: XLSX.WorkSheet,
  matrix2D: unknown[][],
  defaultYear: number,
  defaultMonth: number
): { items: Omit<PayslipItem, 'id' | 'createdAt'>[]; detectedColumns: string[] } {
  const items: Omit<PayslipItem, 'id' | 'createdAt'>[] = [];
  const detectedColumns: string[] = [];

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

  const processRows = (rawRows: Record<string, unknown>[]) => {
    for (const row of rawRows) {
      const rawCode = getField(row, [
        'شماره پرسنلی',
        'کد پرسنلی',
        'کدپرسنلی',
        'personnelCode',
        'code',
        'کد کارمند',
        'شماره کارمند',
        'کد',
      ]);
      const personnelCode = extractCleanPersonnelCode(rawCode);
      if (!personnelCode) continue;

      const employeeName = String(
        getField(row, ['نام و نام خانوادگی', 'نام کارمند', 'نام پرسنل', 'نام', 'employeeName', 'name']) ||
          `پرسنل ${personnelCode}`
      ).trim();

      const nationalCode = toEnglishDigitsCommon(
        String(getField(row, ['کد ملی', 'شماره ملی', 'nationalCode']) || '0010000000').trim()
      );
      const department = String(
        getField(row, ['واحد سازمانی', 'واحد', 'بخش', 'department']) || 'شرکت رویال صنعت سامانه'
      ).trim();
      const jobTitle = String(
        getField(row, ['سمت شغلی', 'سمت', 'عنوان شغلی', 'jobTitle']) || 'کارشناس'
      ).trim();
      const bankAccount = String(
        getField(row, ['شماره حساب', 'شماره شبا', 'حساب', 'bankAccount']) || 'IR420170000000109283746501'
      ).trim();

      const year = parseNumberCommon(getField(row, ['سال', 'year']), defaultYear) || defaultYear;
      const month = parseNumberCommon(getField(row, ['ماه', 'month']), defaultMonth) || defaultMonth;
      const monthObj = PERSIAN_MONTHS.find((m) => m.number === month) || PERSIAN_MONTHS[0];

      const workingDays = parseNumberCommon(getField(row, ['کارکرد / روز', 'روز کارکرد', 'کارکرد', 'workingDays']), 30);
      const overtimeHoursStr = String(getField(row, ['ساعت اضافه‌کار', 'اضافه کار ساعت', 'overtimeHoursStr']) || '').trim();
      const holidayHoursStr = String(getField(row, ['ساعت تعطیل کاری', 'تعطیل کاری ساعت', 'holidayHoursStr']) || '').trim();
      const leaveHoursStr = String(getField(row, ['مانده مرخصی', 'مرخصی ساعت', 'leaveHoursStr']) || '').trim();
      const overtimeHours = parseNumberCommon(getField(row, ['ساعت اضافه‌کار عددی', 'overtimeHours']), 0);

      const baseSalary = parseNumberCommon(getField(row, ['حقوق پایه', 'پایه', 'baseSalary']), 0);
      const specializationPay = parseNumberCommon(getField(row, ['حق تخصص', 'تخصص', 'specializationPay']), 0);
      const groceryAllowance = parseNumberCommon(getField(row, ['حق بن', 'بن کارگری', 'بن', 'groceryAllowance']), 0);
      const housingAllowance = parseNumberCommon(getField(row, ['حق مسکن', 'housingAllowance']), 0);
      const maritalAllowance = parseNumberCommon(getField(row, ['حق تاهل', 'maritalAllowance']), 0);
      const childAllowance = parseNumberCommon(getField(row, ['حق اولاد', 'childAllowance']), 0);
      const seniorityPay = parseNumberCommon(getField(row, ['پایه سنوات', 'سنوات', 'seniorityPay']), 0);
      const missionPay = parseNumberCommon(getField(row, ['حق ماموریت', 'ماموریت', 'missionPay']), 0);
      const overtimePay = parseNumberCommon(getField(row, ['اضافه کار', 'مبلغ اضافه‌کار', 'overtimePay']), 0);
      const holidayPay = parseNumberCommon(getField(row, ['تعطیل کاری', 'مبلغ تعطیل‌کاری', 'holidayPay']), 0);
      const extraDayPay = parseNumberCommon(getField(row, ['یک روز اضافه ماه', 'اضافه ماه', 'extraDayPay']), 0);
      const bonusPay = parseNumberCommon(getField(row, ['پاداش', 'کارانه', 'bonusPay']), 0);

      const totalEarningsCalc =
        baseSalary +
        specializationPay +
        groceryAllowance +
        housingAllowance +
        maritalAllowance +
        childAllowance +
        seniorityPay +
        missionPay +
        overtimePay +
        holidayPay +
        extraDayPay +
        bonusPay;

      const totalEarnings =
        parseNumberCommon(getField(row, ['جمع کل مزایا', 'جمع مزایا', 'حقوق و دستمزد', 'totalEarnings']), 0) ||
        totalEarningsCalc;

      const insuranceDeduction = parseNumberCommon(
        getField(row, ['بیمه تامین اجتماعی', 'حق بیمه', 'insuranceDeduction']),
        0
      );
      const supplementaryInsurance = parseNumberCommon(
        getField(row, ['بیمه تکمیلی', 'supplementaryInsurance']),
        0
      );
      const taxDeduction = parseNumberCommon(getField(row, ['مالیات حقوق', 'مالیات', 'taxDeduction']), 0);
      const loanDeduction = parseNumberCommon(getField(row, ['قسط وام', 'وام', 'loanDeduction']), 0);
      const lunchDeduction = parseNumberCommon(getField(row, ['کسر ناهار', 'ناهار', 'lunchDeduction']), 0);
      const otherDeduction = parseNumberCommon(getField(row, ['سایر کسورات', 'مساعده', 'کسر کار', 'otherDeduction']), 0);

      const totalDeductionsCalc =
        insuranceDeduction +
        supplementaryInsurance +
        taxDeduction +
        loanDeduction +
        lunchDeduction +
        otherDeduction;

      const totalDeductions =
        parseNumberCommon(getField(row, ['جمع کل کسورات', 'جمع کسورات', 'کسورات', 'totalDeductions']), 0) ||
        totalDeductionsCalc;

      const netPay =
        parseNumberCommon(getField(row, ['خالص پرداختی', 'مبلغ پرداختی', 'netPay']), 0) ||
        Math.max(0, totalEarnings - totalDeductions);

      if (baseSalary === 0 && totalEarnings === 0 && netPay === 0) continue;

      items.push({
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
        overtimeHoursStr: overtimeHoursStr || '0:00:00',
        holidayHoursStr: holidayHoursStr || '0:00:00',
        leaveHoursStr: leaveHoursStr || '-',
        baseSalary,
        specializationPay,
        housingAllowance,
        groceryAllowance,
        maritalAllowance,
        childAllowance,
        seniorityPay,
        missionPay,
        overtimePay,
        holidayPay,
        extraDayPay,
        bonusPay,
        totalEarnings,
        insuranceDeduction,
        supplementaryInsurance,
        taxDeduction,
        loanDeduction,
        lunchDeduction,
        otherDeduction,
        totalDeductions,
        netPay,
        sourceType: 'excel',
      });
    }
  };

  const directRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (directRows.length > 0) {
    detectedColumns.push(...Object.keys(directRows[0]));
    processRows(directRows);
    if (items.length > 0) return { items, detectedColumns };
  }

  for (let rIdx = 0; rIdx < Math.min(15, matrix2D.length); rIdx++) {
    const rowCells = (matrix2D[rIdx] || []).map((c) => String(c || '').trim());
    const hasHeaderKey = rowCells.some(
      (cell) =>
        cell === 'شماره پرسنلی' ||
        cell === 'کد پرسنلی' ||
        cell === 'کدپرسنلی' ||
        cell === 'personnelCode'
    );

    if (hasHeaderKey) {
      const rawRowsOffset = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: rIdx, defval: '' });
      if (rawRowsOffset.length > 0) {
        detectedColumns.push(...Object.keys(rawRowsOffset[0]));
        processRows(rawRowsOffset);
        if (items.length > 0) return { items, detectedColumns };
      }
    }
  }

  return { items, detectedColumns };
}
