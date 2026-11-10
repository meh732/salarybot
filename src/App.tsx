import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { BotSettingsPanel } from './components/BotSettingsPanel';
import { BotSimulator } from './components/BotSimulator';
import { BroadcastCenter } from './components/BroadcastCenter';
import { GlassButton } from './components/GlassButton';
import { PayslipUploader } from './components/PayslipUploader';
import { VerificationQueue } from './components/VerificationQueue';
import {
  AppStateResponse,
  BotConfig,
  GlassColorVariant,
  PayslipItem,
  PlatformType,
} from './types/payroll';
import { formatRial, toPersianDigits } from './utils/payslipGenerator';

type ActiveSection =
  | 'workspace'
  | 'verification'
  | 'payslips'
  | 'broadcast'
  | 'settings';

export default function App() {
  const [state, setState] = useState<AppStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('workspace');
  const [selectedBotUserId, setSelectedBotUserId] = useState<string>('usr-admin-master');
  const [highlightedVerifyUserId, setHighlightedVerifyUserId] = useState<string | null>(null);
  const [isBotBusy, setIsBotBusy] = useState<boolean>(false);

  const fetchState = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('خطا در دریافت اطلاعات از سرور');
      const data = (await res.json()) as AppStateResponse;
      setState(data);
      if (data.users.length > 0 && !data.users.some((u) => u.id === selectedBotUserId)) {
        setSelectedBotUserId(data.users[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ارتباط با سرور');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const handleBotInteract = async (params: {
    userId: string;
    actionType: 'command' | 'callback' | 'text' | 'national_card_upload' | 'join_channel';
    payload?: string;
    nationalCardImageUrl?: string;
    submittedName?: string;
    nationalCode?: string;
  }) => {
    setIsBotBusy(true);
    try {
      const res = await fetch('/api/bot/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } finally {
      setIsBotBusy(false);
    }
  };

  const handleAdminUploadInChat = async (params: {
    adminUserId: string;
    items: Omit<PayslipItem, 'id' | 'createdAt'>[];
    fileName: string;
  }) => {
    setIsBotBusy(true);
    try {
      const res = await fetch('/api/bot/admin-upload-in-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } finally {
      setIsBotBusy(false);
    }
  };

  const handleCreateSimUser = async (platform: PlatformType) => {
    setIsBotBusy(true);
    try {
      const res = await fetch('/api/users/create-sim-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      if (data.ok && data.state && data.user) {
        setState(data.state);
        setSelectedBotUserId(data.user.id);
      }
    } finally {
      setIsBotBusy(false);
    }
  };

  const handleVerifyUser = async (params: {
    userId: string;
    decision: 'approve' | 'reject';
    personnelCode?: string;
    department?: string;
    jobTitle?: string;
    rejectionReason?: string;
  }) => {
    const res = await fetch('/api/users/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
      setSelectedBotUserId(params.userId);
    }
  };

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    const res = await fetch('/api/users/toggle-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isActive }),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
    }
  };

  const handleUpdateUserCode = async (params: {
    userId: string;
    personnelCode: string;
    department?: string;
    jobTitle?: string;
  }) => {
    const res = await fetch('/api/users/update-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
    }
  };

  const handleBatchUploadPayslips = async (
    items: Omit<PayslipItem, 'id' | 'createdAt'>[],
    notifyUsers: boolean
  ) => {
    const res = await fetch('/api/payslips/batch-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, notifyUsers }),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
    }
  };

  const handleDeletePayslip = async (id: string) => {
    const res = await fetch(`/api/payslips/${id}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
    }
  };

  const handleSendBroadcast = async (params: {
    title: string;
    message: string;
    targetFilter: string;
    buttonText?: string;
    buttonColor?: GlassColorVariant;
    buttonCallback?: string;
  }): Promise<number> => {
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
      return data.sentCount || 0;
    }
    return 0;
  };

  const handleSaveConfig = async (newConfig: Partial<BotConfig>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      setState(data.state);
    }
  };

  const handleWipeDatabase = async () => {
    try {
      const res = await fetch('/api/database/wipe', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
        alert('✅ دیتابیس با موفقیت کاملاً خام و پاکسازی گردید.');
      } else {
        alert(data.error || 'خطا در پاکسازی دیتابیس');
      }
    } catch {
      alert('خطا در ارتباط با سرور هنگام پاکسازی دیتابیس');
    }
  };

  const handleSendBackupNow = async () => {
    try {
      const res = await fetch('/api/database/send-backup', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
        alert(data.message || '✅ فایل بکاپ به چت تلگرام/بله ادمین ارسال شد.');
      } else {
        alert(data.error || 'خطا در ارسال بکاپ به چت ادمین');
      }
    } catch {
      alert('خطا در ارتباط با سرور هنگام ارسال بکاپ');
    }
  };

  const handleRestoreDatabase = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/database/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
        alert('✅ دیتابیس با موفقیت از فایل بکاپ ۱۰۰٪ بازگردانی گردید!');
      } else {
        alert(data.error || 'فایل بکاپ نامعتبر است.');
      }
    } catch {
      alert('فرمت فایل بکاپ ارسالی معتبر نیست.');
    }
  };

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 mx-auto animate-pulse" />
          <p className="text-sm font-semibold text-slate-300">
            در حال بارگذاری سامانه مدیریت بات فیش حقوقی تلگرام و بله...
          </p>
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <p className="text-sm text-rose-300">{error || 'خطا در بارگذاری سامانه'}</p>
          <GlassButton variant="emerald" size="md" onClick={fetchState}>
            تلاش مجدد
          </GlassButton>
        </div>
      </div>
    );
  }

  const pendingVerificationCount = state.users.filter(
    (u) => u.verificationStatus === 'pending_admin'
  ).length;
  const approvedUsersCount = state.users.filter(
    (u) => u.verificationStatus === 'approved' && u.isActive && !u.isAdmin
  ).length;
  const totalNetPayroll = state.payslips
    .filter((p) => p.year === 1404 && p.month === 8)
    .reduce((acc, item) => acc + item.netPay, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16 md:pb-0">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-4 sm:px-8 py-3.5 bg-slate-950/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        {/* Zone 1: Brand Wordmark (Single Text Element) */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('workspace');
          }}
          className="text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          سامانه بات فیش حقوقی تلگرام و بله
        </a>

        {/* Zone 2: 5 Clean Single-Line Text Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveSection('workspace')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-1 border-b-2 ${
              activeSection === 'workspace'
                ? 'text-cyan-300 border-cyan-400 font-bold'
                : 'border-transparent'
            }`}
          >
            پیشخوان و شبیه‌ساز بات
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('verification')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-1 border-b-2 ${
              activeSection === 'verification'
                ? 'text-cyan-300 border-cyan-400 font-bold'
                : 'border-transparent'
            }`}
          >
            احراز هویت و کد پرسنلی ({toPersianDigits(pendingVerificationCount)})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('payslips')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-1 border-b-2 ${
              activeSection === 'payslips'
                ? 'text-cyan-300 border-cyan-400 font-bold'
                : 'border-transparent'
            }`}
          >
            بارگذاری اکسل و PDF فیش
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('broadcast')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-1 border-b-2 ${
              activeSection === 'broadcast'
                ? 'text-cyan-300 border-cyan-400 font-bold'
                : 'border-transparent'
            }`}
          >
            ارسال پیام گروهی
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('settings')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer pb-1 border-b-2 ${
              activeSection === 'settings'
                ? 'text-cyan-300 border-cyan-400 font-bold'
                : 'border-transparent'
            }`}
          >
            تنظیمات بات و کانال اجباری
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <GlassButton
            variant="emerald"
            size="sm"
            onClick={() => setActiveSection('payslips')}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>آپلود اکسل / PDF فیش</span>
          </GlassButton>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Executive KPI Summary Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">پرسنل تأیید شده و فعال (تلگرام و بله)</div>
            <div className="text-xl sm:text-2xl font-extrabold text-white mt-1 tabular-nums">
              {toPersianDigits(approvedUsersCount)} نفر
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">
              متصل به کد پرسنلی اختصاصی
            </div>
          </div>

          <div
            onClick={() => setActiveSection('verification')}
            className="bg-slate-900 border border-amber-500/35 hover:border-amber-400 rounded-2xl p-4 cursor-pointer transition-colors"
          >
            <div className="text-xs text-amber-300">درخواست‌های احراز هویت (کارت ملی جدید)</div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-300 mt-1 tabular-nums">
              {toPersianDigits(pendingVerificationCount)} درخواست
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              قابل تأیید هم در داخل بات (/admin) و هم در پنل وب
            </div>
          </div>

          <div
            onClick={() => setActiveSection('payslips')}
            className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-4 cursor-pointer transition-colors"
          >
            <div className="text-xs text-slate-400">کل فیش‌های بارگذاری شده (اکسل و PDF)</div>
            <div className="text-xl sm:text-2xl font-extrabold text-cyan-300 mt-1 tabular-nums">
              {toPersianDigits(state.payslips.length)} فیش
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              قابل آپلود مستقیم در چت بات و پنل وب
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-400">خالص پرداختی دوره جاری (آبان ۱۴۰۴)</div>
            <div className="text-base sm:text-lg font-extrabold text-emerald-400 mt-1.5 tabular-nums truncate">
              {formatRial(totalNetPayroll)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              تحویل خودکار عکس + PDF به هر کد پرسنلی
            </div>
          </div>
        </section>

        {/* Active View Routing */}
        {activeSection === 'workspace' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
            {/* Left / Primary Column: Interactive Live Bot Simulator (Telegram & Bale) */}
            <div className="xl:col-span-6 flex flex-col h-[760px]">
              <BotSimulator
                state={state}
                selectedUserId={selectedBotUserId}
                onSelectUser={setSelectedBotUserId}
                onBotInteract={handleBotInteract}
                onAdminUploadInChat={handleAdminUploadInChat}
                onCreateSimUser={handleCreateSimUser}
                isBusy={isBotBusy}
                onJumpToAdminVerify={(userId) => {
                  setHighlightedVerifyUserId(userId);
                  setActiveSection('verification');
                }}
              />
            </div>

            {/* Right Column: Live Admin Command Center (Pending Verifications + Quick Upload + Quick Broadcast) */}
            <div className="xl:col-span-6 space-y-5">
              {/* Quick Admin Box 1: Pending National ID Verifications & Personnel Code Linking */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      صف احراز هویت اولیه (بررسی کارت ملی و اتصال به کد پرسنلی)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      کاربرانی که پس از عضویت در کانال اجباری، نام و تصویر کارت ملی خود را از تلگرام یا بله ارسال کرده‌اند
                    </p>
                  </div>
                  <GlassButton
                    variant="cyan"
                    size="sm"
                    onClick={() => setActiveSection('verification')}
                  >
                    <span>مدیریت همه کاربران ({toPersianDigits(state.users.length)})</span>
                  </GlassButton>
                </div>

                <VerificationQueue
                  state={{
                    ...state,
                    users: state.users.slice(0, 3),
                  }}
                  onVerifyUser={handleVerifyUser}
                  onToggleUserActive={handleToggleUserActive}
                  onUpdateUserCode={handleUpdateUserCode}
                  onOpenUserInBot={(uid) => setSelectedBotUserId(uid)}
                  highlightedUserId={highlightedVerifyUserId}
                />
              </div>

              {/* Quick Admin Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <GlassButton
                  variant="emerald"
                  size="lg"
                  fullWidth
                  onClick={() => setActiveSection('payslips')}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>بارگذاری اکسل و PDF فیش</span>
                </GlassButton>
                <GlassButton
                  variant="violet"
                  size="lg"
                  fullWidth
                  onClick={() => setActiveSection('broadcast')}
                >
                  <Megaphone className="w-4 h-4" />
                  <span>ارسال پیام گروهی</span>
                </GlassButton>
                <GlassButton
                  variant="indigo"
                  size="lg"
                  fullWidth
                  onClick={() => setActiveSection('settings')}
                >
                  <Settings className="w-4 h-4" />
                  <span>تنظیمات کانال اجباری و بات</span>
                </GlassButton>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'verification' && (
          <VerificationQueue
            state={state}
            onVerifyUser={handleVerifyUser}
            onToggleUserActive={handleToggleUserActive}
            onUpdateUserCode={handleUpdateUserCode}
            onOpenUserInBot={(uid) => {
              setSelectedBotUserId(uid);
              setActiveSection('workspace');
            }}
            highlightedUserId={highlightedVerifyUserId}
          />
        )}

        {activeSection === 'payslips' && (
          <PayslipUploader
            state={state}
            onBatchUploadPayslips={handleBatchUploadPayslips}
            onDeletePayslip={handleDeletePayslip}
          />
        )}

        {activeSection === 'broadcast' && (
          <BroadcastCenter
            state={state}
            onSendBroadcast={handleSendBroadcast}
          />
        )}

        {activeSection === 'settings' && (
          <BotSettingsPanel
            config={state.config}
            onSaveConfig={handleSaveConfig}
            onWipeDatabase={handleWipeDatabase}
            onSendBackupNow={handleSendBackupNow}
            onRestoreDatabase={handleRestoreDatabase}
          />
        )}
      </main>

      {/* Mobile & Android Bottom Navigation Bar (<= 15% viewport height) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 grid grid-cols-5 gap-1">
        <button
          type="button"
          onClick={() => setActiveSection('workspace')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeSection === 'workspace' ? 'text-cyan-300 bg-cyan-500/15' : 'text-slate-400'
          }`}
        >
          <MessageSquare className="w-4 h-4 mb-0.5" />
          <span className="truncate">ربات زنده</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('verification')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeSection === 'verification' ? 'text-amber-300 bg-amber-500/15' : 'text-slate-400'
          }`}
        >
          <ShieldCheck className="w-4 h-4 mb-0.5" />
          <span className="truncate">احراز ({toPersianDigits(pendingVerificationCount)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('payslips')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeSection === 'payslips' ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 mb-0.5" />
          <span className="truncate">آپلود فیش</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('broadcast')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeSection === 'broadcast' ? 'text-violet-300 bg-violet-500/15' : 'text-slate-400'
          }`}
        >
          <Megaphone className="w-4 h-4 mb-0.5" />
          <span className="truncate">پیام گروهی</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-medium cursor-pointer ${
            activeSection === 'settings' ? 'text-indigo-300 bg-indigo-500/15' : 'text-slate-400'
          }`}
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span className="truncate">تنظیمات</span>
        </button>
      </nav>
    </div>
  );
}
