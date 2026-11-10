import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Crown,
  Database,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings,
  Shield,
  Terminal,
  Trash2,
  Upload,
  UploadCloud,
  UserCheck,
  Zap,
} from 'lucide-react';
import { BotConfig } from '../types/payroll';
import { toPersianDigits } from '../utils/payslipGenerator';
import { GlassButton } from './GlassButton';

interface BotSettingsPanelProps {
  config: BotConfig;
  onSaveConfig: (newConfig: Partial<BotConfig>) => Promise<void>;
  onWipeDatabase?: () => Promise<void>;
  onSendBackupNow?: () => Promise<void>;
  onRestoreDatabase?: (file: File) => Promise<void>;
}

export const BotSettingsPanel: React.FC<BotSettingsPanelProps> = ({
  config,
  onSaveConfig,
  onWipeDatabase,
  onSendBackupNow,
  onRestoreDatabase,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'webhook_admin' | 'linux_panel' | 'db_backup'>('webhook_admin');
  const [formState, setFormState] = useState<BotConfig>(config);
  const [adminList, setAdminList] = useState<string[]>(
    config.adminMessengerIds && config.adminMessengerIds.length > 0
      ? config.adminMessengerIds
      : ['100000001', '589402194']
  );
  const [newAdminInput, setNewAdminInput] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingPlatform, setTestingPlatform] = useState<'telegram' | 'bale' | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Linux Installer Generator State
  const [githubRepoUrl, setGithubRepoUrl] = useState<string>(
    'https://github.com/meh732/salarybot.git'
  );
  const [linuxInstallDir, setLinuxInstallDir] = useState<string>('/usr/local/salarybot');
  const [linuxPort, setLinuxPort] = useState<string>('3000');

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const telegramWebhookTarget = `${currentOrigin}/api/webhook/telegram`;
  const baleWebhookTarget = `${currentOrigin}/api/webhook/bale`;

  const directTelegramBrowserWebhookUrl = formState.telegramBotToken.trim()
    ? `https://api.telegram.org/bot${formState.telegramBotToken.trim()}/setWebhook?url=${encodeURIComponent(
        telegramWebhookTarget
      )}`
    : `https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=${encodeURIComponent(
        telegramWebhookTarget
      )}`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddAdminId = () => {
    const clean = newAdminInput.trim();
    if (!clean) return;
    if (!adminList.includes(clean)) {
      const updated = [...adminList, clean];
      setAdminList(updated);
    }
    setNewAdminInput('');
  };

  const handleRemoveAdminId = (idToRemove: string) => {
    setAdminList(adminList.filter((item: string) => item !== idToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveConfig({
      ...formState,
      adminMessengerIds: adminList,
    });
    setSaveMessage(
      '✅ تنظیمات توکن تلگرام و بله، لیست آیدی ادمین‌های درون‌بات (/admin) و کانال‌های اجباری با موفقیت ذخیره شد.'
    );
  };

  const handleTestConnection = async (platform: 'telegram' | 'bale') => {
    setTestingPlatform(platform);
    setTestResult(null);
    const token = platform === 'telegram' ? formState.telegramBotToken : formState.baleBotToken;
    try {
      const res = await fetch('/api/bot/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, token }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, text: data.message });
      } else {
        setTestResult({ ok: false, text: data.error || 'خطا در اتصال به پیام‌رسان' });
      }
    } catch {
      setTestResult({ ok: false, text: 'خطا در برقراری ارتباط با سرور' });
    } finally {
      setTestingPlatform(null);
    }
  };

  const handleSetWebhook = async (platform: 'telegram' | 'bale') => {
    setTestingPlatform(platform);
    setTestResult(null);
    const token = platform === 'telegram' ? formState.telegramBotToken : formState.baleBotToken;
    // First persist config so the webhook handler has the token & admin IDs
    await onSaveConfig({
      ...formState,
      adminMessengerIds: adminList,
    });
    try {
      const res = await fetch('/api/bot/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, token }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, text: data.message });
      } else {
        setTestResult({ ok: false, text: data.error || 'خطا در ثبت وب‌هوک' });
      }
    } catch {
      setTestResult({ ok: false, text: 'خطا در ثبت وب‌هوک روی سرور پیام‌رسان' });
    } finally {
      setTestingPlatform(null);
    }
  };

  const installerDownloadUrl = `/api/bot/export-linux-installer?repo=${encodeURIComponent(
    githubRepoUrl
  )}&dir=${encodeURIComponent(linuxInstallDir)}&port=${encodeURIComponent(linuxPort)}`;

  const interactiveMenuCmd = `bash <(curl -Ls https://raw.githubusercontent.com/meh732/salarybot/main/install.sh)`;
  const oneLineInstallCmd = `bash <(curl -Ls https://raw.githubusercontent.com/meh732/salarybot/main/install.sh) install`;
  const oneLineUpdateCmd = `bash <(curl -Ls https://raw.githubusercontent.com/meh732/salarybot/main/install.sh) update`;
  const oneLineUninstallCmd = `bash <(curl -Ls https://raw.githubusercontent.com/meh732/salarybot/main/install.sh) uninstall`;

  return (
    <div className="space-y-6">
      {/* Top Sub-Navigation Bar: Webhook/Admin Setup vs Linux Auto-Installer Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('webhook_admin')}
            className={`px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'webhook_admin'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>۱. اتصال توکن BotFather به وب‌هوک و معرفی آیدی ادمین</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('linux_panel')}
            className={`px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'linux_panel'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>۲. پنل نصاب لینوکس از گیت‌هاب</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('db_backup')}
            className={`px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'db_backup'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>۳. خام‌سازی دیتابیس، بکاپ اتومات تلگرام و بازگردانی</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={installerDownloadUrl}
            download="install.sh"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>دانلود اسکریپت لینوکس (install.sh)</span>
          </a>
          <a
            href="/api/bot/export-cloudflare-worker"
            download="cloudflare-worker-serverless-bot.js"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/30 transition-colors"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>دانلود اسکریپت کلودفلر</span>
          </a>
        </div>
      </div>

      {activeSubTab === 'webhook_admin' ? (
        <form
          onSubmit={handleSave}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6"
        >
          {/* Step-by-Step Guide Box: How to connect BotFather Token to Webhook & Set Admin ID */}
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-indigo-500/35 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-indigo-200 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>راهنمای ۳ مرحله‌ای: چطور توکن BotFather را به وب‌هوک وصل کنیم و ادمین را معرفی کنیم؟</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="font-bold text-cyan-300 mb-1">گام اول: قرار دادن توکن BotFather</div>
                <p>
                  کدها را داخل تلگرام آپلود نمی‌کنیم! بلکه توکنی که از <code>@BotFather</code> گرفته‌اید را در کادر پایین وارد می‌کنید تا این سرور به ربات شما متصل شود.
                </p>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="font-bold text-amber-300 mb-1">گام دوم: معرفی آیدی ادمین (تشخیص از کاربر عادی)</div>
                <p>
                  در بخش «لیست ادمین‌ها» در پایین، <strong>شماره آیدی عددی</strong> یا <strong>@username</strong> خودتان را وارد کنید. فقط کسانی که در این لیست باشند دکمه <code>👑 پنل مدیریت درون ربات (/admin)</code> را می‌بینند!
                </p>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <div className="font-bold text-emerald-300 mb-1">گام سوم: کلیک روی دکمه ثبت وب‌هوک</div>
                <p>
                  روی دکمه <strong>«⚡ فعال‌سازی Webhook روی سرور تلگرام / بله»</strong> کلیک کنید. از آن لحظه هر پیامی که به ربات شما در تلگرام یا بله ارسال شود، توسط همین سرور پاسخ داده می‌شود!
                </p>
              </div>
            </div>
          </div>

          {saveMessage && (
            <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3.5 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`rounded-xl p-3.5 text-xs sm:text-sm border ${
                testResult.ok
                  ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
              }`}
            >
              {testResult.text}
            </div>
          )}

          {/* STEP 1: ADMIN IDENTIFICATION SECTION (`کجا آیدی ادمین رو معرفی می‌کنم که فرقش با کاربرا معلوم بشه؟`) */}
          <div className="bg-slate-950/90 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span>بخش معرفی آیدی ادمین‌ها (تفکیک ادمین از پرسنل عادی در داخل بات)</span>
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  ربات از روی این لیست تشخیص می‌دهد چه کسی <strong>«👑 ادمین کل»</strong> است و چه کسی <strong>«👤 پرسنل عادی»</strong>. می‌توانید هم <strong>شماره آیدی عددی (Chat ID)</strong> و هم <strong>یوزرنیم (@username)</strong> تلگرام یا بله خود را اضافه کنید:
                </p>
              </div>
            </div>

            {/* Add New Admin ID / Username Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={newAdminInput}
                onChange={(e) => setNewAdminInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAdminId();
                  }
                }}
                placeholder="آیدی عددی (مثال: 589402194) یا یوزرنیم تلگرام/بله خود (مثال: @my_username) را وارد کنید..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-amber-400"
              />
              <GlassButton
                variant="amber"
                size="md"
                onClick={handleAddAdminId}
              >
                <Plus className="w-4 h-4" />
                <span>افزودن به لیست ادمین‌های بات</span>
              </GlassButton>
            </div>

            {/* Current Admin IDs List */}
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-medium">
                اکانت‌های دارای دسترسی ادمین در داخل بات ({toPersianDigits(adminList.length)} ادمین):
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {adminList.map((adm: string) => (
                  <div
                    key={adm}
                    className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-400/40 rounded-xl px-3 py-1.5 text-xs text-amber-200 font-mono"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{adm}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdminId(adm)}
                      className="text-amber-300/70 hover:text-rose-400 cursor-pointer ml-1"
                      title="حذف از لیست ادمین"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
              💡 <strong>چطور آیدی عددی خودم را پیدا کنم؟</strong> کافی است داخل ربات دستور <code>/id</code> را بفرستید (یا در تلگرام به ربات <code>@userinfobot</code> پیام دهید). ربات بلافاصله شماره آیدی عددی شما را نمایش می‌دهد!
            </div>
          </div>

          {/* STEP 2: TELEGRAM & BALE TOKEN + WEBHOOK REGISTRATION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Telegram Box */}
            <div className="bg-slate-950/80 border border-sky-500/30 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-sky-300">
                  ۱. اتصال توکن تلگرام (@BotFather) و ثبت وب‌هوک
                </h3>
                <div className="flex items-center gap-1.5">
                  <GlassButton
                    variant="cyan"
                    size="sm"
                    onClick={() => handleTestConnection('telegram')}
                    disabled={testingPlatform === 'telegram'}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>تست توکن</span>
                  </GlassButton>
                  <GlassButton
                    variant="emerald"
                    size="sm"
                    onClick={() => handleSetWebhook('telegram')}
                    disabled={testingPlatform === 'telegram'}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>ثبت خودکار Webhook تلگرام</span>
                  </GlassButton>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    توکن دریافتی از @BotFather تلگرام را اینجا Paste کنید:
                  </label>
                  <input
                    type="text"
                    value={formState.telegramBotToken}
                    onChange={(e) =>
                      setFormState({ ...formState, telegramBotToken: e.target.value })
                    }
                    placeholder="مثال: 7192837465:AAHxyz123456789..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Direct Browser Webhook Link for Telegram */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>لینک مستقیم ثبت وب‌هوک در مرورگر (روش جایگزین):</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(directTelegramBrowserWebhookUrl, 'tg_wh')}
                        className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'tg_wh' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'tg_wh' ? 'کپی شد' : 'کپی لینک'}</span>
                      </button>
                      {formState.telegramBotToken.trim() && (
                        <a
                          href={directTelegramBrowserWebhookUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>باز کردن مستقیم</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-sky-300 break-all bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {directTelegramBrowserWebhookUrl}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      یوزرنیم ربات تلگرام:
                    </label>
                    <input
                      type="text"
                      value={formState.telegramBotUsername}
                      onChange={(e) =>
                        setFormState({ ...formState, telegramBotUsername: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      آیدی کانال عضویت اجباری تلگرام:
                    </label>
                    <input
                      type="text"
                      value={formState.telegramChannelId}
                      onChange={(e) =>
                        setFormState({ ...formState, telegramChannelId: e.target.value })
                      }
                      placeholder="@CompanyChannel"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bale Box */}
            <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-emerald-300">
                  ۲. اتصال توکن بازوی بله (@botfather) و ثبت وب‌هوک
                </h3>
                <div className="flex items-center gap-1.5">
                  <GlassButton
                    variant="emerald"
                    size="sm"
                    onClick={() => handleTestConnection('bale')}
                    disabled={testingPlatform === 'bale'}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>تست توکن</span>
                  </GlassButton>
                  <GlassButton
                    variant="teal"
                    size="sm"
                    onClick={() => handleSetWebhook('bale')}
                    disabled={testingPlatform === 'bale'}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>ثبت خودکار Webhook بله</span>
                  </GlassButton>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    توکن دریافتی از @botfather پیام‌رسان بله را اینجا Paste کنید:
                  </label>
                  <input
                    type="text"
                    value={formState.baleBotToken}
                    onChange={(e) =>
                      setFormState({ ...formState, baleBotToken: e.target.value })
                    }
                    placeholder="مثال: 1892837465:baleToken..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>آدرس وب‌هوک اختصاصی بازوی بله شما:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(baleWebhookTarget, 'bale_wh')}
                      className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'bale_wh' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'bale_wh' ? 'کپی شد' : 'کپی آدرس'}</span>
                    </button>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-300 break-all bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {baleWebhookTarget}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      یوزرنیم بازوی بله:
                    </label>
                    <input
                      type="text"
                      value={formState.baleBotUsername}
                      onChange={(e) =>
                        setFormState({ ...formState, baleBotUsername: e.target.value })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      آیدی کانال عضویت اجباری بله:
                    </label>
                    <input
                      type="text"
                      value={formState.baleChannelId}
                      onChange={(e) =>
                        setFormState({ ...formState, baleChannelId: e.target.value })
                      }
                      placeholder="@CompanyBaleChannel"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <GlassButton type="submit" variant="emerald" size="lg">
              <Save className="w-4 h-4" />
              <span>ذخیره نهایی توکن‌ها و لیست آیدی ادمین‌ها</span>
            </GlassButton>
          </div>
        </form>
      ) : activeSubTab === 'linux_panel' ? (
        /* TAB 2: LINUX AUTO-INSTALLER, UPDATER & UNINSTALLER PANEL (`پنل نصب، آپدیت و حذف خودکار لینوکس از گیت‌هاب`) */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <span>پنل نصب، آپدیت و حذف کامل (Uninstall) روی سرور لینوکس از گیت‌هاب</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                اسکریپت مدیریت کامل سرور لینوکس (Ubuntu / Debian / CentOS) با قابلیت دانلود خودکار از گیت‌هاب، ساخت سرویس دائمی Systemd، آپدیت با حفظ دیتابیس فیش‌ها و حذف کامل
              </p>
            </div>

            <a
              href={installerDownloadUrl}
              download="install.sh"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/25 border border-emerald-400/50 text-emerald-100 text-xs sm:text-sm font-bold hover:bg-emerald-500/35 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل install.sh اختصاصی سرور شما</span>
            </a>
          </div>

          {/* Customizer Inputs for GitHub Repo, Path & Port */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                آدرس مخزن گیت‌هاب پروژه (GitHub Repository URL):
              </label>
              <input
                type="text"
                value={githubRepoUrl}
                onChange={(e) => setGithubRepoUrl(e.target.value)}
                placeholder="https://github.com/username/payroll-bot.git"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                مسیر نصب در سرور لینوکس (Install Directory):
              </label>
              <input
                type="text"
                value={linuxInstallDir}
                onChange={(e) => setLinuxInstallDir(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                پورت اجرای سرویس (Port):
              </label>
              <input
                type="text"
                value={linuxPort}
                onChange={(e) => setLinuxPort(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 4 One-Line Linux Commands (Interactive Panel, Install, Update, Uninstall) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Command 1: Interactive Linux Management Menu */}
            <div className="bg-slate-950 border border-emerald-500/35 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" />
                  <span>۱. اجرای پنل تعاملی لینوکس (منوی کامل ۱ تا ۶ در ترمینال)</span>
                </span>
                <GlassButton
                  variant="emerald"
                  size="sm"
                  onClick={() => copyToClipboard(interactiveMenuCmd, 'cmd_menu')}
                >
                  {copiedKey === 'cmd_menu' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cmd_menu' ? 'کپی شد' : 'کپی دستور'}</span>
                </GlassButton>
              </div>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-emerald-200 overflow-x-auto dir-ltr text-left">
                {interactiveMenuCmd}
              </pre>
            </div>

            {/* Command 2: Direct One-Line Install from GitHub */}
            <div className="bg-slate-950 border border-cyan-500/35 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Server className="w-4 h-4" />
                  <span>۲. دستور تک‌خطی نصب مستقیم از گیت‌هاب (Install)</span>
                </span>
                <GlassButton
                  variant="cyan"
                  size="sm"
                  onClick={() => copyToClipboard(oneLineInstallCmd, 'cmd_install')}
                >
                  {copiedKey === 'cmd_install' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cmd_install' ? 'کپی شد' : 'کپی دستور'}</span>
                </GlassButton>
              </div>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-cyan-200 overflow-x-auto dir-ltr text-left">
                {oneLineInstallCmd}
              </pre>
            </div>

            {/* Command 3: Direct One-Line Update from GitHub (Preserves DB) */}
            <div className="bg-slate-950 border border-indigo-500/35 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" />
                  <span>۳. دستور تک‌خطی آپدیت از گیت‌هاب با حفظ دیتابیس (Update)</span>
                </span>
                <GlassButton
                  variant="indigo"
                  size="sm"
                  onClick={() => copyToClipboard(oneLineUpdateCmd, 'cmd_update')}
                >
                  {copiedKey === 'cmd_update' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cmd_update' ? 'کپی شد' : 'کپی دستور'}</span>
                </GlassButton>
              </div>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-indigo-200 overflow-x-auto dir-ltr text-left">
                {oneLineUpdateCmd}
              </pre>
            </div>

            {/* Command 4: Complete Uninstall & Cleanup */}
            <div className="bg-slate-950 border border-rose-500/35 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" />
                  <span>۴. دستور حذف کامل سرویس و پاکسازی سرور (Uninstall)</span>
                </span>
                <GlassButton
                  variant="rose"
                  size="sm"
                  onClick={() => copyToClipboard(oneLineUninstallCmd, 'cmd_uninstall')}
                >
                  {copiedKey === 'cmd_uninstall' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cmd_uninstall' ? 'کپی شد' : 'کپی دستور'}</span>
                </GlassButton>
              </div>
              <pre className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-rose-200 overflow-x-auto dir-ltr text-left">
                {oneLineUninstallCmd}
              </pre>
            </div>
          </div>

          {/* Simulated Terminal Preview of the Linux Panel (100% Pure English LTR for SSH Terminals) */}
          <div
            dir="ltr"
            className="bg-slate-950 border border-slate-800 rounded-2xl p-5 font-mono text-xs space-y-1.5 text-slate-300 text-left"
          >
            <div className="text-cyan-400 font-bold">
              +--------------------------------------------------------------------+
            </div>
            <div className="text-emerald-400 font-bold">
              |      SalaryBot Management Panel (Sanaei 3x-ui Style CLI)           |
            </div>
            <div className="text-amber-300 font-bold">
              |      GitHub: {githubRepoUrl}               |
            </div>
            <div className="text-cyan-400 font-bold">
              +--------------------------------------------------------------------+
            </div>
            <div>
              Service Status : <span className="text-emerald-400">Running</span> | Auto-Start:{' '}
              <span className="text-emerald-400">Enabled</span>
            </div>
            <div>
              Install Path   : <span className="text-amber-300">{linuxInstallDir}</span> | Port:{' '}
              <span className="text-amber-300">{linuxPort}</span>
            </div>
            <div className="text-cyan-400">
              ----------------------------------------------------------------------
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-emerald-400">0.</span> Exit Panel
              </div>
              <div className="text-cyan-400">
                ----------------------------------------------------------------------
              </div>
              <div>
                <span className="text-emerald-400">1.</span> Install SalaryBot from GitHub (Full Setup)
              </div>
              <div>
                <span className="text-emerald-400">2.</span> Update SalaryBot from GitHub (Preserves Database)
              </div>
              <div>
                <span className="text-emerald-400">3.</span> Uninstall SalaryBot Completely
              </div>
              <div className="text-cyan-400">
                ----------------------------------------------------------------------
              </div>
              <div>
                <span className="text-emerald-400">4.</span> Configure Bot Tokens, Port &amp; Admin Chat ID
              </div>
              <div>
                <span className="text-emerald-400">5.</span> Set Webhook on Telegram / Bale API
              </div>
              <div>
                <span className="text-emerald-400">6.</span> Backup Payroll Database (payroll-db.json)
              </div>
              <div className="text-cyan-400">
                ----------------------------------------------------------------------
              </div>
              <div>
                <span className="text-emerald-400">7.</span> Start SalaryBot Service
              </div>
              <div>
                <span className="text-emerald-400">8.</span> Stop SalaryBot Service
              </div>
              <div>
                <span className="text-emerald-400">9.</span> Restart SalaryBot Service
              </div>
              <div>
                <span className="text-emerald-400">10.</span> View Live Service Logs (journalctl)
              </div>
            </div>
            <div className="text-cyan-400 font-bold">
              +--------------------------------------------------------------------+
            </div>
            <div className="text-slate-400 pt-1">
              Please enter your selection [0-10]: _
            </div>
          </div>
        </div>
      ) : (
        /* TAB 3: DATABASE MANAGEMENT, AUTOMATIC TELEGRAM BACKUP & RESTORE (`خام‌سازی، بکاپ اتومات تلگرام و بازگردانی`) */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-400" />
              <span>مدیریت کامل دیتابیس، خام‌سازی، بکاپ‌گیری اتوماتیک تلگرام و بازگردانی</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              تنظیم ارسال خودکار فایل بکاپ کامل و کم‌حجم به چت تلگرام/بله ادمین، بازگردانی ۱۰۰٪ دیتابیس و امکان خام‌سازی صفر تا صد
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Box 1: Automatic Scheduled Backup to Telegram Admin Chat */}
            <div className="bg-slate-950/80 border border-cyan-500/35 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-cyan-400" />
                  <span>۱. ارسال خودکار و دوره‌ای بکاپ به چت تلگرام ادمین</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  فایل ۱۰۰٪ کامل و فشرده
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                  <div>
                    <div className="text-xs font-bold text-white mb-0.5">
                      ارسال خودکار بکاپ به تلگرام/بله ادمین:
                    </div>
                    <div className="text-[11px] text-slate-400">
                      هر چند ساعت، فایل بکاپ <code className="text-cyan-300">payroll-db.json</code> مستقیماً به چت ادمین پیام‌رسانی می‌شود.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formState.autoBackupEnabled !== false}
                      onChange={(e) => {
                        const updated = { ...formState, autoBackupEnabled: e.target.checked };
                        setFormState(updated);
                        onSaveConfig({ autoBackupEnabled: e.target.checked });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      بازه زمانی ارسال خودکار (ساعت):
                    </label>
                    <select
                      value={formState.autoBackupIntervalHours || 6}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = { ...formState, autoBackupIntervalHours: val };
                        setFormState(updated);
                        onSaveConfig({ autoBackupIntervalHours: val });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value={1}>هر ۱ ساعت</option>
                      <option value={2}>هر ۲ ساعت</option>
                      <option value={3}>هر ۳ ساعت</option>
                      <option value={6}>هر ۶ ساعت (پیش‌فرض)</option>
                      <option value={12}>هر ۱۲ ساعت</option>
                      <option value={24}>هر ۲۴ ساعت (روزانه)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      آخرین زمان ارسال بکاپ:
                    </label>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono tabular-nums truncate">
                      {config.lastBackupAt || 'هنوز ارسال نشده'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <GlassButton
                    type="button"
                    variant="cyan"
                    size="md"
                    onClick={onSendBackupNow}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>ارسال فوری بکاپ کامل به چت تلگرام/بله (همین الان)</span>
                  </GlassButton>

                  <a
                    href="/api/database/export"
                    download="payroll-db-backup.json"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>دانلود مستقیم فایل JSON بکاپ</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Box 2: Restore Database from Backup File */}
            <div className="bg-slate-950/80 border border-emerald-500/35 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span>۲. بازگردانی دیتابیس از فایل بکاپ (Restore)</span>
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  بازگردانی ۱۰۰٪ اطلاعات
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  فایل بکاپ <code className="text-emerald-300">payroll-db-backup.json</code> که قبلاً دانلود کرده‌اید یا از چت تلگرام/بله دریافت کرده‌اید را انتخاب فرمایید تا تمام اطلاعات پرسنل، فیش‌ها و سوابق پیام‌ها ۱۰۰٪ بازگردانی شود:
                </p>

                <div className="bg-slate-900 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-2xl p-5 text-center transition-colors">
                  <input
                    type="file"
                    accept=".json"
                    id="restoreFileInput"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && onRestoreDatabase) {
                        onRestoreDatabase(file);
                        e.target.value = '';
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="restoreFileInput" className="cursor-pointer space-y-2 block">
                    <Upload className="w-8 h-8 text-emerald-400 mx-auto" />
                    <div className="text-xs font-bold text-white">
                      کلیک کنید تا فایل بکاپ JSON را انتخاب و بازگردانی کنید
                    </div>
                    <div className="text-[11px] text-slate-400">
                      پشتیبانی از فایل‌های بکاپ دریافت شده در چت تلگرام یا بله
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Box 3: Clean Reset / Wipe Database Option (`خام کردن کامل دیتابیس`) */}
          <div className="bg-rose-950/40 border-2 border-rose-500/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-500/30 pb-3">
              <h3 className="text-sm font-bold text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>۳. خام‌سازی و پاکسازی کامل دیتابیس (Reset / Wipe Database)</span>
              </h3>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed space-y-2">
              <p>
                با کلیک روی دکمه زیر، تمامی پرسنل، درخواست‌های کارت ملی، فیش‌های حقوقی و پیام‌های ثبت‌شده در ربات <strong>به طور کامل پاکسازی و صفر می‌شود</strong> تا سامانه به حالت اولیه خام بازگردد. (توکن ربات و لیست ادمین‌ها محفوظ می‌ماند).
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end">
              <GlassButton
                type="button"
                variant="rose"
                size="md"
                onClick={() => {
                  if (
                    window.confirm(
                      '⚠️ آیا مطمئن هستید که می‌خواهید دیتابیس را کاملاً خام و پاکسازی کنید؟ تمام پرسنل و فیش‌های موجود حذف خواهند شد!'
                    )
                  ) {
                    if (onWipeDatabase) onWipeDatabase();
                  }
                }}
              >
                <Trash2 className="w-4 h-4" />
                <span>خام‌سازی و پاکسازی کامل دیتابیس (Reset DB)</span>
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
