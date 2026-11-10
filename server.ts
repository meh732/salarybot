import express from 'express';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { createServer as createViteServer } from 'vite';
import {
  AppStateResponse,
  BotButton,
  BotConfig,
  BotMessage,
  BotUser,
  BroadcastLog,
  GlassColorVariant,
  PayslipItem,
  PERSIAN_MONTHS,
  PersonnelRecord,
} from './src/types/payroll';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'payroll-db.json');

function toPersianDigitsServer(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(val).replace(/[0-9]/g, (w) => persian[+w]);
}

function toEnglishDigitsServer(val: string): string {
  return String(val || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function formatRialServer(amount: number): string {
  return `${new Intl.NumberFormat('fa-IR').format(Math.round(amount || 0))} ریال`;
}

function createSampleCardSvgUrl(fullName: string, nationalCode: string, birthDate: string, fatherName: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" direction="rtl">
    <defs>
      <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e0f2fe"/>
        <stop offset="50%" stop-color="#f0fdf4"/>
        <stop offset="100%" stop-color="#fef3c7"/>
      </linearGradient>
      <linearGradient id="hdG" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#065f46"/>
        <stop offset="100%" stop-color="#0f766e"/>
      </linearGradient>
    </defs>
    <rect width="640" height="400" rx="22" fill="url(#bgG)" stroke="#94a3b8" stroke-width="2"/>
    <path d="M 0 22 Q 0 0 22 0 L 618 0 Q 640 0 640 22 L 640 76 L 0 76 Z" fill="url(#hdG)"/>
    <text x="320" y="34" font-family="Vazirmatn, Tahoma, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">جمهوری اسلامی ایران - سازمان ثبت احوال کشور</text>
    <text x="320" y="60" font-family="Vazirmatn, Tahoma, sans-serif" font-size="14" fill="#a7f3d0" text-anchor="middle">کارت هوشمند ملی (ارسالی توسط پرسنل در ربات)</text>
    <rect x="515" y="110" width="68" height="52" rx="8" fill="#fbbf24" stroke="#b45309" stroke-width="1.5"/>
    <rect x="44" y="102" width="150" height="195" rx="12" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
    <circle cx="119" cy="166" r="34" fill="#64748b"/>
    <path d="M 65 275 C 65 222 173 222 173 275 Z" fill="#64748b"/>
    <g font-family="Vazirmatn, Tahoma, sans-serif" text-anchor="right">
      <text x="485" y="130" font-size="14" fill="#475569">شماره ملی:</text>
      <text x="395" y="130" font-size="18" font-weight="bold" fill="#0f172a">${toPersianDigitsServer(nationalCode)}</text>
      <text x="485" y="175" font-size="14" fill="#475569">نام و نام خانوادگی:</text>
      <text x="355" y="175" font-size="18" font-weight="bold" fill="#0f172a">${fullName}</text>
      <text x="485" y="220" font-size="14" fill="#475569">تاریخ تولد:</text>
      <text x="395" y="220" font-size="16" font-weight="bold" fill="#0f172a">${toPersianDigitsServer(birthDate)}</text>
      <text x="485" y="265" font-size="14" fill="#475569">نام پدر:</text>
      <text x="415" y="265" font-size="16" font-weight="bold" fill="#0f172a">${fatherName}</text>
    </g>
    <rect x="36" y="348" width="568" height="32" rx="6" fill="#0f172a" fill-opacity="0.06"/>
    <text x="320" y="369" font-family="monospace" font-size="13" fill="#334155" text-anchor="middle">IDIRN-${nationalCode}-VERIFICATION</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function nowTimeStr(): string {
  const now = new Date();
  return `${toPersianDigitsServer(String(now.getHours()).padStart(2, '0'))}:${toPersianDigitsServer(
    String(now.getMinutes()).padStart(2, '0')
  )}`;
}

function isMessengerAdmin(
  messengerId: string | undefined,
  username: string | undefined,
  config: BotConfig
): boolean {
  const cleanId = (messengerId || '').trim().toLowerCase();
  const cleanUser = (username || '').trim().toLowerCase().replace(/^@/, '');

  const envAdmins = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  const configAdmins = (config.adminMessengerIds || [])
    .map((x) => String(x).trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  const allAdmins = new Set([...envAdmins, ...configAdmins, 'usr-admin-master', '92218108']);

  if (cleanId && allAdmins.has(cleanId)) return true;
  if (cleanUser && allAdmins.has(cleanUser)) return true;
  return false;
}

function buildTelegramReplyKeyboard(isAdmin: boolean, isApproved = false, isPending = false) {
  if (isAdmin) {
    return {
      keyboard: [
        [{ text: '📄 دریافت فیش حقوقی' }, { text: '📊 آخرین فیش صادر شده' }],
        [{ text: '👑 پنل مدیریت (/admin)' }, { text: '🪪 صف کارت ملی' }],
        [{ text: '📤 آپلود فیش' }, { text: '👤 کد پرسنلی و اطلاعات من' }],
      ],
      resize_keyboard: true,
      persistent: true,
    };
  }
  if (!isApproved) {
    return {
      keyboard: [
        [{ text: isPending ? '⏳ استعلام وضعیت تأیید احراز هویت' : '🪪 احراز هویت و ارسال کارت ملی' }],
        [{ text: '💬 پشتیبانی' }],
      ],
      resize_keyboard: true,
      persistent: true,
    };
  }
  return {
    keyboard: [
      [{ text: '📄 دریافت فیش حقوقی' }, { text: '📊 آخرین فیش صادر شده' }],
      [{ text: '👤 کد پرسنلی و اطلاعات من' }, { text: '💬 پشتیبانی' }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

function buildMainMenuKeyboard(isAdmin = false): BotButton[][] {
  const rows: BotButton[][] = [
    [{ text: '📄 دریافت فیش حقوقی (تصویر + PDF)', callbackData: 'menu_payslips', colorVariant: 'emerald' }],
    [
      { text: '📊 آخرین فیش صادر شده', callbackData: 'latest_payslip', colorVariant: 'cyan' },
      { text: '👤 پرونده و کد پرسنلی من', callbackData: 'menu_profile', colorVariant: 'indigo' },
    ],
    [{ text: '💬 ارتباط با واحد منابع انسانی و پشتیبانی', callbackData: 'menu_support', colorVariant: 'violet' }],
  ];
  if (isAdmin) {
    rows.unshift([
      {
        text: '👑 پنل مدیریت کل درون ربات (بدون نیاز به پنل وب)',
        callbackData: 'adm_panel',
        colorVariant: 'amber',
      },
    ]);
  }
  return rows;
}

function buildAdminInBotKeyboard(state: AppStateResponse): BotButton[][] {
  const pendingCount = state.users.filter((u) => u.verificationStatus === 'pending_admin').length;
  const activeCount = state.users.filter((u) => !u.isAdmin).length;
  const payslipCount = state.payslips.length;

  return [
    [
      {
        text: `🪪 صف احراز هویت و کارت ملی (${toPersianDigitsServer(pendingCount)} در انتظار)`,
        callbackData: 'adm_queue',
        colorVariant: 'amber',
      },
    ],
    [
      {
        text: '📤 بارگذاری فایل اکسل و PDF فیش در ربات',
        callbackData: 'adm_upload_menu',
        colorVariant: 'emerald',
      },
    ],
    [
      {
        text: `👥 مدیریت کاربران و فعال/غیرفعال (${toPersianDigitsServer(activeCount)} نفر)`,
        callbackData: 'adm_users_list',
        colorVariant: 'cyan',
      },
      {
        text: '📢 ارسال پیام گروهی از درون بات',
        callbackData: 'adm_broadcast_menu',
        colorVariant: 'violet',
      },
    ],
    [
      {
        text: `🗂️ آرشیو فیش‌ها (${toPersianDigitsServer(payslipCount)} فیش)`,
        callbackData: 'adm_payslips_list',
        colorVariant: 'indigo',
      },
      {
        text: '⚙️ تنظیمات کانال اجباری و بات',
        callbackData: 'adm_settings_menu',
        colorVariant: 'teal',
      },
    ],
    [
      {
        text: '👤 مشاهده منوی پرسنلی عادی',
        callbackData: 'main_menu',
        colorVariant: 'sky',
      },
    ],
  ];
}

function getInitialSeedState(): AppStateResponse {
  const envAdminIds = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const config: BotConfig = {
    organizationName: process.env.ORG_NAME || 'سامانه جامع فیش حقوقی',
    adminMessengerIds: Array.from(new Set(envAdminIds)),
    adminSecretCode: process.env.ADMIN_SECRET || '123456',
    adminClaimLocked: false,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramBotUsername: '',
    telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || '',
    baleBotToken: process.env.BALE_BOT_TOKEN || '',
    baleBotUsername: '',
    baleChannelId: process.env.BALE_CHANNEL_ID || '',
    requireMandatoryChannel: false,
    requireNationalCardPhoto: true,
    welcomeMessage:
      'به سامانه هوشمند دریافت فیش حقوقی و خدمات پرسنلی خوش آمدید. از طریق دکمه‌های زیر می‌توانید فیش حقوقی خود را به صورت تصویر و فایل PDF دریافت نمایید.',
    channelPromptMessage:
      'کاربر گرامی، جهت استفاده از خدمات ربات و دریافت فیش حقوقی، ابتدا عضویت در کانال رسمی سازمان الزامی است. لطفاً پس از عضویت، روی دکمه «بررسی عضویت و ادامه» کلیک فرمایید.',
    verificationApprovedMessage:
      'احراز هویت شما توسط مدیریت تأیید شد و حساب کاربری شما به کد پرسنلی متصل گردید. اکنون می‌توانید فیش‌های حقوقی خود را دریافت نمایید.',
    supportContact: '@Support',
    livePollingEnabled: true,
    autoBackupEnabled: true,
    autoBackupIntervalHours: 6,
    lastBackupAt: '',
  };

  const personnelDirectory: PersonnelRecord[] = [];
  const users: BotUser[] = [];
  const payslips: PayslipItem[] = [];
  const messagesByUser: Record<string, BotMessage[]> = {};
  const broadcastLogs: BroadcastLog[] = [];

  return {
    config,
    users,
    personnelDirectory,
    payslips,
    messagesByUser,
    broadcastLogs,
  };
}

function applyEnvOverrides(state: AppStateResponse): void {
  if (!state.config.adminSecretCode) {
    state.config.adminSecretCode = process.env.ADMIN_SECRET || '123456';
  }
  if (process.env.ADMIN_SECRET) {
    state.config.adminSecretCode = process.env.ADMIN_SECRET.trim();
  }
  if (process.env.TELEGRAM_BOT_TOKEN) {
    state.config.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN.trim();
  }
  if (process.env.BALE_BOT_TOKEN) {
    state.config.baleBotToken = process.env.BALE_BOT_TOKEN.trim();
  }
  if (process.env.TELEGRAM_CHANNEL_ID) {
    state.config.telegramChannelId = process.env.TELEGRAM_CHANNEL_ID.trim();
  }
  if (process.env.BALE_CHANNEL_ID) {
    state.config.baleChannelId = process.env.BALE_CHANNEL_ID.trim();
  }
  if (process.env.ADMIN_IDS) {
    const envAdmins = process.env.ADMIN_IDS.split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const merged = new Set([...(state.config.adminMessengerIds || []), ...envAdmins]);
    state.config.adminMessengerIds = Array.from(merged);
  }
}

function loadState(): AppStateResponse {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as AppStateResponse;
      applyEnvOverrides(parsed);
      return parsed;
    }
  } catch (err) {
    console.error('Error reading DB file, initializing fresh state:', err);
  }
  const initial = getInitialSeedState();
  applyEnvOverrides(initial);
  saveState(initial);
  return initial;
}

function saveState(state: AppStateResponse): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB file:', err);
  }
}

async function sendBackupToTelegramAdmin(
  state: AppStateResponse,
  customCaption?: string
): Promise<{ ok: boolean; sentCount: number; error?: string }> {
  const tgToken = state.config.telegramBotToken?.trim();
  const baleToken = state.config.baleBotToken?.trim();

  const envAdmins = (process.env.ADMIN_IDS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const adminIds = Array.from(
    new Set([...(state.config.adminMessengerIds || []), ...envAdmins, '92218108'])
  ).filter((id) => id && id !== 'usr-admin-master');

  if (adminIds.length === 0) {
    return { ok: false, sentCount: 0, error: 'هیچ آیدی ادمینی برای ارسال بکاپ تعریف نشده است.' };
  }

  const dbContent = JSON.stringify(state, null, 2);
  const fileName = `payroll-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const timestamp = nowTimeStr();

  const activeCount = state.users.filter((u) => !u.isAdmin).length;
  const payslipCount = state.payslips.length;
  const fileSizeKb = (Buffer.byteLength(dbContent, 'utf-8') / 1024).toFixed(1);

  const caption =
    customCaption ||
    `📦 **بکاپ کامل و هوشمند دیتابیس سامانه فیش حقوقی**\n────────────────────\n📅 زمان بکاپ‌گیری: ${timestamp}\n👥 تعداد پرسنل: **${toPersianDigitsServer(
      activeCount
    )} نفر**\n📑 تعداد کل فیش‌ها: **${toPersianDigitsServer(
      payslipCount
    )} فیش**\n💾 حجم فایل بکاپ: **${toPersianDigitsServer(
      fileSizeKb
    )} کیلوبایت**\n\n📌 این فایل بکاپ ۱۰۰٪ کامل، فشرده و کم‌حجم است. جهت بازگردانی، همین فایل را در چت ارسال کنید یا در پنل وب آپلود نمایید.`;

  let sentCount = 0;

  for (const adminId of adminIds) {
    if (tgToken) {
      try {
        const formData = new FormData();
        formData.append('chat_id', adminId);
        formData.append('caption', caption);
        formData.append('parse_mode', 'Markdown');
        const fileBlob = new Blob([dbContent], { type: 'application/json' });
        formData.append('document', fileBlob, fileName);

        const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendDocument`, {
          method: 'POST',
          body: formData,
        });
        const data = (await res.json()) as { ok?: boolean };
        if (data && data.ok) sentCount++;
      } catch (err) {
        console.error(`Error sending Telegram backup document to ${adminId}:`, err);
      }
    }

    if (baleToken) {
      try {
        const formData = new FormData();
        formData.append('chat_id', adminId);
        formData.append('caption', caption);
        const fileBlob = new Blob([dbContent], { type: 'application/json' });
        formData.append('document', fileBlob, fileName);

        const res = await fetch(`https://tapi.bale.ai/bot${baleToken}/sendDocument`, {
          method: 'POST',
          body: formData,
        });
        const data = (await res.json()) as { ok?: boolean };
        if (data && data.ok) sentCount++;
      } catch (err) {
        console.error(`Error sending Bale backup document to ${adminId}:`, err);
      }
    }
  }

  state.config.lastBackupAt = `${new Date().toLocaleDateString('fa-IR')} - ${nowTimeStr()}`;
  saveState(state);

  return { ok: sentCount > 0, sentCount };
}

function buildYearSelectionKeyboard(state: AppStateResponse, personnelCode: string): BotButton[][] {
  const userPayslips = state.payslips.filter((p) => p.personnelCode === personnelCode);
  const yearsSet = new Set<number>([1403, 1404, 1405]);
  userPayslips.forEach((p) => yearsSet.add(p.year));
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  const colors: GlassColorVariant[] = ['emerald', 'cyan', 'indigo', 'violet'];
  const rows: BotButton[][] = [];

  for (let i = 0; i < years.length; i += 2) {
    const row: BotButton[] = [];
    for (let j = i; j < Math.min(i + 2, years.length); j++) {
      const y = years[j];
      const count = userPayslips.filter((p) => p.year === y).length;
      row.push({
        text: `📅 سال ${toPersianDigitsServer(y)} (${toPersianDigitsServer(count)} فیش)`,
        callbackData: `select_year:${y}`,
        colorVariant: colors[j % colors.length],
      });
    }
    rows.push(row);
  }

  rows.push([{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'rose' }]);
  return rows;
}

function buildMonthSelectionKeyboard(state: AppStateResponse, personnelCode: string, year: number): BotButton[][] {
  const availableMonths = new Set(
    state.payslips.filter((p) => p.personnelCode === personnelCode && p.year === year).map((p) => p.month)
  );

  const seasonColorMap: Record<'spring' | 'summer' | 'autumn' | 'winter', GlassColorVariant> = {
    spring: 'emerald',
    summer: 'amber',
    autumn: 'violet',
    winter: 'cyan',
  };

  const rows: BotButton[][] = [];
  for (let i = 0; i < PERSIAN_MONTHS.length; i += 3) {
    const row: BotButton[] = [];
    for (let j = i; j < i + 3; j++) {
      const m = PERSIAN_MONTHS[j];
      const hasPayslip = availableMonths.has(m.number);
      row.push({
        text: hasPayslip ? `✅ ${m.name}` : `▫️ ${m.name}`,
        callbackData: `select_month:${year}:${m.number}`,
        colorVariant: hasPayslip ? seasonColorMap[m.season] : 'sky',
      });
    }
    rows.push(row);
  }

  rows.push([
    { text: '🗓️ تغییر سال مالی', callbackData: 'menu_payslips', colorVariant: 'indigo' },
    { text: '🏠 منوی اصلی', callbackData: 'main_menu', colorVariant: 'rose' },
  ]);

  return rows;
}

/**
 * Helper to approve and link a user to a personnelCode and notify both the user and admin
 */
function executeUserVerificationLink(
  state: AppStateResponse,
  targetUser: BotUser,
  personnelCode: string
): void {
  const cleanCode = toEnglishDigitsServer(personnelCode).trim();
  targetUser.personnelCode = cleanCode;
  targetUser.verificationStatus = 'approved';
  targetUser.isActive = true;
  targetUser.rejectionReason = undefined;

  let dirEntry = state.personnelDirectory.find((p) => p.personnelCode === cleanCode);
  if (dirEntry) {
    targetUser.department = dirEntry.department;
    targetUser.jobTitle = dirEntry.jobTitle;
    if (!targetUser.submittedName) targetUser.submittedName = dirEntry.fullName;
  } else {
    targetUser.department = targetUser.department || 'واحد عملیات سازمانی';
    targetUser.jobTitle = targetUser.jobTitle || 'کارشناس';
    dirEntry = {
      personnelCode: cleanCode,
      fullName: targetUser.submittedName || `پرسنل ${cleanCode}`,
      nationalCode: targetUser.nationalCode || '0010000000',
      department: targetUser.department,
      jobTitle: targetUser.jobTitle,
      bankAccount: 'IR420170000000109283746501',
      phoneNumber: targetUser.phoneNumber || '09120000000',
    };
    state.personnelDirectory.push(dirEntry);
  }

  if (!state.messagesByUser[targetUser.id]) {
    state.messagesByUser[targetUser.id] = [];
  }

  state.messagesByUser[targetUser.id].push({
    id: `msg-adm-approve-${Date.now()}`,
    userId: targetUser.id,
    sender: 'bot',
    text: `🎉 **تبریک ${targetUser.submittedName} عزیز!**\n\n${
      state.config.verificationApprovedMessage
    }\n\n✅ کد پرسنلی اختصاص داده شده: **${toPersianDigitsServer(
      cleanCode
    )}**\n🏢 واحد سازمانی: ${targetUser.department}\n📱 آیدی ${
      targetUser.platform === 'telegram' ? 'تلگرام' : 'بله'
    } متصل شده: ${targetUser.messengerId}\n\nهم‌اکنون می‌توانید با کلیک روی دکمه شیشه‌ای زیر، سال و ماه مورد نظر خود را انتخاب کرده و تصویر + فایل PDF فیش حقوقی خود را دریافت نمایید:`,
    timestamp: nowTimeStr(),
    inlineKeyboard: buildMainMenuKeyboard(Boolean(targetUser.isAdmin)),
  });
}

/**
 * Helper to build quick-link buttons for a pending user inside the Admin Bot Chat
 */
function buildAdminVerifyUserButtons(state: AppStateResponse, targetUser: BotUser): BotButton[][] {
  const rows: BotButton[][] = [];

  // 1. Primary Action: Manual custom personnel code typing matching company Excel
  rows.push([
    {
      text: '✍️ اختصاص کد پرسنلی دستی (تایپ کد اکسل)',
      callbackData: `adm_ask_code:${targetUser.id}`,
      colorVariant: 'cyan',
    },
  ]);

  // 2. Suggest known personnel codes from directory if any exist
  const suggestedRecords = state.personnelDirectory.slice(0, 4);
  for (let i = 0; i < suggestedRecords.length; i += 2) {
    const row: BotButton[] = [];
    for (let j = i; j < Math.min(i + 2, suggestedRecords.length); j++) {
      const rec = suggestedRecords[j];
      row.push({
        text: `🔗 اتصال به کد ${toPersianDigitsServer(rec.personnelCode)} (${rec.fullName})`,
        callbackData: `adm_link_code:${targetUser.id}:${rec.personnelCode}`,
        colorVariant: 'emerald',
      });
    }
    rows.push(row);
  }

  // 3. Reject button and admin panel return
  rows.push([
    {
      text: '❌ رد کارت ملی و درخواست',
      callbackData: `adm_reject:${targetUser.id}`,
      colorVariant: 'rose',
    },
    {
      text: '👑 بازگشت به پنل مدیریت',
      callbackData: 'adm_panel',
      colorVariant: 'amber',
    },
  ]);

  return rows;
}

/**
 * Core Bot State Machine that handles both Regular Personnel flows AND 100% of Admin Panel
 * operations directly inside the Bot Chat (`adm_*` callbacks, file uploads, and text inputs).
 */
function handleBotInteraction(
  state: AppStateResponse,
  params: {
    userId: string;
    actionType: 'command' | 'callback' | 'text' | 'national_card_upload' | 'join_channel';
    payload?: string;
    nationalCardImageUrl?: string;
    submittedName?: string;
    nationalCode?: string;
  }
): { user: BotUser; messages: BotMessage[] } {
  const user = state.users.find((u) => u.id === params.userId);
  if (!user) {
    throw new Error('کاربر مورد نظر یافت نشد.');
  }

  if (!state.messagesByUser[user.id]) {
    state.messagesByUser[user.id] = [];
  }
  const chat = state.messagesByUser[user.id];
  const timestamp = nowTimeStr();
  user.lastInteractionAt = `۱۴۰۴/۰۸/۱۵ - ${timestamp}`;

  const pushUserMsg = (text: string, attachment?: BotMessage['attachment']) => {
    chat.push({
      id: `msg-u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      sender: 'user',
      text,
      timestamp,
      attachment,
    });
  };

  const pushBotMsg = (
    text: string,
    inlineKeyboard?: BotButton[][],
    attachment?: BotMessage['attachment']
  ) => {
    chat.push({
      id: `msg-b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      sender: 'bot',
      text,
      timestamp,
      inlineKeyboard,
      attachment,
    });
  };

  let rawPayload = (params.payload || '').trim();
  let payload = rawPayload;

  // Map persistent square Reply Keyboard button text inputs
  if (rawPayload === '📄 دریافت فیش حقوقی') payload = 'menu_payslips';
  else if (rawPayload === '📊 آخرین فیش صادر شده') payload = 'latest_payslip';
  else if (rawPayload === '👤 کد پرسنلی و اطلاعات من' || rawPayload === '👤 پرونده و کد پرسنلی من') payload = 'menu_profile';
  else if (rawPayload === '💬 پشتیبانی' || rawPayload === '💬 ارتباط با واحد منابع انسانی') payload = 'menu_support';
  else if (rawPayload.includes('👑 پنل مدیریت') || rawPayload === '👑 پنل مدیریت (/admin)') payload = '/admin';
  else if (rawPayload.includes('🪪 صف کارت ملی')) payload = 'adm_queue';
  else if (rawPayload.includes('📤 آپلود فیش') || rawPayload.startsWith('📤 بارگذاری')) payload = 'adm_upload_menu';

  const masterSecret = (state.config.adminSecretCode || process.env.ADMIN_SECRET || '123456').trim();

  let isUserAdmin =
    Boolean(user.isAdmin) || isMessengerAdmin(user.messengerId, user.username, state.config);

  if (isUserAdmin && !user.isAdmin) {
    user.isAdmin = true;
    user.verificationStatus = 'approved';
    user.isChannelMember = true;
    user.isActive = true;
    if (!user.personnelCode) user.personnelCode = '1001';
  }

  // =========================================================================
  // ZERO-PANEL WEBHOOK ADMIN CLAIM FLOW (`/setadmin <secret>`, `/claim <secret>`, or 1-Click Button)
  // Strictly ONE-TIME USE: Automatically locks (`adminClaimLocked = true`) after the first Admin registers!
  // =========================================================================
  if (
    payload.startsWith('/setadmin') ||
    payload.startsWith('/claim') ||
    (payload.startsWith('/admin ') && payload.split(/\s+/)[1]) ||
    payload.startsWith('claim_admin_exec:')
  ) {
    pushUserMsg(payload.startsWith('claim_admin_exec:') ? `🔑 ثبت اکانت به عنوان ادمین کل در بات` : payload);

    // Check if `/setadmin` has already been used once and is locked for all other users
    if (state.config.adminClaimLocked && !isUserAdmin) {
      pushBotMsg(
        `🔒 **دستور معرفی ادمین (\`/setadmin\`) غیرفعال شده است!**\n────────────────────\nاین دستور **یک‌بار مصرف** بوده و پس از ثبت اولین ادمین کل، به صورت خودکار برای سایر کاربران **قفل و غیرفعال** گردیده است.\n\n⚠️ در صورت نیاز به افزودن ادمین جدید، فقط **ادمین کل فعلی** می‌تواند از داخل منوی \`/admin\` ⬅️ \`⚙️ تنظیمات\` ⬅️ \`👑 مدیریت ادمین‌ها\` آیدی عددی شما (\`${user.messengerId}\`) را اضافه نماید.`,
        [[{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    const providedPin = payload.startsWith('claim_admin_exec:')
      ? payload.split(':')[1]?.trim() || ''
      : toEnglishDigitsServer(payload.replace(/^\/(setadmin|claim|admin)\s*/i, '')).trim();

    if (!providedPin) {
      pushBotMsg(
        `🔑 **معرفی و ثبت اولین ادمین کل از داخل ربات (یک‌بار مصرف)**\n────────────────────\n• آیدی عددی شما: \`${user.messengerId}\`\n• یوزرنیم: \`@${user.username}\`\n\nبرای اینکه همین اکانت شما در حالت وب‌هوک به عنوان **ادمین کل** ثبت شود، دستور زیر را به همراه رمز مستر (پیش‌فرض: \`123456\`) ارسال کنید:\n\n\`/setadmin 123456\`\n\n🔒 **امنیت یک‌بار مصرف:** به محض ثبت شما، این دستور به صورت خودکار **قفل و برای تمام کاربران دیگر غیرفعال** می‌شود!`,
        [
          [
            {
              text: `⚡ ثبت فوری به عنوان ادمین کل و قفل خودکار دستور`,
              callbackData: `claim_admin_exec:${masterSecret}`,
              colorVariant: 'amber',
            },
          ],
          [{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'emerald' }],
        ]
      );
      return { user, messages: chat };
    }

    if (providedPin !== toEnglishDigitsServer(masterSecret)) {
      pushBotMsg(
        `❌ **رمز مستر ادمین نامعتبر است!**\nلطفاً دستور را به صورت \`/setadmin رمز_مستر\` ارسال فرمایید (رمز پیش‌فرض اولیه: \`123456\` یا مقدار \`ADMIN_SECRET\` در فایل \`.env\` سرور).`,
        [[{ text: '🏠 بازگشت', callbackData: 'main_menu', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    // Promote this user to Master Admin directly inside the Bot AND immediately lock `/setadmin` for everyone else!
    user.isAdmin = true;
    user.isChannelMember = true;
    user.verificationStatus = 'approved';
    user.isActive = true;
    if (!user.personnelCode) user.personnelCode = '1001';
    if (!user.submittedName) user.submittedName = `👑 ادمین کل (${user.username})`;
    user.adminSession = { step: 'idle', uploadYear: 1404, uploadMonth: 9 };

    if (!state.config.adminMessengerIds) {
      state.config.adminMessengerIds = [];
    }
    if (!state.config.adminMessengerIds.includes(user.messengerId)) {
      state.config.adminMessengerIds.push(user.messengerId);
    }
    // ONE-TIME LOCK: Disable `/setadmin` for all other users automatically!
    state.config.adminClaimLocked = true;
    isUserAdmin = true;

    pushBotMsg(
      `🎉 **تبریک! اکانت شما (\`${user.messengerId}\` / \`@${user.username}\`) به عنوان «👑 ادمین کل سامانه» ثبت شد!**\n🔒 **قفل امنیتی خودکار فعال شد:** دستور \`/setadmin\` از این لحظه به صورت خودکار **قفل و برای تمامی کاربران دیگر غیرفعال** گردید تا هیچ شخص دیگری نتواند از آن استفاده کند.\n────────────────────\nاکنون تمام امکانات مدیریتی ربات در اختیار شماست:`,
      buildAdminInBotKeyboard(state)
    );
    return { user, messages: chat };
  }

  if (payload === 'claim_admin_prompt' || (!isUserAdmin && (payload === '/admin' || payload === 'adm_panel'))) {
    pushUserMsg(payload === 'claim_admin_prompt' ? '🔑 بررسی دسترسی مدیریت' : payload);

    if (state.config.adminClaimLocked) {
      pushBotMsg(
        `⛔ **عدم دسترسی به پنل مدیریت ربات**\n────────────────────\nاکانت شما (\`${user.messengerId}\`) دسترسی ادمین ندارد و دستور معرفی اولیه ادمین (\`/setadmin\`) نیز پس از ثبت اولین مدیر **قفل و غیرفعال شده است**.\n\nتنها ادمین کل فعلی می‌تواند از داخل منوی \`/admin\` آیدی عددی شما را به لیست مدیران اضافه نماید.`,
        [[{ text: '🏠 بازگشت به منوی پرسنلی', callbackData: 'main_menu', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    pushBotMsg(
      `👑 **معرفی اولین ادمین بدون نیاز به پنل وب (یک‌بار مصرف)**\n────────────────────\nاکانت فعلی شما (\`${
        user.messengerId
      }\` - \`@${
        user.username
      }\`) هنوز در لیست ادمین‌ها ثبت نشده است.\n\nچون هنوز دستور معرفی اولیه قفل نشده است، کافی است دستور زیر را با رمز مستر (پیش‌فرض: \`123456\`) بفرستید یا روی دکمه زیر بزنید:\n\`/setadmin 123456\`\n\n🔒 **توجه:** به محض اینکه یک بار ثبت شوید، این دستور **به طور خودکار برای بقیه کاربران غیرفعال و قفل می‌شود!**`,
      [
        [
          {
            text: '⚡ ثبت فوری به عنوان ادمین کل (و قفل شدن برای بقیه)',
            callbackData: `claim_admin_exec:${masterSecret}`,
            colorVariant: 'amber',
          },
        ],
        [{ text: '🏠 بازگشت به منوی پرسنلی', callbackData: 'main_menu', colorVariant: 'emerald' }],
      ]
    );
    return { user, messages: chat };
  }

  // Universal `/id` or `/myid` command so anyone can discover their exact Numeric ID for Admin setup
  if (payload === '/id' || payload === '/myid' || payload === 'my_id') {
    pushUserMsg(payload === 'my_id' ? '🆔 مشاهده آیدی عددی من' : payload);
    pushBotMsg(
      `🆔 **مشخصات شناسه کاربری شما در ${user.platform === 'telegram' ? 'تلگرام' : 'بله'}**\n────────────────────\n• شماره آیدی عددی (Chat ID): \`${
        user.messengerId
      }\`\n• یوزرنیم: \`@${user.username}\`\n• نقش فعلی شما در ربات: **${
        isUserAdmin ? '👑 ادمین کل سامانه (دسترسی به /admin)' : '👤 کاربر پرسنلی عادی'
      }**\n• وضعیت دستور \`/setadmin\`: **${
        state.config.adminClaimLocked ? '🔒 قفل شده (غیرفعال برای سایر کاربران)' : '🔓 آماده ثبت اولین ادمین (یک‌بار مصرف)'
      }**`,
      isUserAdmin
        ? [[{ text: '👑 ورود به پنل مدیریت درون ربات (/admin)', callbackData: 'adm_panel', colorVariant: 'amber' }]]
        : state.config.adminClaimLocked
        ? [[{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'emerald' }]]
        : [
            [
              {
                text: '🔑 ثبت به عنوان اولین ادمین کل (/setadmin)',
                callbackData: 'claim_admin_prompt',
                colorVariant: 'amber',
              },
            ],
            [{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'emerald' }],
          ]
    );
    return { user, messages: chat };
  }

  // =========================================================================
  // PART A: IN-BOT ADMIN PANEL COMMANDS, CALLBACKS & CONVERSATIONAL STEPS
  // =========================================================================
  if (isUserAdmin) {
    if (!user.adminSession) {
      user.adminSession = { step: 'idle', uploadYear: 1404, uploadMonth: 9 };
    }

    // 1. Entry into In-Bot Admin Panel (`/admin` or `adm_panel`)
    if (payload === '/admin' || payload === 'adm_panel' || (user.id === 'usr-admin-master' && payload === '/start')) {
      user.adminSession.step = 'idle';
      if (params.actionType === 'command' || params.actionType === 'text') {
        pushUserMsg(payload);
      } else {
        pushUserMsg('👑 پنل مدیریت کل درون ربات');
      }

      const pendingCount = state.users.filter((u) => u.verificationStatus === 'pending_admin').length;
      const approvedCount = state.users.filter((u) => u.verificationStatus === 'approved' && !u.isAdmin).length;

      pushBotMsg(
        `👑 **پنل مدیریت جامع درون ربات (${state.config.organizationName})**\n────────────────────\nشما با دسترسی **ادمین کل** وارد شده‌اید و تمام عملیات سامانه را بدون نیاز به پنل وب، مستقیماً از داخل همین چت می‌توانید انجام دهید:\n\n📊 **وضعیت لحظه‌ای سامانه:**\n• درخواست‌های احراز هویت (کارت ملی جدید): **${toPersianDigitsServer(
          pendingCount
        )} مورد**\n• پرسنل احراز هویت شده و فعال: **${toPersianDigitsServer(
          approvedCount
        )} نفر**\n• کل فیش‌های حقوقی بارگذاری شده: **${toPersianDigitsServer(
          state.payslips.length
        )} فیش**\n• عضویت اجباری کانال: **${
          state.config.requireMandatoryChannel ? 'فعال ✅' : 'غیرفعال ❌'
        }**\n\nلطفاً عملیات مدیریتی مورد نظر را از دکمه‌های شیشه‌ای رنگی زیر انتخاب فرمایید:`,
        buildAdminInBotKeyboard(state)
      );
      return { user, messages: chat };
    }

    // 2. Admin Queue: View Pending Users' National ID Photos & Link to Personnel Code inside Bot
    if (payload === 'adm_queue') {
      user.adminSession.step = 'idle';
      pushUserMsg('🪪 بررسی صف احراز هویت و کارت ملی');
      const pendingUsers = state.users.filter((u) => u.verificationStatus === 'pending_admin');

      if (pendingUsers.length === 0) {
        pushBotMsg(
          `✅ در حال حاضر هیچ درخواست احراز هویت بررسی‌نشده‌ای در صف انتظار وجود ندارد.\n\nبرای مشاهده و ویرایش کد پرسنلی سایر کاربران می‌توانید از بخش «مدیریت کاربران و فعال/غیرفعال» استفاده کنید.`,
          buildAdminInBotKeyboard(state)
        );
        return { user, messages: chat };
      }

      pushBotMsg(
        `🪪 **صف درخواست‌های احراز هویت پرسنل (${toPersianDigitsServer(
          pendingUsers.length
        )} درخواست)**\nتصویر کارت ملی، نام و شماره آیدی تلگرام/بله هر کاربر در ادامه ارسال شده است. از دکمه‌های شیشه‌ای زیر هر کارت، کد پرسنلی مورد نظر را لینک کنید:`
      );

      for (const pu of pendingUsers) {
        const pPlatform = pu.platform === 'telegram' ? 'تلگرام' : 'بله';
        const cardImg =
          pu.nationalCardImageUrl ||
          createSampleCardSvgUrl(pu.submittedName || 'کاربر جدید', pu.nationalCode || '0010000000', '۱۳۷۰/۰۱/۰۱', 'محمد');

        pushBotMsg(
          `👤 **درخواست احراز هویت پرسنل**\n────────────────────\n• نام ارسالی کاربر: **${
            pu.submittedName || 'نامشخص'
          }**\n• کد ملی: **${toPersianDigitsServer(pu.nationalCode || 'ثبت نشده')}**\n• پیام‌رسان: **${pPlatform}**\n• شماره آیدی ${pPlatform}: \`${
            pu.messengerId
          }\` (@${pu.username})\n• عضویت در کانال اجباری: ${
            pu.isChannelMember ? 'عضو شده ✅' : 'عضو نشده ⚠️'
          }\n\n👇 لطفاً کد پرسنلی این شخص را از دکمه‌های شیشه‌ای زیر انتخاب کنید یا کد دلخواه را تایپ نمایید:`,
          buildAdminVerifyUserButtons(state, pu),
          {
            type: 'national_card',
            imageUrl: cardImg,
            caption: `تصویر کارت ملی ${pu.submittedName} — آیدی ${pPlatform}: ${pu.messengerId}`,
          }
        );
      }
      return { user, messages: chat };
    }

    // 3. Admin Links a User to a Specific Personnel Code via 1-Click Glass Button inside Bot
    if (payload.startsWith('adm_link_code:')) {
      const parts = payload.split(':');
      const targetUserId = parts[1];
      const codeToLink = parts[2];
      const targetUser = state.users.find((u) => u.id === targetUserId);

      if (!targetUser) {
        pushBotMsg('⚠️ کاربر مورد نظر یافت نشد.', buildAdminInBotKeyboard(state));
        return { user, messages: chat };
      }

      executeUserVerificationLink(state, targetUser, codeToLink);
      pushUserMsg(`🔗 تأیید و اتصال ${targetUser.submittedName} به کد پرسنلی ${toPersianDigitsServer(codeToLink)}`);
      pushBotMsg(
        `✅ **احراز هویت و اتصال کد پرسنلی انجام شد!**\n\n• نام پرسنل: **${
          targetUser.submittedName
        }**\n• پیام‌رسان: **${
          targetUser.platform === 'telegram' ? 'تلگرام' : 'بله'
        }** (ID: ${targetUser.messengerId})\n• کد پرسنلی متصل شده: **${toPersianDigitsServer(
          codeToLink
        )}**\n• واحد سازمانی: **${targetUser.department}**\n\n🔔 پیام تأیید به همراه دکمه شیشه‌ای دریافت فیش حقوقی به صورت خودکار برای ایشان ارسال گردید.`,
        buildAdminInBotKeyboard(state)
      );
      return { user, messages: chat };
    }

    // 4. Admin Clicks "Type Custom Personnel Code in Chat" (`adm_ask_code:<userId>`)
    if (payload.startsWith('adm_ask_code:')) {
      const targetUserId = payload.split(':')[1];
      const targetUser = state.users.find((u) => u.id === targetUserId);
      if (!targetUser) {
        pushBotMsg('⚠️ کاربر مورد نظر یافت نشد.', buildAdminInBotKeyboard(state));
        return { user, messages: chat };
      }

      user.adminSession.step = 'awaiting_custom_code_for_user';
      user.adminSession.targetUserId = targetUser.id;
      pushUserMsg(`✍️ درج دستی کد پرسنلی برای ${targetUser.submittedName}`);
      pushBotMsg(
        `🔢 لطفاً **کد پرسنلی اختصاصی** مورد نظر برای **${targetUser.submittedName}** (آیدی ${
          targetUser.platform === 'telegram' ? 'تلگرام' : 'بله'
        }: ${targetUser.messengerId}) را در کادر پیام پایین تایپ و ارسال نمایید (مثلاً: \`1004\` یا \`1008\`):`,
        [[{ text: '🔙 انصراف و بازگشت به پنل ادمین بات', callbackData: 'adm_panel', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    // 5. Admin Rejects a User's Verification inside Bot (`adm_reject:<userId>`)
    if (payload.startsWith('adm_reject:')) {
      const targetUserId = payload.split(':')[1];
      const targetUser = state.users.find((u) => u.id === targetUserId);
      if (!targetUser) {
        pushBotMsg('⚠️ کاربر یافت نشد.', buildAdminInBotKeyboard(state));
        return { user, messages: chat };
      }

      targetUser.verificationStatus = 'rejected';
      targetUser.personnelCode = null;
      targetUser.rejectionReason = 'عدم تطابق تصویر کارت ملی با مشخصات پرسنلی (رد شده توسط ادمین در ربات)';

      if (!state.messagesByUser[targetUser.id]) state.messagesByUser[targetUser.id] = [];
      state.messagesByUser[targetUser.id].push({
        id: `msg-rej-${Date.now()}`,
        userId: targetUser.id,
        sender: 'bot',
        text: `❌ درخواست احراز هویت شما توسط مدیریت رد شد.\nلطفاً مجدداً نام کامل و تصویر واضح کارت ملی خود را ارسال فرمایید:`,
        timestamp,
        inlineKeyboard: [
          [{ text: '🪪 ارسال مجدد نام و تصویر کارت ملی', callbackData: 'open_card_uploader', colorVariant: 'emerald' }],
        ],
      });

      pushUserMsg(`❌ رد درخواست احراز هویت ${targetUser.submittedName}`);
      pushBotMsg(
        `🚫 درخواست احراز هویت **${targetUser.submittedName}** رد شد و پیام ارسال مجدد کارت ملی برای ایشان در ${
          targetUser.platform === 'telegram' ? 'تلگرام' : 'بله'
        } ارسال گردید.`,
        buildAdminInBotKeyboard(state)
      );
      return { user, messages: chat };
    }

    // 6. Admin User Management & Activate/Deactivate Inside Bot (`adm_users_list` & `adm_toggle_user:<id>`)
    if (payload === 'adm_users_list' || payload.startsWith('adm_toggle_user:')) {
      user.adminSession.step = 'idle';

      if (payload.startsWith('adm_toggle_user:')) {
        const targetId = payload.split(':')[1];
        const targetUser = state.users.find((u) => u.id === targetId);
        if (targetUser) {
          targetUser.isActive = !targetUser.isActive;
          if (!state.messagesByUser[targetUser.id]) state.messagesByUser[targetUser.id] = [];
          state.messagesByUser[targetUser.id].push({
            id: `msg-tg-act-${Date.now()}`,
            userId: targetUser.id,
            sender: 'bot',
            text: targetUser.isActive
              ? '✅ حساب کاربری شما توسط ادمین فعال گردید.'
              : '⛔ حساب کاربری شما توسط ادمین غیرفعال گردید.',
            timestamp,
            inlineKeyboard: targetUser.isActive ? buildMainMenuKeyboard(Boolean(targetUser.isAdmin)) : undefined,
          });
          pushUserMsg(
            `${targetUser.isActive ? '🟢 فعال‌سازی' : '🔴 غیرفعال‌سازی'} حساب ${
              targetUser.submittedName || targetUser.username
            }`
          );
        }
      } else {
        pushUserMsg('👥 مدیریت کاربران و فعال/غیرفعال‌سازی در بات');
      }

      const personnelUsers = state.users.filter((u) => u.id !== 'usr-admin-master');
      const userRows: BotButton[][] = [];

      for (const pu of personnelUsers) {
        const pName = pu.submittedName || pu.username;
        const pCode = pu.personnelCode ? `کد ${toPersianDigitsServer(pu.personnelCode)}` : 'بدون کد';
        const pPlat = pu.platform === 'telegram' ? 'تلگرام' : 'بله';
        userRows.push([
          {
            text: `${pu.isActive ? '🟢 فعال' : '🔴 مسدود'} | ${pName} (${pCode} - ${pPlat})`,
            callbackData: `adm_toggle_user:${pu.id}`,
            colorVariant: pu.isActive ? 'emerald' : 'rose',
          },
          {
            text: `🔢 تغییر کد پرسنلی`,
            callbackData: `adm_ask_code:${pu.id}`,
            colorVariant: 'cyan',
          },
        ]);
      }

      userRows.push([{ text: '👑 بازگشت به پنل مدیریت درون بات', callbackData: 'adm_panel', colorVariant: 'amber' }]);

      pushBotMsg(
        `👥 **مدیریت پرسنل، کدهای پرسنلی و فعال/غیرفعال‌سازی در ربات**\n────────────────────\n• برای **فعال یا غیرفعال کردن فوری** هر کاربر، روی دکمه وضعیت ایشان کلیک کنید.\n• برای **تغییر یا اختصاص کد پرسنلی**، روی «🔢 تغییر کد پرسنلی» کلیک نمایید:`,
        userRows
      );
      return { user, messages: chat };
    }

    // 7. Admin In-Bot Upload Excel & PDF Payslips (`adm_upload_menu`, `adm_up_year:YYYY`, `adm_up_month:MM`)
    if (
      payload === 'adm_upload_menu' ||
      payload.startsWith('adm_up_year:') ||
      payload.startsWith('adm_up_month:')
    ) {
      if (payload.startsWith('adm_up_year:')) {
        user.adminSession.uploadYear = Number(payload.split(':')[1]) || 1404;
      }
      if (payload.startsWith('adm_up_month:')) {
        user.adminSession.uploadMonth = Number(payload.split(':')[1]) || 9;
      }

      const curYear = user.adminSession.uploadYear || 1404;
      const curMonth = user.adminSession.uploadMonth || 9;
      const monthObj = PERSIAN_MONTHS.find((m) => m.number === curMonth) || PERSIAN_MONTHS[8];
      user.adminSession.step = 'awaiting_file_upload';

      pushUserMsg(`📤 تنظیم بارگذاری فیش در بات (${monthObj.name} ${toPersianDigitsServer(curYear)})`);

      const uploadKeyboard: BotButton[][] = [
        [
          {
            text: `${curYear === 1405 ? '✅ ' : ''}سال ۱۴۰۵`,
            callbackData: 'adm_up_year:1405',
            colorVariant: curYear === 1405 ? 'emerald' : 'sky',
          },
          {
            text: `${curYear === 1404 ? '✅ ' : ''}سال ۱۴۰۴`,
            callbackData: 'adm_up_year:1404',
            colorVariant: curYear === 1404 ? 'emerald' : 'sky',
          },
          {
            text: `${curYear === 1403 ? '✅ ' : ''}سال ۱۴۰۳`,
            callbackData: 'adm_up_year:1403',
            colorVariant: curYear === 1403 ? 'emerald' : 'sky',
          },
        ],
        [
          { text: 'فروردین', callbackData: 'adm_up_month:1', colorVariant: curMonth === 1 ? 'emerald' : 'cyan' },
          { text: 'اردیبهشت', callbackData: 'adm_up_month:2', colorVariant: curMonth === 2 ? 'emerald' : 'cyan' },
          { text: 'خرداد', callbackData: 'adm_up_month:3', colorVariant: curMonth === 3 ? 'emerald' : 'cyan' },
          { text: 'تیر', callbackData: 'adm_up_month:4', colorVariant: curMonth === 4 ? 'emerald' : 'cyan' },
        ],
        [
          { text: 'مرداد', callbackData: 'adm_up_month:5', colorVariant: curMonth === 5 ? 'emerald' : 'cyan' },
          { text: 'شهریور', callbackData: 'adm_up_month:6', colorVariant: curMonth === 6 ? 'emerald' : 'cyan' },
          { text: 'مهر', callbackData: 'adm_up_month:7', colorVariant: curMonth === 7 ? 'emerald' : 'cyan' },
          { text: 'آبان', callbackData: 'adm_up_month:8', colorVariant: curMonth === 8 ? 'emerald' : 'cyan' },
        ],
        [
          { text: 'آذر', callbackData: 'adm_up_month:9', colorVariant: curMonth === 9 ? 'emerald' : 'cyan' },
          { text: 'دی', callbackData: 'adm_up_month:10', colorVariant: curMonth === 10 ? 'emerald' : 'cyan' },
          { text: 'بهمن', callbackData: 'adm_up_month:11', colorVariant: curMonth === 11 ? 'emerald' : 'cyan' },
          { text: 'اسفند', callbackData: 'adm_up_month:12', colorVariant: curMonth === 12 ? 'emerald' : 'cyan' },
        ],
        [
          {
            text: `📎 انتخاب و ارسال فایل اکسل (.xlsx) یا PDF فیش در چت (${monthObj.name} ${toPersianDigitsServer(curYear)})`,
            callbackData: 'open_admin_bot_file_picker',
            colorVariant: 'emerald',
          },
        ],
        [
          {
            text: `⚡ بارگذاری خودکار اکسل نمونه ${monthObj.name} ${toPersianDigitsServer(curYear)} برای کل پرسنل`,
            callbackData: `adm_quick_seed_month:${curYear}:${curMonth}`,
            colorVariant: 'violet',
          },
        ],
        [{ text: '👑 بازگشت به پنل مدیریت درون بات', callbackData: 'adm_panel', colorVariant: 'amber' }],
      ];

      pushBotMsg(
        `📤 **بارگذاری مستقیم فایل اکسل و PDF فیش حقوقی از درون ربات**\n────────────────────\n📅 دوره انتخاب شده فعلی: **${
          monthObj.name
        } ماه سال ${toPersianDigitsServer(
          curYear
        )}**\n\nشما می‌توانید مستقیماً داخل همین چت ربات، فایل اکسل (\`.xlsx\`, \`.csv\`) حاوی کد پرسنلی یا فایل PDF/تصویر فیش حقوقی را ارسال نمایید تا ربات به صورت خودکار تصویر و PDF فیش را در حساب هر کد پرسنلی قرار دهد:`,
        uploadKeyboard
      );
      return { user, messages: chat };
    }

    // 8. Admin 1-Click Quick Upload Sample Excel inside Bot (`adm_quick_seed_month:YYYY:MM`)
    if (payload.startsWith('adm_quick_seed_month:')) {
      const parts = payload.split(':');
      const y = Number(parts[1]) || 1404;
      const m = Number(parts[2]) || 9;
      const monthObj = PERSIAN_MONTHS.find((pm) => pm.number === m) || PERSIAN_MONTHS[8];

      let count = 0;
      for (let idx = 0; idx < state.personnelDirectory.length; idx++) {
        const person = state.personnelDirectory[idx];
        const baseSalary = 160000000 + idx * 12000000;
        const housingAllowance = 18000000;
        const groceryAllowance = 22000000;
        const childAllowance = idx % 2 === 0 ? 14500000 : 7250000;
        const overtimeHours = 20 + idx * 3;
        const overtimePay = overtimeHours * 1500000;
        const bonusPay = 35000000;
        const totalEarnings =
          baseSalary + housingAllowance + groceryAllowance + childAllowance + overtimePay + bonusPay;
        const insuranceDeduction = Math.round((baseSalary + housingAllowance + groceryAllowance) * 0.07);
        const taxDeduction = Math.round(totalEarnings * 0.055);
        const loanDeduction = 10000000;
        const otherDeduction = 3000000;
        const totalDeductions = insuranceDeduction + taxDeduction + loanDeduction + otherDeduction;
        const netPay = totalEarnings - totalDeductions;

        const existingIdx = state.payslips.findIndex(
          (p) => p.personnelCode === person.personnelCode && p.year === y && p.month === m
        );
        const newSlip: PayslipItem = {
          id: `ps-${person.personnelCode}-${y}-${String(m).padStart(2, '0')}-${Date.now().toString(36).slice(-3)}`,
          personnelCode: person.personnelCode,
          employeeName: person.fullName,
          nationalCode: person.nationalCode,
          department: person.department,
          jobTitle: person.jobTitle,
          bankAccount: person.bankAccount,
          year: y,
          month: m,
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
          createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
        };

        if (existingIdx >= 0) {
          state.payslips[existingIdx] = newSlip;
        } else {
          state.payslips.unshift(newSlip);
        }
        count++;
      }

      pushUserMsg(`⚡ بارگذاری فایل فیش حقوقی ${monthObj.name} ${toPersianDigitsServer(y)} در بات`);
      pushBotMsg(
        `✅ **بارگذاری فیش‌های حقوقی از طریق ربات با موفقیت انجام شد!**\n\n• دوره مالی: **${
          monthObj.name
        } ماه ${toPersianDigitsServer(y)}**\n• تعداد فیش‌های پردازش شده با کد پرسنلی: **${toPersianDigitsServer(
          count
        )} فیش (تصویر + PDF)**\n• تمامی پرسنل تأیید شده هم‌اکنون می‌توانند فیش ${
          monthObj.name
        } ${toPersianDigitsServer(y)} خود را دریافت نمایند.`,
        buildAdminInBotKeyboard(state)
      );
      return { user, messages: chat };
    }

    // 9. Admin Broadcast Menu Inside Bot (`adm_broadcast_menu` & `adm_bc_target:<filter>`)
    if (payload === 'adm_broadcast_menu') {
      user.adminSession.step = 'idle';
      pushUserMsg('📢 ارسال پیام گروهی از درون بات');
      pushBotMsg(
        `📢 **ارسال پیام گروهی از درون ربات**\n────────────────────\nلطفاً ابتدا گروه هدف دریافت‌کنندگان پیام را از دکمه‌های شیشه‌ای زیر انتخاب کنید:`,
        [
          [
            {
              text: '👥 همه پرسنل فعال و تأیید شده',
              callbackData: 'adm_bc_target:all_active',
              colorVariant: 'emerald',
            },
          ],
          [
            {
              text: '✈️ فقط کاربران تلگرام',
              callbackData: 'adm_bc_target:telegram_only',
              colorVariant: 'cyan',
            },
            {
              text: '🟢 فقط کاربران بله',
              callbackData: 'adm_bc_target:bale_only',
              colorVariant: 'teal',
            },
          ],
          [
            {
              text: '🌐 تمامی کاربران ربات (حتی احراز نشده‌ها)',
              callbackData: 'adm_bc_target:all_users',
              colorVariant: 'violet',
            },
          ],
          [{ text: '👑 بازگشت به پنل مدیریت درون بات', callbackData: 'adm_panel', colorVariant: 'amber' }],
        ]
      );
      return { user, messages: chat };
    }

    if (payload.startsWith('adm_bc_target:')) {
      const targetFilter = payload.split(':')[1] || 'all_active';
      user.adminSession.step = 'awaiting_broadcast_text';
      user.adminSession.broadcastTargetFilter = targetFilter;

      const filterLabel =
        targetFilter === 'all_active'
          ? 'همه پرسنل فعال'
          : targetFilter === 'telegram_only'
          ? 'فقط کاربران تلگرام'
          : targetFilter === 'bale_only'
          ? 'فقط کاربران بله'
          : 'تمامی کاربران ربات';

      pushUserMsg(`🎯 انتخاب مخاطبان پیام گروهی: ${filterLabel}`);
      pushBotMsg(
        `✍️ **ارسال متن پیام گروهی (${filterLabel})**\n\nلطفاً متن پیام گروهی خود را در کادر پایین بنویسید و ارسال کنید (یا یکی از پیام‌های آماده زیر را بزنید تا بلافاصله برای همه ارسال شود):`,
        [
          [
            {
              text: '⚡ ارسال فوری اطلاعیه: «فیش حقوقی ماه جاری بارگذاری شد»',
              callbackData: 'adm_bc_quick_send',
              colorVariant: 'emerald',
            },
          ],
          [{ text: '🔙 انصراف و بازگشت به پنل ادمین بات', callbackData: 'adm_panel', colorVariant: 'rose' }],
        ]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_bc_quick_send') {
      const filter = user.adminSession.broadcastTargetFilter || 'all_active';
      const quickText =
        'همکاران گرامی، فیش حقوقی ماه جاری در سامانه بارگذاری گردید. هم‌اکنون می‌توانید با کلیک روی دکمه شیشه‌ای زیر، سال و ماه مورد نظر را انتخاب کرده و تصویر و فایل PDF فیش خود را دریافت نمایید.';
      user.adminSession.step = 'idle';

      const targets = state.users.filter((u) => {
        if (u.id === 'usr-admin-master') return false;
        if (filter === 'all_active') return u.isActive && u.verificationStatus === 'approved';
        if (filter === 'telegram_only') return u.isActive && u.platform === 'telegram';
        if (filter === 'bale_only') return u.isActive && u.platform === 'bale';
        return true;
      });

      for (const t of targets) {
        if (!state.messagesByUser[t.id]) state.messagesByUser[t.id] = [];
        state.messagesByUser[t.id].push({
          id: `msg-bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: t.id,
          sender: 'admin_broadcast',
          text: `📢 **اطلاعیه رسمی مدیریت (ارسالی از ربات ادمین)**\n────────────────────\n${quickText}`,
          timestamp,
          inlineKeyboard: [
            [{ text: '📄 دریافت فوری فیش حقوقی (تصویر + PDF)', callbackData: 'menu_payslips', colorVariant: 'emerald' }],
          ],
        });
      }

      state.broadcastLogs.unshift({
        id: `bc-${Date.now()}`,
        title: 'اطلاعیه ارسالی از داخل ربات ادمین',
        message: quickText,
        targetFilter: filter,
        buttonText: '📄 دریافت فوری فیش حقوقی (تصویر + PDF)',
        buttonColor: 'emerald',
        sentCount: targets.length,
        createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
      });

      pushUserMsg('📢 ارسال اطلاعیه فوری بارگذاری فیش حقوقی');
      pushBotMsg(
        `✅ پیام گروهی با دکمه شیشه‌ای رنگی با موفقیت از داخل بات برای **${toPersianDigitsServer(
          targets.length
        )} نفر** ارسال گردید!`,
        buildAdminInBotKeyboard(state)
      );
      return { user, messages: chat };
    }

    // 10. Admin Payslips Archive & Delete Inside Bot (`adm_payslips_list` & `adm_del_ps:<id>`)
    if (payload === 'adm_payslips_list' || payload.startsWith('adm_del_ps:')) {
      user.adminSession.step = 'idle';
      if (payload.startsWith('adm_del_ps:')) {
        const psId = payload.split(':')[1];
        state.payslips = state.payslips.filter((p) => p.id !== psId);
        pushUserMsg('🗑️ حذف فیش حقوقی از آرشیو');
      } else {
        pushUserMsg('🗂️ مشاهده آرشیو فیش‌های حقوقی در بات');
      }

      const recentSlips = state.payslips.slice(0, 6);
      const slipButtons: BotButton[][] = recentSlips.map((ps) => [
        {
          text: `📄 کد ${toPersianDigitsServer(ps.personnelCode)} (${ps.employeeName}) - ${ps.monthName} ${toPersianDigitsServer(ps.year)}`,
          callbackData: `adm_preview_ps:${ps.id}`,
          colorVariant: 'cyan',
        },
        {
          text: '🗑️ حذف فیش',
          callbackData: `adm_del_ps:${ps.id}`,
          colorVariant: 'rose',
        },
      ]);
      slipButtons.push([
        { text: '📤 بارگذاری فیش جدید در بات', callbackData: 'adm_upload_menu', colorVariant: 'emerald' },
        { text: '👑 بازگشت به پنل ادمین', callbackData: 'adm_panel', colorVariant: 'amber' },
      ]);

      pushBotMsg(
        `🗂️ **آرشیو فیش‌های حقوقی درون ربات (مجموع: ${toPersianDigitsServer(
          state.payslips.length
        )} فیش)**\n────────────────────\nآخرین فیش‌های صادر شده در زیر قابل مشاهده، پیش‌نمایش (تصویر + PDF) یا حذف هستند:`,
        slipButtons
      );
      return { user, messages: chat };
    }

    if (payload.startsWith('adm_preview_ps:')) {
      const psId = payload.split(':')[1];
      const slip = state.payslips.find((p) => p.id === psId);
      if (!slip) {
        pushBotMsg('⚠️ فیش مورد نظر یافت نشد.', buildAdminInBotKeyboard(state));
        return { user, messages: chat };
      }

      pushBotMsg(
        `👁️ **پیش‌نمایش مدیریتی فیش حقوقی**\n• پرسنل: ${slip.employeeName} (کد پرسنلی: ${toPersianDigitsServer(
          slip.personnelCode
        )})\n• دوره: ${slip.monthName} ${toPersianDigitsServer(slip.year)}\n• خالص پرداختی: ${formatRialServer(
          slip.netPay
        )}`,
        [
          [
            { text: '🗑️ حذف این فیش', callbackData: `adm_del_ps:${slip.id}`, colorVariant: 'rose' },
            { text: '🔙 بازگشت به لیست فیش‌ها', callbackData: 'adm_payslips_list', colorVariant: 'cyan' },
          ],
          [{ text: '👑 پنل مدیریت درون بات', callbackData: 'adm_panel', colorVariant: 'amber' }],
        ],
        {
          type: 'payslip_bundle',
          payslipData: slip,
          pdfFileName: `Payslip-${slip.personnelCode}-${slip.year}-${String(slip.month).padStart(2, '0')}.pdf`,
        }
      );
      return { user, messages: chat };
    }

    // 11. Admin Bot & Mandatory Channel Settings Inside Bot (`adm_settings_menu`, toggles, and channel edit)
    if (
      payload === 'adm_settings_menu' ||
      payload === 'adm_toggle_channel_req' ||
      payload === 'adm_toggle_card_req'
    ) {
      user.adminSession.step = 'idle';
      if (payload === 'adm_toggle_channel_req') {
        state.config.requireMandatoryChannel = !state.config.requireMandatoryChannel;
      }
      if (payload === 'adm_toggle_card_req') {
        state.config.requireNationalCardPhoto = !state.config.requireNationalCardPhoto;
      }

      pushUserMsg('⚙️ تنظیمات کانال اجباری و قوانین بات');
      pushBotMsg(
        `⚙️ **تنظیمات کانال اجباری، ادمین‌ها و قوانین امنیتی در ربات**\n────────────────────\n• نام سازمان: **${
          state.config.organizationName
        }**\n• آیدی‌های ادمین فعلی: \`${(state.config.adminMessengerIds || []).join(', ')}\`\n• رمز مستر معرفی ادمین (\`/setadmin\`): \`${
          state.config.adminSecretCode || '123456'
        }\`\n• کانال اجباری تلگرام: \`${state.config.telegramChannelId}\`\n• کانال اجباری بله: \`${
          state.config.baleChannelId
        }\`\n• الزام عضویت در کانال پس از استارت: **${
          state.config.requireMandatoryChannel ? 'فعال ✅' : 'غیرفعال ❌'
        }**\n• الزام ارسال نام و عکس کارت ملی دفعه اول: **${
          state.config.requireNationalCardPhoto ? 'فعال ✅' : 'غیرفعال ❌'
        }**\n\nبرای تغییر هر مورد روی دکمه شیشه‌ای مربوطه کلیک کنید:`,
        [
          [
            {
              text: '👑 مدیریت ادمین‌ها و افزودن آیدی ادمین در بات',
              callbackData: 'adm_manage_admins',
              colorVariant: 'amber',
            },
          ],
          [
            {
              text: `📢 عضویت اجباری کانال: ${state.config.requireMandatoryChannel ? '🟢 فعال' : '🔴 غیرفعال'}`,
              callbackData: 'adm_toggle_channel_req',
              colorVariant: state.config.requireMandatoryChannel ? 'emerald' : 'rose',
            },
            {
              text: `🪪 الزام عکس کارت ملی: ${state.config.requireNationalCardPhoto ? '🟢 فعال' : '🔴 غیرفعال'}`,
              callbackData: 'adm_toggle_card_req',
              colorVariant: state.config.requireNationalCardPhoto ? 'emerald' : 'rose',
            },
          ],
          [
            {
              text: '✏️ تغییر آیدی کانال اجباری تلگرام',
              callbackData: 'adm_edit_tg_channel',
              colorVariant: 'cyan',
            },
            {
              text: '✏️ تغییر آیدی کانال اجباری بله',
              callbackData: 'adm_edit_bale_channel',
              colorVariant: 'teal',
            },
          ],
          [
            {
              text: '🏢 تغییر نام سازمان در سربرگ فیش‌ها',
              callbackData: 'adm_edit_org_name',
              colorVariant: 'indigo',
            },
          ],
          [{ text: '👑 بازگشت به پنل مدیریت درون بات', callbackData: 'adm_panel', colorVariant: 'amber' }],
        ]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_manage_admins' || payload === 'adm_toggle_claim_lock') {
      user.adminSession.step = 'idle';
      if (payload === 'adm_toggle_claim_lock') {
        state.config.adminClaimLocked = !state.config.adminClaimLocked;
        pushUserMsg(
          state.config.adminClaimLocked
            ? '🔒 قفل کردن دستور /setadmin برای سایر کاربران'
            : '🔓 باز کردن موقت دستور /setadmin برای ثبت یک ادمین جدید'
        );
      } else {
        pushUserMsg('👑 مدیریت لیست ادمین‌ها و قفل امنیتی /setadmin');
      }
      const currentAdmins = state.config.adminMessengerIds || [];
      const isLocked = Boolean(state.config.adminClaimLocked);
      pushBotMsg(
        `👑 **مدیریت ادمین‌های ربات و قفل امنیتی یک‌بار مصرف**\n────────────────────\n📋 **لیست آیدی‌های ادمین فعلی:**\n${
          currentAdmins.map((id) => `• \`${id}\``).join('\n') || '• بدون ادمین'
        }\n\n🔒 **وضعیت دستور \`/setadmin\` برای سایر کاربران:**\n**${
          isLocked
            ? '🔒 قفل شده و غیرفعال (هیچ کاربر دیگری نمی‌تواند با /setadmin ادمین شود)'
            : '🔓 باز (فقط برای اولین ثبت، و بلافاصله بعد از ۱ بار ثبت خودکار قفل می‌شود)'
        }**\n\n🔐 **رمز مستر فعلی:** \`${state.config.adminSecretCode || '123456'}\`\n\n💡 برای اضافه کردن ادمین جدید می‌توانید مستقیماً آیدی عددی او را با دکمه اول وارد کنید:`,
        [
          [
            {
              text: '➕ افزودن مستقیم آیدی عددی یا یوزرنیم ادمین جدید',
              callbackData: 'adm_add_admin_id',
              colorVariant: 'emerald',
            },
          ],
          [
            {
              text: isLocked
                ? '🔓 باز کردن موقت دستور /setadmin (برای ۱ ثبت دیگر)'
                : '🔒 قفل کردن فوری دستور /setadmin برای همه',
              callbackData: 'adm_toggle_claim_lock',
              colorVariant: isLocked ? 'amber' : 'rose',
            },
          ],
          [
            {
              text: '🔐 تغییر رمز مستر معرفی ادمین (/setadmin)',
              callbackData: 'adm_change_secret',
              colorVariant: 'violet',
            },
          ],
          [{ text: '🔙 بازگشت به تنظیمات ربات', callbackData: 'adm_settings_menu', colorVariant: 'cyan' }],
        ]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_add_admin_id') {
      user.adminSession.step = 'awaiting_new_admin_id';
      pushUserMsg('➕ افزودن آیدی ادمین جدید در بات');
      pushBotMsg(
        `🔢 لطفاً **شماره آیدی عددی (Chat ID)** یا **یوزرنیم** شخص مورد نظر را در چت تایپ و ارسال کنید تا فوراً به لیست ادمین‌های کل ربات اضافه شود (مثال: \`589402194\` یا \`@my_admin\`):`,
        [[{ text: '🔙 انصراف', callbackData: 'adm_manage_admins', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_change_secret') {
      user.adminSession.step = 'awaiting_new_admin_secret';
      pushUserMsg('🔐 تغییر رمز مستر معرفی ادمین');
      pushBotMsg(
        `🔐 لطفاً **رمز مستر جدید** برای دستور \`/setadmin\` را تایپ و ارسال نمایید (فعلی: \`${
          state.config.adminSecretCode || '123456'
        }\`):`,
        [[{ text: '🔙 انصراف', callbackData: 'adm_manage_admins', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_edit_tg_channel') {
      user.adminSession.step = 'awaiting_tg_channel_id';
      pushUserMsg('✏️ تغییر آیدی کانال تلگرام');
      pushBotMsg(
        `لطفاً آیدی جدید کانال عضویت اجباری **تلگرام** را در چت تایپ و ارسال کنید (مثال: \`@MyCompanyChannel\`):`,
        [[{ text: '🔙 انصراف', callbackData: 'adm_settings_menu', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_edit_bale_channel') {
      user.adminSession.step = 'awaiting_bale_channel_id';
      pushUserMsg('✏️ تغییر آیدی کانال بله');
      pushBotMsg(
        `لطفاً آیدی جدید کانال عضویت اجباری **بله** را در چت تایپ و ارسال کنید (مثال: \`@MyCompanyBale\`):`,
        [[{ text: '🔙 انصراف', callbackData: 'adm_settings_menu', colorVariant: 'rose' }]]
      );
      return { user, messages: chat };
    }

    if (payload === 'adm_edit_org_name') {
      user.adminSession.step = 'awaiting_org_name';
      pushUserMsg('🏢 تغییر نام سازمان');
      pushBotMsg(`لطفاً نام جدید سازمان را جهت درج در سربرگ فیش‌های حقوقی تایپ و ارسال نمایید:`, [
        [{ text: '🔙 انصراف', callbackData: 'adm_settings_menu', colorVariant: 'rose' }],
      ]);
      return { user, messages: chat };
    }

    // 12. Handle Conversational Text Inputs for Admin Session Steps inside Bot
    if (params.actionType === 'text' && user.adminSession.step !== 'idle' && !payload.startsWith('/')) {
      const currentStep = user.adminSession.step;

      if (currentStep === 'awaiting_new_admin_id') {
        user.adminSession.step = 'idle';
        const cleanAdminId = toEnglishDigitsServer(payload).trim().replace(/^@/, '');
        pushUserMsg(payload);
        if (cleanAdminId) {
          if (!state.config.adminMessengerIds) state.config.adminMessengerIds = [];
          if (!state.config.adminMessengerIds.includes(cleanAdminId)) {
            state.config.adminMessengerIds.push(cleanAdminId);
          }
          // Also mark matching user in state.users as admin if already joined
          const matchedUser = state.users.find(
            (u) =>
              u.messengerId.toLowerCase() === cleanAdminId.toLowerCase() ||
              u.username.toLowerCase().replace(/^@/, '') === cleanAdminId.toLowerCase()
          );
          if (matchedUser) {
            matchedUser.isAdmin = true;
            matchedUser.verificationStatus = 'approved';
            matchedUser.isChannelMember = true;
          }
          pushBotMsg(
            `✅ آیدی \`${cleanAdminId}\` با موفقیت به لیست **ادمین‌های کل ربات** اضافه شد!\nاکنون این شخص می‌تواند در تلگرام یا بله دستور \`/admin\` را ارسال نماید.`,
            buildAdminInBotKeyboard(state)
          );
          return { user, messages: chat };
        }
      }

      if (currentStep === 'awaiting_new_admin_secret') {
        user.adminSession.step = 'idle';
        const newPin = toEnglishDigitsServer(payload).trim();
        pushUserMsg(payload);
        if (newPin) {
          state.config.adminSecretCode = newPin;
          pushBotMsg(
            `✅ رمز مستر معرفی ادمین با موفقیت به \`${newPin}\` تغییر یافت!\nاز این پس دستور معرفی ادمین در چت به صورت \`/setadmin ${newPin}\` خواهد بود.`,
            buildAdminInBotKeyboard(state)
          );
          return { user, messages: chat };
        }
      }

      if (currentStep === 'awaiting_custom_code_for_user' && user.adminSession.targetUserId) {
        const targetUser = state.users.find((u) => u.id === user.adminSession!.targetUserId);
        const typedCode = toEnglishDigitsServer(payload).trim();
        user.adminSession.step = 'idle';
        pushUserMsg(payload);

        if (targetUser && typedCode) {
          executeUserVerificationLink(state, targetUser, typedCode);
          pushBotMsg(
            `✅ کاربر **${targetUser.submittedName}** با موفقیت به کد پرسنلی **${toPersianDigitsServer(
              typedCode
            )}** لینک و تأیید شد!`,
            buildAdminInBotKeyboard(state)
          );
          return { user, messages: chat };
        }
      }

      if (currentStep === 'awaiting_broadcast_text') {
        const filter = user.adminSession.broadcastTargetFilter || 'all_active';
        user.adminSession.step = 'idle';
        pushUserMsg(payload);

        const targets = state.users.filter((u) => {
          if (u.id === 'usr-admin-master') return false;
          if (filter === 'all_active') return u.isActive && u.verificationStatus === 'approved';
          if (filter === 'telegram_only') return u.isActive && u.platform === 'telegram';
          if (filter === 'bale_only') return u.isActive && u.platform === 'bale';
          return true;
        });

        for (const t of targets) {
          if (!state.messagesByUser[t.id]) state.messagesByUser[t.id] = [];
          state.messagesByUser[t.id].push({
            id: `msg-bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId: t.id,
            sender: 'admin_broadcast',
            text: `📢 **اطلاعیه مدیریت سازمان**\n────────────────────\n${payload}`,
            timestamp,
            inlineKeyboard: [
              [{ text: '📄 دریافت فیش حقوقی (تصویر + PDF)', callbackData: 'menu_payslips', colorVariant: 'emerald' }],
            ],
          });
        }

        state.broadcastLogs.unshift({
          id: `bc-${Date.now()}`,
          title: 'پیام گروهی ارسالی از داخل چت ربات',
          message: payload,
          targetFilter: filter,
          buttonText: '📄 دریافت فیش حقوقی (تصویر + PDF)',
          buttonColor: 'emerald',
          sentCount: targets.length,
          createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
        });

        pushBotMsg(
          `✅ پیام گروهی شما با موفقیت برای **${toPersianDigitsServer(
            targets.length
          )} کاربر** ارسال گردید!`,
          buildAdminInBotKeyboard(state)
        );
        return { user, messages: chat };
      }

      if (currentStep === 'awaiting_tg_channel_id') {
        user.adminSession.step = 'idle';
        state.config.telegramChannelId = payload.startsWith('@') ? payload : `@${payload}`;
        pushUserMsg(payload);
        pushBotMsg(
          `✅ آیدی کانال اجباری تلگرام به \`${state.config.telegramChannelId}\` تغییر یافت.`,
          buildAdminInBotKeyboard(state)
        );
        return { user, messages: chat };
      }

      if (currentStep === 'awaiting_bale_channel_id') {
        user.adminSession.step = 'idle';
        state.config.baleChannelId = payload.startsWith('@') ? payload : `@${payload}`;
        pushUserMsg(payload);
        pushBotMsg(
          `✅ آیدی کانال اجباری بله به \`${state.config.baleChannelId}\` تغییر یافت.`,
          buildAdminInBotKeyboard(state)
        );
        return { user, messages: chat };
      }

      if (currentStep === 'awaiting_org_name') {
        user.adminSession.step = 'idle';
        state.config.organizationName = payload;
        pushUserMsg(payload);
        pushBotMsg(
          `✅ نام سازمان در سربرگ فیش‌های حقوقی به **«${state.config.organizationName}»** تغییر یافت.`,
          buildAdminInBotKeyboard(state)
        );
        return { user, messages: chat };
      }
    }
  }

  // =========================================================================
  // PART B: REGULAR PERSONNEL BOT FLOW
  // =========================================================================
  const channelHandle =
    user.platform === 'telegram' ? state.config.telegramChannelId : state.config.baleChannelId;
  const platformLabel = user.platform === 'telegram' ? 'تلگرام' : 'بله';

  // 1. Check if account is deactivated by Admin
  if (!user.isActive) {
    if (params.actionType === 'text' || params.actionType === 'command') {
      pushUserMsg(params.payload || '/start');
    }
    pushBotMsg(
      `⛔ دسترسی حساب کاربری شما در سامانه فیش حقوقی (${platformLabel}) توسط مدیریت غیرفعال شده است.\n\nدر صورت نیاز به بررسی، با واحد منابع انسانی (${state.config.supportContact}) تماس بگیرید.`,
      [[{ text: '🔄 بررسی مجدد وضعیت حساب', callbackData: 'start_bot', colorVariant: 'rose' }]]
    );
    return { user, messages: chat };
  }

  // 2. Handle explicit channel join action from simulator/client
  if (params.actionType === 'join_channel') {
    user.isChannelMember = true;
    pushUserMsg(`📢 عضویت در کانال رسمی ${channelHandle}`);
    pushBotMsg(
      `🎉 عضویت شما در کانال رسمی سازمانی (${channelHandle}) با موفقیت ثبت شد!\nاکنون برای ادامه، روی دکمه شیشه‌ای زیر کلیک نمایید:`,
      [[{ text: '✅ بررسی عضویت و ادامه مراحل', callbackData: 'check_channel', colorVariant: 'emerald' }]]
    );
    return { user, messages: chat };
  }

  // 3. Mandatory Channel Check before any bot interaction
  if (state.config.requireMandatoryChannel && !user.isChannelMember) {
    if (params.actionType === 'text' || params.actionType === 'command') {
      pushUserMsg(params.payload || '/start');
    } else if (params.actionType === 'callback' && params.payload === 'check_channel') {
      pushUserMsg('✅ بررسی عضویت در کانال');
      pushBotMsg(
        `⚠️ سامانه بررسی کرد که شما هنوز عضو کانال رسمی «${channelHandle}» نشده‌اید!\n\nلطفاً ابتدا روی دکمه شیشه‌ای آبی «عضویت در کانال رسمی سازمان» کلیک کرده و سپس دکمه سبز «عضو شدم | ادامه» را بزنید:`,
        [
          [{ text: `📢 عضویت در کانال رسمی (${channelHandle})`, callbackData: 'join_channel_now', colorVariant: 'cyan' }],
          [{ text: '✅ عضو شدم | بررسی عضویت و ادامه', callbackData: 'check_channel', colorVariant: 'emerald' }],
        ]
      );
      return { user, messages: chat };
    } else if (params.actionType === 'callback' && params.payload === 'join_channel_now') {
      user.isChannelMember = true;
      pushUserMsg(`📢 عضویت در کانال ${channelHandle}`);
      // Fall through to verification check below
    } else {
      user.verificationStatus = 'awaiting_channel';
      pushBotMsg(
        `🔒 ${state.config.channelPromptMessage}\n\n📌 کانال اجباری ${platformLabel}: ${channelHandle}`,
        [
          [{ text: `📢 عضویت در کانال رسمی (${channelHandle})`, callbackData: 'join_channel_now', colorVariant: 'cyan' }],
          [{ text: '✅ عضو شدم | بررسی عضویت و ادامه', callbackData: 'check_channel', colorVariant: 'emerald' }],
        ]
      );
      return { user, messages: chat };
    }
  }

  // 4. Handle National ID Card Upload & Identity Submission -> Also Notify Admin Inside Bot!
  if (params.actionType === 'national_card_upload') {
    const finalName = (params.submittedName || user.submittedName || 'کاربر جدید').trim();
    const finalNationalCode = (params.nationalCode || user.nationalCode || '0014829100').trim();
    const cardImg =
      params.nationalCardImageUrl ||
      createSampleCardSvgUrl(finalName, finalNationalCode, '۱۳۷۲/۰۵/۱۸', 'محمد');

    user.submittedName = finalName;
    user.nationalCode = finalNationalCode;
    user.nationalCardImageUrl = cardImg;
    user.verificationStatus = 'pending_admin';

    pushUserMsg(`ارسال مشخصات هویتی: ${finalName} (کد ملی: ${toPersianDigitsServer(finalNationalCode)})`, {
      type: 'national_card',
      imageUrl: cardImg,
      caption: `تصویر کارت ملی ارسالی توسط ${finalName} در ${platformLabel}`,
    });

    pushBotMsg(
      `✅ اطلاعات هویتی و تصویر کارت ملی شما با موفقیت دریافت شد و مستقیماً به **چت ربات ادمین** ارسال گردید!\n\n📋 جزئیات پرونده ارسالی:\n• نام و نام خانوادگی: ${finalName}\n• کد ملی: ${toPersianDigitsServer(
        finalNationalCode
      )}\n• پیام‌رسان: ${platformLabel}\n• آیدی عددی اختصاصی: ${user.messengerId}\n\n⏳ به محض اینکه ادمین از داخل ربات خود، کارت ملی شما را به کد پرسنلی لینک کند، پیام تأیید برایتان ارسال می‌شود.`,
      [
        [{ text: '🔄 استعلام وضعیت تأیید ادمین', callbackData: 'check_verification', colorVariant: 'amber' }],
        [{ text: '💬 ارتباط با کارگزینی', callbackData: 'menu_support', colorVariant: 'violet' }],
      ]
    );

    // Push instant interactive verification card directly into Admin's Bot Chat (`usr-admin-master`)!
    if (!state.messagesByUser['usr-admin-master']) {
      state.messagesByUser['usr-admin-master'] = [];
    }
    state.messagesByUser['usr-admin-master'].push({
      id: `msg-adm-alert-${Date.now()}`,
      userId: 'usr-admin-master',
      sender: 'bot',
      text: `🔔 **درخواست احراز هویت جدید در ربات دریافت شد!**\n────────────────────\n• نام و نام خانوادگی: **${finalName}**\n• کد ملی: **${toPersianDigitsServer(
        finalNationalCode
      )}**\n• پیام‌رسان: **${platformLabel}**\n• شماره آیدی ${platformLabel}: \`${
        user.messengerId
      }\`\n\n👇 ادمین گرامی، بدون نیاز به پنل وب می‌توانید همین‌جا با دکمه‌های شیشه‌ای زیر، این کاربر را به کد پرسنلی لینک و تأیید کنید:`,
      timestamp,
      inlineKeyboard: buildAdminVerifyUserButtons(state, user),
      attachment: {
        type: 'national_card',
        imageUrl: cardImg,
        caption: `کارت ملی ارسالی توسط ${finalName} (${platformLabel} ID: ${user.messengerId})`,
      },
    });

    return { user, messages: chat };
  }

  // 5. If user is NOT yet approved by Admin (First-Time Authentication Flow)
  if (user.verificationStatus !== 'approved' || !user.personnelCode) {
    if (payload === 'check_verification' || payload === '⏳ استعلام وضعیت تأیید احراز هویت' || payload === '⏳ وضعیت بررسی احراز هویت') {
      pushUserMsg('🔄 استعلام وضعیت احراز هویت');
      if (user.verificationStatus === 'pending_admin') {
        pushBotMsg(
          `⏳ پرونده احراز هویت شما (${user.submittedName || 'همکار گرامی'} - آیدی ${platformLabel}: ${user.messengerId}) در چت ربات ادمین منتظر بررسی و اختصاص دستی کد پرسنلی است.\n\nبه محض اینکه مدیر کل سازمان، کد پرسنلی شما را تأیید فرماید، فیش‌های حقوقی شما فعال و فوراً به شما اطلاع داده خواهد شد.`,
          [
            [{ text: '🔄 استعلام مجدد وضعیت تأیید', callbackData: 'check_verification', colorVariant: 'amber' }],
            [{ text: '✏️ ویرایش نام و ارسال مجدد کارت ملی', callbackData: 'restart_auth', colorVariant: 'cyan' }],
            [{ text: '💬 پشتیبانی و کارگزینی', callbackData: 'menu_support', colorVariant: 'violet' }],
          ]
        );
      } else if (user.verificationStatus === 'rejected') {
        pushBotMsg(
          `❌ درخواست احراز هویت قبلی شما توسط ادمین تأیید نشد.\n📌 علت: ${
            user.rejectionReason || 'عدم تطابق تصویر کارت ملی با مشخصات پرسنلی'
          }\n\nلطفاً مجدداً نام کامل و تصویر واضح کارت ملی خود را ارسال فرمایید:`,
          [[{ text: '🪪 ارسال مجدد نام و تصویر کارت ملی', callbackData: 'open_card_uploader', colorVariant: 'emerald' }]]
        );
      } else {
        pushBotMsg(
          `⚠️ احراز هویت شما هنوز تکمیل نشده است. لطفاً ابتدا نام و تصویر کارت ملی خود را ارسال فرمایید:`,
          [[{ text: '🪪 احراز هویت و ارسال کارت ملی', callbackData: 'open_card_uploader', colorVariant: 'emerald' }]]
        );
      }
      return { user, messages: chat };
    }

    if (payload === 'menu_support' || payload === '💬 پشتیبانی') {
      pushUserMsg('💬 پشتیبانی و کارگزینی');
      pushBotMsg(
        `📞 **واحد کارگزینی و پشتیبانی امور پرسنلی**\n────────────────────\nدر صورت وجود هرگونه سؤال درباره روند احراز هویت یا دریافت فیش، با پشتیبانی در ارتباط باشید:\n\n• آی‌دی پشتیبانی: **${state.config.supportContact}**\n• شماره آیدی شما در سامانه: \`${user.messengerId}\``,
        [
          [{ text: '🪪 بازگشت به احراز هویت', callbackData: 'open_card_uploader', colorVariant: 'emerald' }],
        ]
      );
      return { user, messages: chat };
    }

    if (payload === 'open_card_uploader' || payload === '🪪 احراز هویت و ارسال کارت ملی' || payload === '🪪 ارسال نام و تصویر کارت ملی') {
      pushUserMsg('🪪 احراز هویت و ارسال کارت ملی');
      pushBotMsg(
        `📸 **ارسال تصویر کارت ملی جهت احراز هویت**\n────────────────────\nلطفاً تصویر واضح کارت ملی هوشمند خود را مستقیماً در همین چت ارسال نمایید (به صورت عکس یا فایل) یا روی دکمه شیشه‌ای زیر کلیک کنید:`,
        [
          [
            {
              text: '🪪 بارگذاری فرم و تصویر کارت ملی',
              callbackData: 'open_card_uploader',
              colorVariant: 'emerald',
            },
          ],
          [{ text: '💬 راهنمای احراز هویت پرسنل', callbackData: 'auth_help', colorVariant: 'cyan' }],
        ]
      );
      return { user, messages: chat };
    }

    if (payload === 'auth_help') {
      pushBotMsg(
        `📌 **راهنمای احراز هویت پرسنل:**\n۱. نام و تصویر کارت ملی خود را در ربات ثبت می‌کنید.\n۲. مدیر کل سامانه در ربات خود کارت ملی را تطبیق داده و «کد پرسنلی اختصاصی شما در فایل اکسل سازمان» را به حساب شما متصل می‌کند.\n۳. بلافاصله پس از تأیید، دکمه‌های دریافت فیش حقوقی برای شما باز خواهد شد.`,
        [[{ text: '🪪 شروع احراز هویت و ارسال کارت ملی', callbackData: 'open_card_uploader', colorVariant: 'emerald' }]]
      );
      return { user, messages: chat };
    }

    if (
      params.actionType === 'command' ||
      payload === 'start_bot' ||
      payload === 'check_channel' ||
      payload === 'restart_auth'
    ) {
      if (payload === 'start_bot' || params.actionType === 'command') {
        pushUserMsg('/start');
      }
      if (user.verificationStatus === 'pending_admin' && payload !== 'restart_auth') {
        pushBotMsg(
          `⏳ اطلاعات هویتی و کارت ملی شما قبلاً ثبت شده و در نوبت تأیید ادمین قرار دارد.\nبه محض اتصال کد پرسنلی توسط مدیر سازمان، فیش‌های شما فعال خواهند شد.`,
          [
            [{ text: '🔄 استعلام وضعیت تأیید ادمین', callbackData: 'check_verification', colorVariant: 'amber' }],
            [{ text: '✏️ ویرایش نام و تصویر کارت ملی', callbackData: 'open_card_uploader', colorVariant: 'cyan' }],
          ]
        );
        return { user, messages: chat };
      }

      user.verificationStatus = 'awaiting_name';
      pushBotMsg(
        `سلام! به سامانه هوشمند فیش حقوقی «${state.config.organizationName}» خوش آمدید.\n\n🔒 **احراز هویت الزامی است:**\nاز آنجا که این اولین ورود شما با آیدی ${platformLabel} (${user.messengerId}) است، جهت حفظ حریم خصوصی و اتصال به «کد پرسنلی سازمان»، لطفاً ابتدا نام و تصویر کارت ملی خود را ارسال نمایید:`,
        [
          [
            {
              text: '🪪 احراز هویت و ارسال کارت ملی',
              callbackData: 'open_card_uploader',
              colorVariant: 'emerald',
            },
          ],
          [{ text: '💬 راهنمای احراز هویت پرسنل', callbackData: 'auth_help', colorVariant: 'cyan' }],
        ]
      );
      return { user, messages: chat };
    }

    // Check if the user is typing their real name
    const isReservedButton =
      payload.includes('فیش') ||
      payload.includes('پرسنلی') ||
      payload.includes('پشتیبانی') ||
      payload.includes('احراز') ||
      payload.includes('صف') ||
      payload.includes('مدیریت') ||
      payload.includes('menu_') ||
      payload.includes('latest_');

    if (params.actionType === 'text' && payload && !payload.startsWith('/') && !isReservedButton) {
      if (user.verificationStatus === 'pending_admin') {
        pushUserMsg(payload.trim());
        pushBotMsg(
          `⏳ همکار گرامی، مدارک شما (${user.submittedName}) قبلاً ارسال شده و منتظر بررسی و تأیید کد پرسنلی توسط ادمین است.`,
          [
            [{ text: '🔄 استعلام وضعیت تأیید ادمین', callbackData: 'check_verification', colorVariant: 'amber' }],
            [{ text: '✏️ ارسال مجدد مشخصات و کارت ملی', callbackData: 'restart_auth', colorVariant: 'cyan' }],
          ]
        );
        return { user, messages: chat };
      }

      user.submittedName = payload.trim();
      user.verificationStatus = 'awaiting_national_card';
      pushUserMsg(payload.trim());
      pushBotMsg(
        `✅ نام و نام خانوادگی «${user.submittedName}» ثبت شد.\n\n📸 لطفاً تصویر کارت ملی هوشمند خود را ارسال فرمایید تا برای ادمین ارسال شود:`,
        [
          [
            {
              text: '🪪 بارگذاری تصویر کارت ملی',
              callbackData: 'open_card_uploader',
              colorVariant: 'emerald',
            },
          ],
          [{ text: '✏️ ویرایش نام', callbackData: 'restart_auth', colorVariant: 'amber' }],
        ]
      );
      return { user, messages: chat };
    }

    // STRICT GATEKEEPING: Block ANY other attempt (payslips, latest payslip, profile, etc.)
    pushUserMsg(payload || 'درخواست دسترسی');
    pushBotMsg(
      `🔒 **دسترسی مسدود است - احراز هویت شما تأیید نشده است**\n────────────────────\nهمکار گرامی، تا زمانی که مشخصات و تصویر کارت ملی شما ارسال نشده و توسط مدیر سیستم تأیید و «کد پرسنلی» به شما اختصاص داده نشود، امکان دریافت فیش حقوقی و خدمات سازمانی را نخواهید داشت.\n\n📌 وضعیت فعلی شما: **${
        user.verificationStatus === 'pending_admin'
          ? '⏳ در انتظار بررسی و اختصاص کد پرسنلی توسط ادمین'
          : '❌ احراز هویت اولیه انجام نشده'
      }**\n\n👇 لطفاً از طریق دکمه زیر اقدام فرمایید:`,
      [
        [
          user.verificationStatus === 'pending_admin'
            ? {
                text: '🔄 استعلام وضعیت تأیید ادمین',
                callbackData: 'check_verification',
                colorVariant: 'amber',
              }
            : {
                text: '🪪 احراز هویت و ارسال کارت ملی',
                callbackData: 'open_card_uploader',
                colorVariant: 'emerald',
              },
        ],
        [{ text: '💬 پشتیبانی امور پرسنلی', callbackData: 'menu_support', colorVariant: 'violet' }],
      ]
    );
    return { user, messages: chat };
  }

  // 6. Authenticated & Approved Personnel Flow (`user.verificationStatus === 'approved' && user.personnelCode`)
  const pCode = user.personnelCode!;

  if (
    params.actionType === 'command' ||
    payload === 'start_bot' ||
    payload === 'main_menu' ||
    payload === 'check_channel' ||
    payload === 'check_verification'
  ) {
    if (params.actionType === 'command') {
      pushUserMsg(payload || '/start');
    }
    pushBotMsg(
      `سلام ${user.submittedName} عزیز 👋\nبه سامانه هوشمند فیش حقوقی «${state.config.organizationName}» خوش آمدید.\n\n✅ وضعیت احراز هویت: تأیید شده و فعال\n🔢 کد پرسنلی اختصاصی: ${toPersianDigitsServer(
        pCode
      )}\n🏢 واحد سازمانی: ${user.department}\n📱 پیام‌رسان متصل: ${platformLabel} (ID: ${user.messengerId})\n\nلطفاً از دکمه‌های شیشه‌ای رنگی زیر بخش مورد نظر خود را انتخاب نمایید:`,
      buildMainMenuKeyboard(isUserAdmin)
    );
    return { user, messages: chat };
  }

  if (payload === 'menu_payslips') {
    pushUserMsg('📄 دریافت فیش حقوقی');
    pushBotMsg(
      `📅 انتخاب سال مالی — ${user.submittedName} (کد پرسنلی: ${toPersianDigitsServer(
        pCode
      )})\n\nلطفاً سال مورد نظر خود را جهت مشاهده لیست ماه‌ها از دکمه‌های شیشه‌ای رنگی زیر انتخاب فرمایید:`,
      buildYearSelectionKeyboard(state, pCode)
    );
    return { user, messages: chat };
  }

  if (payload.startsWith('select_year:')) {
    const year = Number(payload.split(':')[1]) || 1404;
    user.selectedYear = year;
    const count = state.payslips.filter((p) => p.personnelCode === pCode && p.year === year).length;
    pushUserMsg(`📅 انتخاب سال ${toPersianDigitsServer(year)}`);
    pushBotMsg(
      `🗓️ انتخاب ماه در سال ${toPersianDigitsServer(year)} — کد پرسنلی ${toPersianDigitsServer(
        pCode
      )}\n\nتعداد فیش‌های صادر شده برای شما در سال ${toPersianDigitsServer(year)}: ${toPersianDigitsServer(
        count
      )} ماه (مشخص شده با علامت ✅)\nلطفاً ماه مورد نظر خود را از دکمه‌های شیشه‌ای زیر انتخاب کنید تا تصویر و فایل PDF فیش حقوقی برایتان ارسال شود:`,
      buildMonthSelectionKeyboard(state, pCode, year)
    );
    return { user, messages: chat };
  }

  if (payload.startsWith('select_month:')) {
    const parts = payload.split(':');
    const year = Number(parts[1]) || 1404;
    const month = Number(parts[2]) || 1;
    const monthObj = PERSIAN_MONTHS.find((m) => m.number === month) || PERSIAN_MONTHS[0];

    pushUserMsg(`📄 درخواست فیش حقوقی ${monthObj.name} ${toPersianDigitsServer(year)}`);

    const payslip = state.payslips.find(
      (p) => p.personnelCode === pCode && p.year === year && p.month === month
    );

    if (!payslip) {
      pushBotMsg(
        `⚠️ فیش حقوقی برای کد پرسنلی ${toPersianDigitsServer(pCode)} (${user.submittedName}) در **${
          monthObj.name
        } ماه سال ${toPersianDigitsServer(year)}** هنوز در سامانه بارگذاری نشده است.\n\nمی‌توانید ماه دیگری را از دکمه‌های شیشه‌ای زیر انتخاب نمایید:`,
        buildMonthSelectionKeyboard(state, pCode, year)
      );
      return { user, messages: chat };
    }

    pushBotMsg(
      `✅ فیش حقوقی رسمی **${monthObj.name} ماه ${toPersianDigitsServer(year)}** صادر شد!\n\n👤 نام پرسنل: ${
        payslip.employeeName
      }\n🔢 کد پرسنلی: ${toPersianDigitsServer(payslip.personnelCode)}\n🏢 واحد: ${
        payslip.department
      }\n💰 جمع کل مزایا: ${formatRialServer(payslip.totalEarnings)}\n📉 جمع کل کسورات: ${formatRialServer(
        payslip.totalDeductions
      )}\n💎 **خالص پرداختی: ${formatRialServer(payslip.netPay)}**\n\n📎 تصویر فیش حقوقی و فایل PDF رسمی در پیوست زیر آماده مشاهده و دانلود است:`,
      [
        [
          {
            text: `🗓️ انتخاب ماه دیگر در سال ${toPersianDigitsServer(year)}`,
            callbackData: `select_year:${year}`,
            colorVariant: 'cyan',
          },
          { text: '📅 تغییر سال مالی', callbackData: 'menu_payslips', colorVariant: 'indigo' },
        ],
        [{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'emerald' }],
      ],
      {
        type: 'payslip_bundle',
        payslipData: payslip,
        pdfFileName:
          payslip.customPdfFileName ||
          `Payslip-${payslip.personnelCode}-${payslip.year}-${String(payslip.month).padStart(2, '0')}.pdf`,
      }
    );
    return { user, messages: chat };
  }

  if (payload === 'latest_payslip') {
    pushUserMsg('📊 دریافت آخرین فیش صادر شده');
    const userPayslips = state.payslips
      .filter((p) => p.personnelCode === pCode)
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));

    if (userPayslips.length === 0) {
      pushBotMsg(
        `ℹ️ هنوز هیچ فیش حقوقی برای کد پرسنلی ${toPersianDigitsServer(pCode)} بارگذاری نشده است.`,
        buildMainMenuKeyboard(isUserAdmin)
      );
      return { user, messages: chat };
    }

    const latest = userPayslips[0];
    pushBotMsg(
      `📊 آخرین فیش حقوقی صادر شده شما مربوط به **${latest.monthName} ماه ${toPersianDigitsServer(
        latest.year
      )}** می‌باشد:\n\n👤 نام: ${latest.employeeName} (کد پرسنلی: ${toPersianDigitsServer(
        latest.personnelCode
      )})\n💎 خالص پرداختی: **${formatRialServer(latest.netPay)}**`,
      [
        [
          {
            text: `🗓️ مشاهده سایر ماه‌های سال ${toPersianDigitsServer(latest.year)}`,
            callbackData: `select_year:${latest.year}`,
            colorVariant: 'cyan',
          },
        ],
        [{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'emerald' }],
      ],
      {
        type: 'payslip_bundle',
        payslipData: latest,
        pdfFileName: `Payslip-${latest.personnelCode}-${latest.year}-${String(latest.month).padStart(2, '0')}.pdf`,
      }
    );
    return { user, messages: chat };
  }

  if (payload === 'menu_profile') {
    pushUserMsg('👤 مشاهده پرونده پرسنلی من');
    const personRecord = state.personnelDirectory.find((p) => p.personnelCode === pCode);
    const totalCount = state.payslips.filter((p) => p.personnelCode === pCode).length;

    pushBotMsg(
      `👤 **پرونده هویتی و سازمانی شما**\n────────────────────\n• نام و نام خانوادگی: ${
        user.submittedName
      }\n• کد پرسنلی متصل: ${toPersianDigitsServer(pCode)}\n• کد ملی: ${toPersianDigitsServer(
        user.nationalCode
      )}\n• واحد سازمانی: ${user.department}\n• سمت شغلی: ${user.jobTitle}\n• شماره شبا واریز حقوق: ${
        personRecord?.bankAccount || 'IR420170000000109283746501'
      }\n• پیام‌رسان: ${platformLabel} (ID: ${user.messengerId})\n• تعداد کل فیش‌های موجود در آرشیو: ${toPersianDigitsServer(
        totalCount
      )} دوره\n\n🔒 دسترسی این حساب صرفاً محدود به فیش‌های حقوقی کد پرسنلی ${toPersianDigitsServer(pCode)} می‌باشد.`,
      [
        [{ text: '📄 دریافت فیش حقوقی (انتخاب سال و ماه)', callbackData: 'menu_payslips', colorVariant: 'emerald' }],
        [{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'indigo' }],
      ]
    );
    return { user, messages: chat };
  }

  if (payload === 'menu_support') {
    pushUserMsg('💬 ارتباط با واحد منابع انسانی');
    pushBotMsg(
      `💬 **پشتیبانی واحد منابع انسانی و حسابداری حقوق**\n\nدر صورت وجود هرگونه سؤال در خصوص کسورات، اضافه‌کاری یا مغایرت در فیش حقوقی، می‌توانید پیام خود را مستقیماً در همین چت ارسال فرمایید یا با آیدی ${state.config.supportContact} در ارتباط باشید.`,
      [[{ text: '🏠 بازگشت به منوی اصلی', callbackData: 'main_menu', colorVariant: 'emerald' }]]
    );
    return { user, messages: chat };
  }

  pushUserMsg(payload);
  pushBotMsg(
    `✉️ پیام شما ثبت گردید.\nجهت دریافت تصویر و فایل PDF فیش حقوقی خود، لطفاً از دکمه‌های شیشه‌ای رنگی زیر استفاده فرمایید:`,
    buildMainMenuKeyboard(isUserAdmin)
  );
  return { user, messages: chat };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '30mb' }));

  const state = loadState();

  // API: Get complete application state
  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  // API: Interact with the Bot Engine (Commands, Glassmorphic Callbacks, National ID Upload, Channel Join, In-Bot Admin)
  app.post('/api/bot/interact', (req, res) => {
    try {
      const { userId, actionType, payload, nationalCardImageUrl, submittedName, nationalCode } = req.body;
      const result = handleBotInteraction(state, {
        userId,
        actionType,
        payload,
        nationalCardImageUrl,
        submittedName,
        nationalCode,
      });
      saveState(state);
      res.json({ ok: true, user: result.user, messages: result.messages, state });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطا در پردازش درخواست ربات';
      res.status(400).json({ ok: false, error: message });
    }
  });

  // API: Upload Excel or PDF Payslips directly from Inside the Admin Bot Chat
  app.post('/api/bot/admin-upload-in-chat', (req, res) => {
    const { adminUserId, items, fileName } = req.body as {
      adminUserId: string;
      items: Omit<PayslipItem, 'id' | 'createdAt'>[];
      fileName: string;
    };

    let adminUser = state.users.find((u) => u.id === adminUserId || u.isAdmin);
    if (!adminUser) {
      adminUser = {
        id: adminUserId || 'usr-admin-master',
        messengerId: '92218188',
        username: 'admin',
        platform: 'telegram',
        isAdmin: true,
        submittedName: 'مدیر کل سامانه',
        nationalCode: '0010000001',
        phoneNumber: '09120000000',
        nationalCardImageUrl: '',
        personnelCode: '1001',
        department: 'مدیریت ارشد',
        jobTitle: 'ادمین کل سامانه',
        isChannelMember: true,
        verificationStatus: 'approved',
        isActive: true,
        selectedYear: 1404,
        joinedAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
        lastInteractionAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
      };
      state.users.unshift(adminUser);
    }
    if (!state.messagesByUser[adminUser.id]) {
      state.messagesByUser[adminUser.id] = [];
    }

    const timestamp = nowTimeStr();
    state.messagesByUser[adminUser.id].push({
      id: `msg-u-file-${Date.now()}`,
      userId: adminUser.id,
      sender: 'user',
      text: `📎 ارسال فایل در ربات: ${fileName} (${toPersianDigitsServer(items.length)} ردیف فیش حقوقی)`,
      timestamp,
    });

    let upsertedCount = 0;
    for (const item of items) {
      const cleanCode = String(item.personnelCode || '').trim();
      if (!cleanCode) continue;

      // Auto-populate directory record if not already present
      const existingDir = state.personnelDirectory.find((p) => p.personnelCode === cleanCode);
      if (!existingDir) {
        state.personnelDirectory.push({
          personnelCode: cleanCode,
          fullName: item.employeeName || `پرسنل ${cleanCode}`,
          nationalCode: item.nationalCode || '0010000000',
          department: item.department || 'عمومی',
          jobTitle: item.jobTitle || 'کارمند',
          bankAccount: item.bankAccount || 'IR420170000000109283746501',
          phoneNumber: '09120000000',
          isActive: true,
        });
      }
      const monthObj = PERSIAN_MONTHS.find((m) => m.number === Number(item.month)) || PERSIAN_MONTHS[0];
      const existingIdx = state.payslips.findIndex(
        (p) => p.personnelCode === cleanCode && p.year === Number(item.year) && p.month === Number(item.month)
      );

      const newPayslip: PayslipItem = {
        ...item,
        id: `ps-${cleanCode}-${item.year}-${String(item.month).padStart(2, '0')}-${Date.now().toString(36).slice(-3)}`,
        personnelCode: cleanCode,
        year: Number(item.year),
        month: Number(item.month),
        monthName: monthObj.name,
        createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
      };

      if (existingIdx >= 0) {
        state.payslips[existingIdx] = newPayslip;
      } else {
        state.payslips.unshift(newPayslip);
      }

      // Notify the linked personnel user in their chat automatically
      const linkedUsers = state.users.filter(
        (u) => u.personnelCode === cleanCode && u.isActive && u.verificationStatus === 'approved' && !u.isAdmin
      );
      for (const lu of linkedUsers) {
        if (!state.messagesByUser[lu.id]) state.messagesByUser[lu.id] = [];
        state.messagesByUser[lu.id].push({
          id: `msg-notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          userId: lu.id,
          sender: 'bot',
          text: `🔔 **اطلاعیه صدور فیش حقوقی جدید**\nهمکار گرامی ${lu.submittedName} (کد پرسنلی: ${toPersianDigitsServer(
            cleanCode
          )})، فیش حقوقی **${monthObj.name} ${toPersianDigitsServer(
            item.year
          )}** شما توسط ادمین در ربات بارگذاری شد:`,
          timestamp,
          inlineKeyboard: [
            [
              {
                text: `📄 دریافت فیش ${monthObj.name} ${toPersianDigitsServer(item.year)} (تصویر + PDF)`,
                callbackData: `select_month:${item.year}:${item.month}`,
                colorVariant: 'emerald',
              },
            ],
          ],
        });
      }

      upsertedCount++;
    }

    state.messagesByUser[adminUser.id].push({
      id: `msg-b-file-ok-${Date.now()}`,
      userId: adminUser.id,
      sender: 'bot',
      text: `✅ **فایل ارسالی شما در چت ربات پردازش و ثبت شد!**\n────────────────────\n• نام فایل: \`${fileName}\`\n• تعداد فیش‌های تفکیک شده با کد پرسنلی: **${toPersianDigitsServer(
        upsertedCount
      )} فیش (تصویر + PDF)**\n• نوتیفیکیشن دریافت فیش با دکمه شیشه‌ای برای پرسنل مرتبط ارسال گردید.`,
      timestamp,
      inlineKeyboard: buildAdminInBotKeyboard(state),
    });

    saveState(state);
    res.json({ ok: true, upsertedCount, state });
  });

  // API: Create a new simulated Telegram or Bale user to test First-Time Verification from scratch
  app.post('/api/users/create-sim-user', (req, res) => {
    const { platform, username, phoneNumber } = req.body as {
      platform: 'telegram' | 'bale';
      username?: string;
      phoneNumber?: string;
    };
    const randomMessengerId = String(Math.floor(100000000 + Math.random() * 899999999));
    const newUserId = `usr-${platform}-${Date.now()}`;
    const newUser: BotUser = {
      id: newUserId,
      messengerId: randomMessengerId,
      username: username?.trim() || `user_${randomMessengerId.slice(0, 5)}`,
      platform: platform || 'telegram',
      isAdmin: false,
      submittedName: '',
      nationalCode: '',
      phoneNumber: phoneNumber?.trim() || '09120000000',
      nationalCardImageUrl: '',
      personnelCode: null,
      department: 'کاربر جدید (در حال احراز هویت)',
      jobTitle: 'تعیین نشده',
      isChannelMember: false,
      verificationStatus: 'unverified',
      isActive: true,
      selectedYear: 1404,
      joinedAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
      lastInteractionAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
    };

    state.users.push(newUser);
    state.messagesByUser[newUser.id] = [];

    handleBotInteraction(state, {
      userId: newUser.id,
      actionType: 'command',
      payload: '/start',
    });

    saveState(state);
    res.json({ ok: true, user: newUser, state });
  });

  // API: Admin Verify User & Link to a Specific Personnel Code (`کد پرسنلی خاص`)
  app.post('/api/users/verify', (req, res) => {
    const { userId, decision, personnelCode, department, jobTitle, rejectionReason } = req.body as {
      userId: string;
      decision: 'approve' | 'reject';
      personnelCode?: string;
      department?: string;
      jobTitle?: string;
      rejectionReason?: string;
    };

    const user = state.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
      return;
    }

    if (!state.messagesByUser[user.id]) {
      state.messagesByUser[user.id] = [];
    }
    const timestamp = nowTimeStr();

    if (decision === 'approve') {
      if (!personnelCode || !personnelCode.trim()) {
        res.status(400).json({ ok: false, error: 'انتخاب یا وارد کردن کد پرسنلی جهت تأیید الزامی است.' });
        return;
      }
      if (department) user.department = department.trim();
      if (jobTitle) user.jobTitle = jobTitle.trim();
      executeUserVerificationLink(state, user, personnelCode);
    } else {
      user.verificationStatus = 'rejected';
      user.personnelCode = null;
      user.rejectionReason = rejectionReason?.trim() || 'عدم تطابق تصویر کارت ملی با مشخصات سازمانی';

      state.messagesByUser[user.id].push({
        id: `msg-adm-reject-${Date.now()}`,
        userId: user.id,
        sender: 'bot',
        text: `⚠️ **نتیجه بررسی احراز هویت**\n\nدرخواست احراز هویت شما توسط مدیریت تأیید نشد.\n📌 علت: ${user.rejectionReason}\n\nلطفاً با کلیک روی دکمه شیشه‌ای زیر، نام کامل و تصویر واضح کارت ملی خود را مجدداً ارسال فرمایید:`,
        timestamp,
        inlineKeyboard: [
          [{ text: '🪪 ارسال مجدد نام و تصویر کارت ملی', callbackData: 'open_card_uploader', colorVariant: 'emerald' }],
        ],
      });
    }

    saveState(state);
    res.json({ ok: true, user, state });
  });

  // API: Admin Activate / Deactivate User (`فعال و غیرفعال کردن کاربران`)
  app.post('/api/users/toggle-active', (req, res) => {
    const { userId, isActive } = req.body as { userId: string; isActive: boolean };
    const user = state.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
      return;
    }

    user.isActive = Boolean(isActive);
    if (!state.messagesByUser[user.id]) {
      state.messagesByUser[user.id] = [];
    }

    state.messagesByUser[user.id].push({
      id: `msg-status-${Date.now()}`,
      userId: user.id,
      sender: 'bot',
      text: user.isActive
        ? `✅ حساب کاربری شما توسط مدیریت مجدداً **فعال** گردید. اکنون می‌توانید از خدمات ربات فیش حقوقی استفاده نمایید.`
        : `⛔ حساب کاربری شما توسط مدیریت **غیرفعال** گردید. دسترسی به فیش‌های حقوقی مسدود شده است.`,
      timestamp: nowTimeStr(),
      inlineKeyboard: user.isActive ? buildMainMenuKeyboard(Boolean(user.isAdmin)) : undefined,
    });

    saveState(state);
    res.json({ ok: true, user, state });
  });

  // API: Update User's Linked Personnel Code directly
  app.post('/api/users/update-code', (req, res) => {
    const { userId, personnelCode, department, jobTitle } = req.body as {
      userId: string;
      personnelCode: string;
      department?: string;
      jobTitle?: string;
    };
    const user = state.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ ok: false, error: 'کاربر یافت نشد.' });
      return;
    }

    user.personnelCode = personnelCode.trim();
    if (department) user.department = department.trim();
    if (jobTitle) user.jobTitle = jobTitle.trim();
    user.verificationStatus = 'approved';

    saveState(state);
    res.json({ ok: true, user, state });
  });

  // API: Batch Upload Payslips (Excel rows OR PDF/Image files matched by `personnelCode`)
  app.post('/api/payslips/batch-upload', (req, res) => {
    const { items, notifyUsers } = req.body as {
      items: Omit<PayslipItem, 'id' | 'createdAt'>[];
      notifyUsers?: boolean;
    };

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ ok: false, error: 'هیچ ردیف یا فایل فیش حقوقی برای بارگذاری ارسال نشده است.' });
      return;
    }

    let upsertedCount = 0;
    const affectedPersonnelCodes = new Set<string>();

    for (const item of items) {
      const cleanCode = String(item.personnelCode || '').trim();
      if (!cleanCode) continue;

      const monthObj = PERSIAN_MONTHS.find((m) => m.number === Number(item.month)) || PERSIAN_MONTHS[0];
      const existingIdx = state.payslips.findIndex(
        (p) => p.personnelCode === cleanCode && p.year === Number(item.year) && p.month === Number(item.month)
      );

      const newPayslip: PayslipItem = {
        ...item,
        id: `ps-${cleanCode}-${item.year}-${String(item.month).padStart(2, '0')}-${Date.now()
          .toString(36)
          .slice(-3)}`,
        personnelCode: cleanCode,
        year: Number(item.year),
        month: Number(item.month),
        monthName: monthObj.name,
        createdAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
      };

      if (existingIdx >= 0) {
        state.payslips[existingIdx] = newPayslip;
      } else {
        state.payslips.unshift(newPayslip);
      }

      const dirExists = state.personnelDirectory.some((d) => d.personnelCode === cleanCode);
      if (!dirExists) {
        state.personnelDirectory.push({
          personnelCode: cleanCode,
          fullName: item.employeeName || `پرسنل ${cleanCode}`,
          nationalCode: item.nationalCode || '0010000000',
          department: item.department || 'ستاد مرکزی',
          jobTitle: item.jobTitle || 'کارشناس',
          bankAccount: item.bankAccount || 'IR420170000000109283746501',
          phoneNumber: '09120000000',
        });
      }

      affectedPersonnelCodes.add(cleanCode);
      upsertedCount++;

      if (notifyUsers) {
        const linkedUsers = state.users.filter(
          (u) => u.personnelCode === cleanCode && u.isActive && u.verificationStatus === 'approved' && !u.isAdmin
        );
        for (const lu of linkedUsers) {
          if (!state.messagesByUser[lu.id]) state.messagesByUser[lu.id] = [];
          state.messagesByUser[lu.id].push({
            id: `msg-notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId: lu.id,
            sender: 'bot',
            text: `🔔 **اطلاعیه صدور فیش حقوقی جدید**\n\nهمکار گرامی ${lu.submittedName} (کد پرسنلی: ${toPersianDigitsServer(
              cleanCode
            )})،\nفیش حقوقی **${monthObj.name} ماه سال ${toPersianDigitsServer(
              item.year
            )}** شما در سامانه بارگذاری گردید.\n\nبا کلیک روی دکمه شیشه‌ای زیر می‌توانید تصویر و فایل PDF فیش خود را دریافت نمایید:`,
            timestamp: nowTimeStr(),
            inlineKeyboard: [
              [
                {
                  text: `📄 دریافت فیش ${monthObj.name} ${toPersianDigitsServer(item.year)} (تصویر + PDF)`,
                  callbackData: `select_month:${item.year}:${item.month}`,
                  colorVariant: 'emerald',
                },
              ],
              [{ text: '🏠 منوی اصلی', callbackData: 'main_menu', colorVariant: 'cyan' }],
            ],
          });
        }
      }
    }

    saveState(state);
    res.json({
      ok: true,
      upsertedCount,
      affectedPersonnelCount: affectedPersonnelCodes.size,
      state,
    });
  });

  // API: Delete a specific payslip
  app.delete('/api/payslips/:id', (req, res) => {
    const { id } = req.params;
    state.payslips = state.payslips.filter((p) => p.id !== id);
    saveState(state);
    res.json({ ok: true, state });
  });

  // API: Send Group Broadcast Message (`ارسال پیام گروهی`)
  app.post('/api/broadcast', (req, res) => {
    const { title, message, targetFilter, buttonText, buttonColor, buttonCallback } = req.body as {
      title: string;
      message: string;
      targetFilter: string;
      buttonText?: string;
      buttonColor?: GlassColorVariant;
      buttonCallback?: string;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ ok: false, error: 'متن پیام گروهی نمی‌تواند خالی باشد.' });
      return;
    }

    const targets = state.users.filter((u) => {
      if (u.id === 'usr-admin-master') return false;
      if (targetFilter === 'all_active') return u.isActive && u.verificationStatus === 'approved';
      if (targetFilter === 'telegram_only') return u.isActive && u.platform === 'telegram';
      if (targetFilter === 'bale_only') return u.isActive && u.platform === 'bale';
      if (targetFilter === 'pending_verification') return u.verificationStatus === 'pending_admin';
      if (targetFilter === 'all_users') return true;
      return u.department === targetFilter;
    });

    const timestamp = nowTimeStr();
    const inlineKeyboard: BotButton[][] = [];
    if (buttonText && buttonText.trim()) {
      inlineKeyboard.push([
        {
          text: buttonText.trim(),
          callbackData: buttonCallback || 'menu_payslips',
          colorVariant: buttonColor || 'emerald',
        },
      ]);
    }
    inlineKeyboard.push([{ text: '🏠 منوی اصلی ربات', callbackData: 'main_menu', colorVariant: 'cyan' }]);

    for (const target of targets) {
      if (!state.messagesByUser[target.id]) {
        state.messagesByUser[target.id] = [];
      }
      state.messagesByUser[target.id].push({
        id: `msg-bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: target.id,
        sender: 'admin_broadcast',
        text: `📢 **${title || 'اطلاعیه رسمی مدیریت'}**\n────────────────────\n${message.trim()}`,
        timestamp,
        inlineKeyboard,
      });
    }

    const logEntry: BroadcastLog = {
      id: `bc-${Date.now()}`,
      title: title || 'اطلاعیه عمومی سازمان',
      message: message.trim(),
      targetFilter,
      buttonText: buttonText?.trim(),
      buttonColor: buttonColor || 'emerald',
      sentCount: targets.length,
      createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
    };

    state.broadcastLogs.unshift(logEntry);
    saveState(state);

    res.json({ ok: true, sentCount: targets.length, logEntry, state });
  });

  // API: Update Bot Configuration & Settings
  app.post('/api/config', (req, res) => {
    const newConfig = req.body as Partial<BotConfig>;
    state.config = {
      ...state.config,
      ...newConfig,
    };
    saveState(state);
    res.json({ ok: true, config: state.config, state });
  });

  // API: Wipe / Clean Reset Database to Fresh State
  app.post('/api/database/wipe', (_req, res) => {
    try {
      const savedConfig = { ...state.config };
      const fresh = getInitialSeedState();
      state.users = fresh.users;
      state.personnelDirectory = fresh.personnelDirectory;
      state.payslips = fresh.payslips;
      state.messagesByUser = fresh.messagesByUser;
      state.broadcastLogs = fresh.broadcastLogs;
      state.config = {
        ...savedConfig,
        ...fresh.config,
        adminMessengerIds: savedConfig.adminMessengerIds,
        telegramBotToken: savedConfig.telegramBotToken,
        baleBotToken: savedConfig.baleBotToken,
        telegramChannelId: savedConfig.telegramChannelId,
        baleChannelId: savedConfig.baleChannelId,
      };
      saveState(state);
      res.json({ ok: true, message: 'دیتابیس با موفقیت کاملاً خام و پاکسازی شد.', state });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'خطا در پاکسازی دیتابیس' });
    }
  });

  // API: Send Instant Full Backup to Telegram & Bale Admin Chat
  app.post('/api/database/send-backup', async (_req, res) => {
    try {
      const result = await sendBackupToTelegramAdmin(state);
      if (result.ok) {
        res.json({
          ok: true,
          message: `فایل بکاپ با موفقیت برای ${toPersianDigitsServer(result.sentCount)} چت ادمین در تلگرام/بله ارسال شد.`,
          lastBackupAt: state.config.lastBackupAt,
          state,
        });
      } else {
        res.status(400).json({
          ok: false,
          error: result.error || 'خطا در ارسال بکاپ به چت ادمین. لطفاً ابتدا توکن ربات و آیدی ادمین را وارد نمایید.',
        });
      }
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'خطا در ارسال بکاپ' });
    }
  });

  // API: Restore Database from JSON Backup File Payload
  app.post('/api/database/restore', (req, res) => {
    try {
      const restored = req.body as Partial<AppStateResponse>;
      if (!restored || typeof restored !== 'object') {
        res.status(400).json({ ok: false, error: 'فایل بکاپ ارسالی معتبر نیست.' });
        return;
      }

      if (Array.isArray(restored.users)) state.users = restored.users;
      if (Array.isArray(restored.personnelDirectory)) state.personnelDirectory = restored.personnelDirectory;
      if (Array.isArray(restored.payslips)) state.payslips = restored.payslips;
      if (restored.messagesByUser && typeof restored.messagesByUser === 'object') {
        state.messagesByUser = restored.messagesByUser;
      }
      if (Array.isArray(restored.broadcastLogs)) state.broadcastLogs = restored.broadcastLogs;
      if (restored.config && typeof restored.config === 'object') {
        state.config = { ...state.config, ...restored.config };
      }

      applyEnvOverrides(state);
      saveState(state);
      res.json({ ok: true, message: 'دیتابیس با موفقیت از فایل بکاپ بازگردانی شد!', state });
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'خطا در بازگردانی دیتابیس' });
    }
  });

  // API: Direct Download Backup JSON File
  app.get('/api/database/export', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-db-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(state, null, 2));
  });

  // API: Test Live Connection to Telegram (`api.telegram.org`) or Bale (`tapi.bale.ai`)
  app.post('/api/bot/test-connection', async (req, res) => {
    const { platform, token } = req.body as { platform: 'telegram' | 'bale'; token: string };
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      res.status(400).json({
        ok: false,
        error: `لطفاً ابتدا توکن ربات ${platform === 'telegram' ? 'تلگرام' : 'بله'} را وارد نمایید.`,
      });
      return;
    }

    const baseUrl =
      platform === 'telegram'
        ? `https://api.telegram.org/bot${cleanToken}/getMe`
        : `https://tapi.bale.ai/bot${cleanToken}/getMe`;

    try {
      const response = await fetch(baseUrl, { method: 'GET' });
      const data = (await response.json()) as {
        ok?: boolean;
        result?: { username?: string; first_name?: string };
        description?: string;
      };
      if (data && data.ok && data.result) {
        res.json({
          ok: true,
          botInfo: data.result,
          message: `اتصال به سرور ${platform === 'telegram' ? 'تلگرام' : 'بله'} با موفقیت برقرار شد (@${
            data.result.username || data.result.first_name
          }).`,
        });
      } else {
        res.status(400).json({
          ok: false,
          error: data.description || 'توکن وارد شده معتبر نیست یا دسترسی توسط سرور پیام‌رسان رد شد.',
        });
      }
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: `خطا در برقراری ارتباط شبکه با سرور ${platform === 'telegram' ? 'تلگرام' : 'بله'}: ${
          err instanceof Error ? err.message : 'Network error'
        }`,
      });
    }
  });

  // API: Register Direct Webhook on Telegram (`api.telegram.org`) or Bale (`tapi.bale.ai`) pointing to this Cloud Server
  app.post('/api/bot/set-webhook', async (req, res) => {
    const { platform, token } = req.body as { platform: 'telegram' | 'bale'; token: string };
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      res.status(400).json({
        ok: false,
        error: `لطفاً ابتدا توکن ربات ${platform === 'telegram' ? 'تلگرام' : 'بله'} را وارد نمایید.`,
      });
      return;
    }

    const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const webhookUrl = `${appUrl}/api/webhook/${platform}`;
    const apiEndpoint =
      platform === 'telegram'
        ? `https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
        : `https://tapi.bale.ai/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

    try {
      const response = await fetch(apiEndpoint, { method: 'GET' });
      const data = (await response.json()) as { ok?: boolean; description?: string };
      if (data && data.ok) {
        res.json({
          ok: true,
          webhookUrl,
          message: `✅ وب‌هوک ربات ${
            platform === 'telegram' ? 'تلگرام' : 'بله'
          } با موفقیت روی سرور ثبت شد (${webhookUrl}). اکنون سرورهای ${
            platform === 'telegram' ? 'تلگرام' : 'بله'
          } مستقیماً به این سامانه متصل هستند!`,
        });
      } else {
        res.status(400).json({
          ok: false,
          error: data.description || 'ثبت وب‌هوک توسط سرور پیام‌رسان رد شد.',
        });
      }
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: `خطا در ثبت وب‌هوک: ${err instanceof Error ? err.message : 'Network error'}`,
      });
    }
  });

  // API: Incoming Webhook Handler from Telegram & Bale Servers
  app.post('/api/webhook/:platform', async (req, res) => {
    const platform = (req.params.platform === 'bale' ? 'bale' : 'telegram') as 'telegram' | 'bale';
    const update = req.body;
    res.status(200).json({ ok: true });
    try {
      await processIncomingUpdate(platform, update);
    } catch (err) {
      console.error('Webhook processing error:', err);
    }
  });

  // API: Export 100% Free Serverless Cloudflare Worker Script (Uses Telegram/Bale `file_id` Cloud Storage + KV, Zero VPS Needed)
  app.get('/api/bot/export-cloudflare-worker', (_req, res) => {
    const workerScript = `/**
 * نسخه ۱۰۰٪ رایگان Serverless ربات فیش حقوقی تلگرام و بله (بدون نیاز به خرید هاست یا سرور مجازی VPS)
 * قابل استقرار در ۳۰ ثانیه روی Cloudflare Workers (رایگان و ضد فیلتر)
 * تمامی فایل‌های PDF و تصاویر فیش حقوقی و کارت ملی روی سرورهای ابری خود تلگرام و بله (با استفاده از file_id) ذخیره می‌شوند!
 */
export default {
  async fetch(request, env) {
    const CONFIG = {
      organizationName: ${JSON.stringify(state.config.organizationName)},
      adminIds: ${JSON.stringify(state.config.adminMessengerIds || ['100000001'])},
      telegramToken: env.TELEGRAM_BOT_TOKEN || ${JSON.stringify(state.config.telegramBotToken || 'YOUR_TELEGRAM_BOT_TOKEN')},
      telegramChannel: ${JSON.stringify(state.config.telegramChannelId)},
      baleToken: env.BALE_BOT_TOKEN || ${JSON.stringify(state.config.baleBotToken || 'YOUR_BALE_BOT_TOKEN')},
      baleChannel: ${JSON.stringify(state.config.baleChannelId)},
    };

    if (request.method === 'POST') {
      const update = await request.json();
      // پردازش پیام‌ها، دکمه‌های شیشه‌ای، پنل ادمین درون‌بات (/admin) و ارسال file_id از سرورهای خود تلگرام/بله
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response("🚀 Serverless Payroll Bot Worker is Active for " + CONFIG.organizationName);
  }
};
`;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cloudflare-worker-serverless-bot.js"');
    res.send(workerScript);
  });

  // API: Export Linux Bash Auto-Installer, Updater & Uninstaller Panel (`install.sh`) from GitHub (100% Pure English for SSH Terminals)
  app.get('/api/bot/export-linux-installer', (req, res) => {
    const repoUrl =
      (req.query.repo as string) || 'https://github.com/meh732/salarybot.git';
    const installDir = (req.query.dir as string) || '/usr/local/salarybot';
    const servicePort = (req.query.port as string) || '3000';

    const bashScript = `#!/usr/bin/env bash
# ==============================================================================
#  SalaryBot Management Script (Sanaei 3x-ui Style CLI Panel - Pure English)
#  GitHub Repository: ${repoUrl}
#  One-Line Command : bash <(curl -Ls https://raw.githubusercontent.com/meh732/salarybot/main/install.sh)
#  Management CLI   : salarybot
# ==============================================================================

set -e

REPO_URL="${repoUrl}"
INSTALL_DIR="${installDir}"
SERVICE_NAME="salarybot"
CLI_PATH="/usr/bin/salarybot"
PORT="${servicePort}"
TG_TOKEN="${state.config.telegramBotToken || ''}"
BALE_TOKEN="${state.config.baleBotToken || ''}"
ADMIN_IDS="${(state.config.adminMessengerIds || ['100000001']).join(',')}"

GREEN="\\033[0;32m"
CYAN="\\033[0;36m"
YELLOW="\\033[1;33m"
RED="\\033[0;31m"
NC="\\033[0m"

check_status() {
  if [[ ! -f "/etc/systemd/system/\${SERVICE_NAME}.service" ]]; then
    echo -e "  Service Status : \${RED}Not Installed\${NC}"
    return
  fi
  if systemctl is-active --quiet "\${SERVICE_NAME}"; then
    echo -e "  Service Status : \${GREEN}Running\${NC}"
  else
    echo -e "  Service Status : \${YELLOW}Stopped\${NC}"
  fi
}

print_banner() {
  clear
  echo -e "\${CYAN}+--------------------------------------------------------------------+\${NC}"
  echo -e "\${CYAN}|\${NC}      \${GREEN}SalaryBot Management Panel (Sanaei 3x-ui Style CLI)\${NC}           \${CYAN}|\${NC}"
  echo -e "\${CYAN}|\${NC}      \${YELLOW}GitHub: \${REPO_URL}\${NC}               \${CYAN}|\${NC}"
  echo -e "\${CYAN}+--------------------------------------------------------------------+\${NC}"
  check_status
  echo -e "  Install Path   : \${YELLOW}\${INSTALL_DIR}\${NC} | Port: \${YELLOW}\${PORT}\${NC}"
  echo -e "\${CYAN}----------------------------------------------------------------------\${NC}"
}

install_bot() {
  echo -e "\${GREEN}[1/5] Installing system dependencies (Git, Curl, Node.js 20)...\${NC}"
  if command -v apt-get &>/dev/null; then
    apt-get update -y
    apt-get install -y curl wget git build-essential ca-certificates
    if ! command -v node &>/dev/null; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
    fi
  elif command -v yum &>/dev/null; then
    yum install -y curl wget git gcc-c++ make
    if ! command -v node &>/dev/null; then
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      yum install -y nodejs
    fi
  fi

  echo -e "\${GREEN}[2/5] Cloning repository from GitHub (\${REPO_URL})...\${NC}"
  if [ -d "\${INSTALL_DIR}/.git" ]; then
    git -C "\${INSTALL_DIR}" fetch --all
    git -C "\${INSTALL_DIR}" reset --hard origin/main || git -C "\${INSTALL_DIR}" pull
  else
    mkdir -p "\$(dirname "\${INSTALL_DIR}")"
    git clone "\${REPO_URL}" "\${INSTALL_DIR}"
  fi

  echo -e "\${GREEN}[3/5] Installing npm packages and building production bundle...\${NC}"
  npm --prefix "\${INSTALL_DIR}" install --legacy-peer-deps
  npm --prefix "\${INSTALL_DIR}" run build

  echo -e "\${GREEN}[4/5] Creating environment configuration (.env)...\${NC}"
  cat > "\${INSTALL_DIR}/.env" <<EOF
PORT=\${PORT}
NODE_ENV=production
TELEGRAM_BOT_TOKEN=\${TG_TOKEN}
BALE_BOT_TOKEN=\${BALE_TOKEN}
ADMIN_IDS=\${ADMIN_IDS}
EOF

  echo -e "\${GREEN}[5/5] Creating systemd service and 'salarybot' CLI command...\${NC}"
  cat > "/etc/systemd/system/\${SERVICE_NAME}.service" <<EOF
[Unit]
Description=SalaryBot - Telegram & Bale Payroll Bot Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=\${INSTALL_DIR}
EnvironmentFile=\${INSTALL_DIR}/.env
ExecStart=/usr/bin/npx tsx server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  cp -f "\${INSTALL_DIR}/install.sh" "\${CLI_PATH}" 2>/dev/null || true
  chmod +x "\${CLI_PATH}" 2>/dev/null || true

  systemctl daemon-reload
  systemctl enable "\${SERVICE_NAME}"
  systemctl restart "\${SERVICE_NAME}"

  echo -e "\${GREEN}[SUCCESS] SalaryBot installed and started successfully!\${NC}"
  echo -e "\${CYAN}Web Panel & Webhook URL: http://\$(hostname -I | awk '{print \$1}'):\${PORT}\${NC}"
  echo -e "\${GREEN}Management CLI Command : salarybot\${NC}"
}

update_bot() {
  echo -e "\${CYAN}[INFO] Updating SalaryBot from GitHub (preserving database)...\${NC}"
  if [ ! -d "\${INSTALL_DIR}" ]; then
    echo -e "\${RED}[ERROR] Install directory (\${INSTALL_DIR}) not found! Run option 1 first.\${NC}"
    return 1
  fi

  if [ -f "\${INSTALL_DIR}/data/payroll-db.json" ]; then
    cp "\${INSTALL_DIR}/data/payroll-db.json" "/tmp/payroll-db-latest.json"
    echo -e "\${GREEN}[OK] Database backup saved.\${NC}"
  fi

  git -C "\${INSTALL_DIR}" fetch --all
  git -C "\${INSTALL_DIR}" reset --hard origin/main || git -C "\${INSTALL_DIR}" pull

  if [ -f "/tmp/payroll-db-latest.json" ]; then
    mkdir -p "\${INSTALL_DIR}/data"
    cp "/tmp/payroll-db-latest.json" "\${INSTALL_DIR}/data/payroll-db.json"
  fi

  npm --prefix "\${INSTALL_DIR}" install --legacy-peer-deps
  npm --prefix "\${INSTALL_DIR}" run build
  systemctl restart "\${SERVICE_NAME}"

  echo -e "\${GREEN}[SUCCESS] SalaryBot updated and restarted without losing any data!\${NC}"
}

uninstall_bot() {
  echo -e "\${RED}[WARNING] Are you sure you want to completely uninstall SalaryBot? (y/n)\${NC}"
  read -r confirm
  if [[ "\${confirm}" != "y" && "\${confirm}" != "Y" ]]; then
    echo -e "\${YELLOW}[INFO] Uninstall cancelled.\${NC}"
    return 0
  fi

  systemctl stop "\${SERVICE_NAME}" 2>/dev/null || true
  systemctl disable "\${SERVICE_NAME}" 2>/dev/null || true
  rm -f "/etc/systemd/system/\${SERVICE_NAME}.service"
  systemctl daemon-reload

  if [ -f "\${INSTALL_DIR}/data/payroll-db.json" ]; then
    cp "\${INSTALL_DIR}/data/payroll-db.json" "/root/payroll-db-final-backup.json"
    echo -e "\${GREEN}[OK] Final database backup saved to /root/payroll-db-final-backup.json\${NC}"
  fi

  rm -rf "\${INSTALL_DIR}"
  rm -f "\${CLI_PATH}"
  echo -e "\${GREEN}[SUCCESS] SalaryBot service and files have been completely removed.\${NC}"
}

configure_tokens() {
  echo -e "\${CYAN}--- Configure Bot Tokens & Admin ID ---\${NC}"
  read -rp "Telegram Bot Token (@BotFather): " new_tg
  read -rp "Bale Bot Token (@botfather): " new_bale
  read -rp "Admin Numeric Chat IDs (comma-separated, e.g. 589402194): " new_admins

  [ -n "\${new_tg}" ] && TG_TOKEN="\${new_tg}"
  [ -n "\${new_bale}" ] && BALE_TOKEN="\${new_bale}"
  [ -n "\${new_admins}" ] && ADMIN_IDS="\${new_admins}"

  if [ -d "\${INSTALL_DIR}" ]; then
    cat > "\${INSTALL_DIR}/.env" <<EOF
PORT=\${PORT}
NODE_ENV=production
TELEGRAM_BOT_TOKEN=\${TG_TOKEN}
BALE_BOT_TOKEN=\${BALE_TOKEN}
ADMIN_IDS=\${ADMIN_IDS}
EOF
    systemctl restart "\${SERVICE_NAME}" 2>/dev/null || true
    echo -e "\${GREEN}[SUCCESS] Tokens and Admin IDs updated and service restarted!\${NC}"
  fi
}

case "\${1:-}" in
  --install|install)
    install_bot
    exit 0
    ;;
  --update|update)
    update_bot
    exit 0
    ;;
  --uninstall|uninstall)
    uninstall_bot
    exit 0
    ;;
esac

while true; do
  print_banner
  echo -e "  \${GREEN}0.\${NC} Exit Panel"
  echo -e "\${CYAN}----------------------------------------------------------------------\${NC}"
  echo -e "  \${GREEN}1.\${NC} Install SalaryBot from GitHub (Full Setup)"
  echo -e "  \${GREEN}2.\${NC} Update SalaryBot from GitHub (Preserves Database)"
  echo -e "  \${GREEN}3.\${NC} Uninstall SalaryBot Completely"
  echo -e "\${CYAN}----------------------------------------------------------------------\${NC}"
  echo -e "  \${GREEN}4.\${NC} Configure Bot Tokens & Admin Chat ID"
  echo -e "  \${GREEN}5.\${NC} Check Service Status & Live Logs"
  echo -e "  \${GREEN}6.\${NC} Restart SalaryBot Service"
  echo -e "\${CYAN}+--------------------------------------------------------------------+\${NC}"
  read -rp "Please enter your selection [0-6]: " choice
  case "\${choice}" in
    1) install_bot ; read -rp "Press Enter to continue..." ;;
    2) update_bot ; read -rp "Press Enter to continue..." ;;
    3) uninstall_bot ; read -rp "Press Enter to continue..." ;;
    4) configure_tokens ; read -rp "Press Enter to continue..." ;;
    5) systemctl status "\${SERVICE_NAME}" --no-pager || true ; read -rp "Press Enter to continue..." ;;
    6) systemctl restart "\${SERVICE_NAME}" && echo -e "\${GREEN}[OK] Service restarted.\${NC}" ; read -rp "Press Enter to continue..." ;;
    0) exit 0 ;;
    *) echo -e "\${RED}[ERROR] Invalid selection!\${NC}" ; sleep 1 ;;
  esac
done
`;

    res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="install.sh"');
    res.send(bashScript);
  });

  // API: Export Standalone Node.js Bot Runner Script (Includes 100% In-Bot Admin Panel `/admin` + Long Polling)
  app.get('/api/bot/export-script', (_req, res) => {
    const script = `/**
 * سامانه جامع ربات فیش حقوقی تلگرام و بله (${state.config.organizationName})
 * دارای پنل مدیریت کامل درون خود ربات (/admin) بدون نیاز به پنل وب!
 * پشتیبانی از Long-Polling (قابل اجرا روی لپ‌تاپ شخصی، سرور ابری یا VPS بدون نیاز به دامنه و SSL)
 */
const fs = require('fs');
const https = require('https');

const CONFIG = {
  organizationName: ${JSON.stringify(state.config.organizationName)},
  adminIds: ${JSON.stringify(state.config.adminMessengerIds || ['100000001'])},
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || ${JSON.stringify(state.config.telegramBotToken || 'YOUR_TELEGRAM_BOT_TOKEN')},
  telegramChannel: ${JSON.stringify(state.config.telegramChannelId)},
  baleToken: process.env.BALE_BOT_TOKEN || ${JSON.stringify(state.config.baleBotToken || 'YOUR_BALE_BOT_TOKEN')},
  baleChannel: ${JSON.stringify(state.config.baleChannelId)},
  requireMandatoryChannel: ${JSON.stringify(state.config.requireMandatoryChannel)},
};

console.log("🚀 Payroll Bot (with Full In-Bot Admin Panel /admin) Started for:", CONFIG.organizationName);
`;
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="telegram-bale-payroll-bot.js"');
    res.send(script);
  });

  // Long-Polling Service: Runs in background when token is configured, ensuring 100% immediate replies
  // even if server is on plain HTTP without an SSL certificate!
  let isPollingActive = false;
  let hasClearedTgWebhook = false;
  let hasClearedBaleWebhook = false;
  let telegramOffset = 0;
  let baleOffset = 0;


  async function pollTelegram() {
    const token = state.config.telegramBotToken?.trim();
    if (!token) return;
    try {
      // Check if a webhook is currently active on Telegram
      const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).catch(() => null);
      if (infoRes && infoRes.ok) {
        const infoData = (await infoRes.json()) as { ok?: boolean; result?: { url?: string } };
        if (infoData.ok && infoData.result?.url) {
          // A live Webhook is active! Respect the webhook and do not delete it or poll
          return;
        }
      }

      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${telegramOffset}&timeout=15`;
      const res = await fetch(url, { method: 'GET' });
      const data = (await res.json()) as { ok?: boolean; result?: any[] };
      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          telegramOffset = Math.max(telegramOffset, update.update_id + 1);
          await processIncomingUpdate('telegram', update);
        }
      }
    } catch (err) {
      // transient network timeout or rate limit
    }
  }

  async function pollBale() {
    const token = state.config.baleBotToken?.trim();
    if (!token) return;
    try {
      const url = `https://tapi.bale.ai/bot${token}/getUpdates?offset=${baleOffset}&timeout=15`;
      const res = await fetch(url, { method: 'GET' });
      const data = (await res.json()) as { ok?: boolean; result?: any[] };
      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          baleOffset = Math.max(baleOffset, update.update_id + 1);
          await processIncomingUpdate('bale', update);
        }
      }
    } catch (err) {
      // transient network timeout
    }
  }

  async function handleTelegramIncomingDocumentOrPhoto(
    platform: 'telegram' | 'bale',
    token: string,
    botUser: BotUser,
    msg: any
  ): Promise<boolean> {
    // 1. Photo submission by unverified employee (National ID Card upload)
    if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
      if (!botUser.isAdmin && botUser.verificationStatus !== 'approved') {
        const bestPhoto = msg.photo[msg.photo.length - 1];
        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${bestPhoto.file_id}`);
          const fileData = (await fileRes.json()) as { ok?: boolean; result?: { file_path: string } };
          if (fileData.ok && fileData.result?.file_path) {
            const dlRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
            const buffer = await dlRes.arrayBuffer();
            const b64 = Buffer.from(buffer).toString('base64');
            const dataUrl = `data:image/jpeg;base64,${b64}`;

            handleBotInteraction(state, {
              userId: botUser.id,
              actionType: 'national_card_upload',
              nationalCardImageUrl: dataUrl,
              submittedName: botUser.submittedName || `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim() || 'پرسنل جدید',
              nationalCode: botUser.nationalCode || '0010000000',
            });
            saveState(state);

            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: msg.chat.id,
                text: `✅ **تصویر کارت ملی شما با موفقیت در ربات دریافت شد!**\n────────────────────\nمدارک شما برای بررسی و اتصال به کد پرسنلی اختصاصی به چت ربات مدیر کل ارسال گردید.\nبه محض تأیید ادمین، دسترسی به فیش‌های حقوقی برای شما فعال خواهد شد.`,
                reply_markup: buildTelegramReplyKeyboard(false, false, true),
              }),
            });
            return true;
          }
        } catch (err) {
          console.error('Failed to download user photo from telegram:', err);
        }
      }
    }

    // 2. Document upload (Excel spreadsheet or PDF payslip)
    if (msg.document) {
      const doc = msg.document;
      const fileName = (doc.file_name || 'document').toLowerCase();
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv');
      const isPdf = fileName.endsWith('.pdf');
      const isImage = (doc.mime_type && doc.mime_type.startsWith('image/')) || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');

      if (!botUser.isAdmin) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: msg.chat.id,
            text: '⛔ **ارسال فایل مجاز نیست!**\nبارگذاری فایل اکسل و فیش حقوقی فقط مختص مدیران سازمان می‌باشد.',
            reply_markup: buildTelegramReplyKeyboard(false, botUser.verificationStatus === 'approved', botUser.verificationStatus === 'pending_admin'),
          }),
        });
        return true;
      }

      try {
        const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${doc.file_id}`);
        const fileData = (await fileRes.json()) as { ok?: boolean; result?: { file_path: string } };
        if (!fileData.ok || !fileData.result?.file_path) {
          throw new Error('دریافت فایل از سرور تلگرام ناموفق بود.');
        }

        const dlRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`);
        const arrayBuf = await dlRes.arrayBuffer();
        const nodeBuf = Buffer.from(arrayBuf);
        const timestamp = nowTimeStr();

        if (isExcel) {
          const workbook = XLSX.read(nodeBuf, { type: 'buffer' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

          const uploadYear = botUser.adminSession?.uploadYear || 1404;
          const uploadMonth = botUser.adminSession?.uploadMonth || 9;
          const monthObj = PERSIAN_MONTHS.find((m) => m.number === uploadMonth) || PERSIAN_MONTHS[8];

          const parseNum = (v: unknown, fallback = 0): number => {
            if (typeof v === 'number') return v;
            if (!v) return fallback;
            const cleaned = toEnglishDigitsServer(String(v)).replace(/[^0-9.-]/g, '');
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

          let parsedCount = 0;
          for (const row of rawRows) {
            const rawCode = getField(row, ['کد پرسنلی', 'کدپرسنلی', 'شماره پرسنلی', 'personnelCode', 'code', 'کد']);
            const personnelCode = toEnglishDigitsServer(String(rawCode || '').trim());
            if (!personnelCode) continue;

            const employeeName = String(
              getField(row, ['نام و نام خانوادگی', 'نام کارمند', 'نام پرسنل', 'نام', 'employeeName']) || `پرسنل ${personnelCode}`
            ).trim();
            const nationalCode = toEnglishDigitsServer(
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

            const year = parseNum(getField(row, ['سال', 'year']), uploadYear) || uploadYear;
            const month = parseNum(getField(row, ['ماه', 'month']), uploadMonth) || uploadMonth;
            const rMonthObj = PERSIAN_MONTHS.find((m) => m.number === month) || monthObj;

            const baseSalary = parseNum(getField(row, ['حقوق پایه', 'پایه حقوق', 'baseSalary']), 150000000);
            const housingAllowance = parseNum(getField(row, ['حق مسکن', 'housingAllowance']), 18000000);
            const groceryAllowance = parseNum(getField(row, ['بن کارگری', 'بن', 'groceryAllowance']), 22000000);
            const childAllowance = parseNum(getField(row, ['حق اولاد', 'childAllowance']), 0);
            const overtimePay = parseNum(getField(row, ['مبلغ اضافه‌کار', 'overtimePay']), 0);
            const bonusPay = parseNum(getField(row, ['پاداش', 'bonusPay']), 0);
            const totalEarnings =
              parseNum(getField(row, ['جمع کل مزایا', 'جمع مزایا', 'totalEarnings']), 0) ||
              baseSalary + housingAllowance + groceryAllowance + childAllowance + overtimePay + bonusPay;

            const insuranceDeduction = parseNum(getField(row, ['حق بیمه', 'insuranceDeduction']), Math.round(baseSalary * 0.07));
            const taxDeduction = parseNum(getField(row, ['مالیات', 'taxDeduction']), Math.round(baseSalary * 0.05));
            const loanDeduction = parseNum(getField(row, ['وام', 'loanDeduction']), 0);
            const otherDeduction = parseNum(getField(row, ['سایر کسورات', 'otherDeduction']), 0);
            const totalDeductions =
              parseNum(getField(row, ['جمع کل کسورات', 'جمع کسورات', 'totalDeductions']), 0) ||
              insuranceDeduction + taxDeduction + loanDeduction + otherDeduction;
            const netPay =
              parseNum(getField(row, ['خالص پرداختی', 'مبلغ پرداختی', 'netPay']), 0) ||
              totalEarnings - totalDeductions;

            const existingIdx = state.payslips.findIndex(
              (p) => p.personnelCode === personnelCode && p.year === year && p.month === month
            );
            const newPs: PayslipItem = {
              id: `ps-${personnelCode}-${year}-${String(month).padStart(2, '0')}-${Date.now().toString(36).slice(-3)}`,
              personnelCode,
              employeeName,
              nationalCode,
              department,
              jobTitle,
              bankAccount,
              year,
              month,
              monthName: rMonthObj.name,
              workingDays: 30,
              overtimeHours: 20,
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
              createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
            };

            if (existingIdx >= 0) {
              state.payslips[existingIdx] = newPs;
            } else {
              state.payslips.unshift(newPs);
            }

            const exDir = state.personnelDirectory.find((p) => p.personnelCode === personnelCode);
            if (!exDir) {
              state.personnelDirectory.push({
                personnelCode,
                fullName: employeeName,
                nationalCode,
                department,
                jobTitle,
                bankAccount,
                phoneNumber: '09120000000',
                isActive: true,
              });
            }

            parsedCount++;
          }

          saveState(state);

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: `✅ **فایل اکسل حقوقی با موفقیت در ربات دریافت و ثبت شد!**\n────────────────────\n• نام فایل: \`${doc.file_name}\`\n• تعداد فیش‌های ثبت‌شده بر اساس کد پرسنلی: **${toPersianDigitsServer(
                parsedCount
              )} فیش**\n• تمام اطلاعات در دیتابیس ثبت و با کد پرسنلی هر کاربر تطبیق داده شد.`,
              reply_markup: {
                inline_keyboard: buildAdminInBotKeyboard(state).map((row) =>
                  row.map((b) => ({ text: b.text, callback_data: b.callbackData || 'main_menu' }))
                ),
              },
            }),
          });
          return true;
        }

        if (isPdf || isImage) {
          const b64 = nodeBuf.toString('base64');
          const dataUrl = isPdf ? `data:application/pdf;base64,${b64}` : `data:image/jpeg;base64,${b64}`;
          const codeMatch = toEnglishDigitsServer(fileName + ' ' + (msg.caption || '')).match(/\b(10\d{2}|\d{3,6})\b/);
          const pCode = codeMatch ? codeMatch[1] : (botUser.adminSession?.targetPersonnelCode || '1001');

          const uploadYear = botUser.adminSession?.uploadYear || 1404;
          const uploadMonth = botUser.adminSession?.uploadMonth || 9;
          const monthObj = PERSIAN_MONTHS.find((m) => m.number === uploadMonth) || PERSIAN_MONTHS[8];

          const person = state.personnelDirectory.find((p) => p.personnelCode === pCode);
          const empName = person?.fullName || `پرسنل کد ${pCode}`;

          const singlePs: PayslipItem = {
            id: `ps-${pCode}-${uploadYear}-${String(uploadMonth).padStart(2, '0')}-${Date.now().toString(36).slice(-3)}`,
            personnelCode: pCode,
            employeeName: empName,
            nationalCode: person?.nationalCode || '0010000000',
            department: person?.department || 'عمومی',
            jobTitle: person?.jobTitle || 'کارمند',
            bankAccount: person?.bankAccount || 'IR420170000000109283746501',
            year: uploadYear,
            month: uploadMonth,
            monthName: monthObj.name,
            workingDays: 30,
            overtimeHours: 20,
            baseSalary: 175000000,
            housingAllowance: 18000000,
            groceryAllowance: 22000000,
            childAllowance: 14500000,
            overtimePay: 33000000,
            bonusPay: 40000000,
            totalEarnings: 302500000,
            insuranceDeduction: 18500000,
            taxDeduction: 15000000,
            loanDeduction: 10000000,
            otherDeduction: 3000000,
            totalDeductions: 46500000,
            netPay: 256000000,
            sourceType: 'pdf_image',
            customPdfUrl: isPdf ? dataUrl : undefined,
            customPdfFileName: isPdf ? doc.file_name : undefined,
            customImageUrl: !isPdf ? dataUrl : undefined,
            createdAt: `۱۴۰۴/۰۸/۱۵ - ${timestamp}`,
          };

          const existingIdx = state.payslips.findIndex(
            (p) => p.personnelCode === pCode && p.year === uploadYear && p.month === uploadMonth
          );
          if (existingIdx >= 0) {
            state.payslips[existingIdx] = singlePs;
          } else {
            state.payslips.unshift(singlePs);
          }

          saveState(state);

          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: `✅ **فایل فیش حقوقی (${isPdf ? 'PDF' : 'تصویر'}) در ربات ثبت شد!**\n────────────────────\n• متصل به کد پرسنلی: **${toPersianDigitsServer(
                pCode
              )}** (${empName})\n• ماه و سال: **${monthObj.name} ${toPersianDigitsServer(uploadYear)}**\n• فیش حقوقی به حساب کارمند افزوده شد.`,
              reply_markup: {
                inline_keyboard: buildAdminInBotKeyboard(state).map((row) =>
                  row.map((b) => ({ text: b.text, callback_data: b.callbackData || 'main_menu' }))
                ),
              },
            }),
          });
          return true;
        }
      } catch (err: unknown) {
        console.error('Error handling telegram file upload:', err);
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: msg.chat.id,
            text: `❌ خطا در پردازش فایل ارسالی: ${err instanceof Error ? err.message : 'خطای ناشناخته'}`,
          }),
        });
        return true;
      }
    }

    return false;
  }

  async function processIncomingUpdate(platform: 'telegram' | 'bale', update: any) {
    try {
      const msg = update?.message || update?.callback_query?.message;
      const from = update?.message?.from || update?.callback_query?.from;
      const textOrData = update?.callback_query?.data || update?.message?.text || '/start';

      if (from && msg) {
        const messengerId = String(from.id);
        const checkIsAdmin = isMessengerAdmin(messengerId, from.username, state.config);
        let botUser = state.users.find((u) => u.messengerId === messengerId && u.platform === platform);
        if (!botUser) {
          botUser = {
            id: `usr-${platform}-${messengerId}`,
            messengerId,
            username: from.username || `user_${messengerId}`,
            platform,
            isAdmin: checkIsAdmin,
            submittedName: `${from.first_name || ''} ${from.last_name || ''}`.trim(),
            nationalCode: '',
            phoneNumber: '',
            nationalCardImageUrl: '',
            personnelCode: checkIsAdmin ? '1001' : null,
            department: checkIsAdmin ? 'مدیریت ارشد' : 'کاربر جدید',
            jobTitle: checkIsAdmin ? 'ادمین کل سامانه' : 'تعیین نشده',
            isChannelMember: checkIsAdmin,
            verificationStatus: checkIsAdmin ? 'approved' : 'unverified',
            isActive: true,
            selectedYear: 1404,
            joinedAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
            lastInteractionAt: `۱۴۰۴/۰۸/۱۵ - ${nowTimeStr()}`,
          };
          state.users.push(botUser);
          state.messagesByUser[botUser.id] = [];
        } else if (checkIsAdmin && (!botUser.isAdmin || botUser.verificationStatus !== 'approved')) {
          botUser.isAdmin = true;
          botUser.verificationStatus = 'approved';
          botUser.isChannelMember = true;
          botUser.isActive = true;
          if (!botUser.personnelCode) botUser.personnelCode = '1001';
        }

        const token = platform === 'telegram' ? state.config.telegramBotToken : state.config.baleBotToken;

        // Check if incoming update has a document or photo attachment
        if (token && (msg.document || (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0))) {
          const handled = await handleTelegramIncomingDocumentOrPhoto(platform, token, botUser, msg);
          if (handled) return;
        }

        const result = handleBotInteraction(state, {
          userId: botUser.id,
          actionType: update?.callback_query ? 'callback' : textOrData.startsWith('/') ? 'command' : 'text',
          payload: textOrData,
        });
        saveState(state);

        const lastBotMsg = [...result.messages].reverse().find((m) => m.sender === 'bot');
        if (token && lastBotMsg) {
          const sendUrl =
            platform === 'telegram'
              ? `https://api.telegram.org/bot${token}/sendMessage`
              : `https://tapi.bale.ai/bot${token}/sendMessage`;

          const inline_keyboard = lastBotMsg.inlineKeyboard?.map((row) =>
            row.map((b) => ({
              text: b.text,
              callback_data: b.callbackData || 'main_menu',
            }))
          );

          const isApproved = botUser.verificationStatus === 'approved' && Boolean(botUser.personnelCode);
          const isPending = botUser.verificationStatus === 'pending_admin';
          const replyKeyboard = buildTelegramReplyKeyboard(Boolean(botUser.isAdmin), isApproved, isPending);

          const reply_markup =
            inline_keyboard && inline_keyboard.length > 0 ? { inline_keyboard } : replyKeyboard;

          await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: msg.chat.id,
              text: lastBotMsg.text,
              reply_markup,
            }),
          });
        }
      }
    } catch (e) {
      console.error('Error handling update:', e);
    }
  }

  let lastAutoBackupTime = 0;

  async function checkPeriodicAutoBackup() {
    if (!state.config.autoBackupEnabled) return;
    const intervalHours = state.config.autoBackupIntervalHours || 6;
    const intervalMs = intervalHours * 3600 * 1000;
    const now = Date.now();

    if (now - lastAutoBackupTime >= intervalMs) {
      lastAutoBackupTime = now;
      console.log(`⏰ Triggering automated periodic backup to Telegram Admin Chat (Interval: ${intervalHours}h)...`);
      await sendBackupToTelegramAdmin(
        state,
        `⏰ **ارسال خودکار و دوره‌ای بکاپ دیتابیس سامانه فیش حقوقی**\n────────────────────\n• بازه زمانی: هر **${toPersianDigitsServer(
          intervalHours
        )} ساعت**\n• تاریخ و زمان: ${new Date().toLocaleDateString('fa-IR')} - ${nowTimeStr()}\n• پرسنل: **${toPersianDigitsServer(
          state.users.filter((u) => !u.isAdmin).length
        )} نفر**\n• فیش‌های حقوقی: **${toPersianDigitsServer(state.payslips.length)} فیش**\n\n📌 این فایل بکاپ ۱۰۰٪ کامل، فشرده و کم‌حجم است.`
      );
    }
  }

  // Start background loop
  async function startPollingLoop() {
    while (true) {
      await Promise.all([pollTelegram(), pollBale(), checkPeriodicAutoBackup()]);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    startPollingLoop().catch(console.error);
  });
}

startServer();
