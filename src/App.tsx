import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
  Upload,
  User,
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

const PANEL_TOKEN_STORAGE_KEY = 'salarybot_panel_token';

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(PANEL_TOKEN_STORAGE_KEY) || '' : '';
  return {
    ...extra,
    ...(token ? { 'x-panel-token': token } : {}),
  };
}

export default function App() {
  const [state, setState] = useState<AppStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState<string>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [orgTitle, setOrgTitle] = useState<string>('شرکت رویال صنعت سامانه');

  const [activeSection, setActiveSection] = useState<ActiveSection>('workspace');
  const [selectedBotUserId, setSelectedBotUserId] = useState<string>('usr-admin-master');
  const [highlightedVerifyUserId, setHighlightedVerifyUserId] = useState<string | null>(null);
  const [isBotBusy, setIsBotBusy] = useState<boolean>(false);

  const fetchState = async () => {
    try {
      setLoading(true);
      const authRes = await fetch('/api/auth/status', {
        headers: getAuthHeaders(),
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        setAuthRequired(Boolean(authData.authRequired));
        if (authData.organizationName) setOrgTitle(authData.organizationName);
        if (authData.authRequired && !authData.authenticated) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        setIsAuthenticated(true);
      }

      const res = await fetch('/api/state', {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        setAuthRequired(true);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        if (data.token) {
          localStorage.setItem(PANEL_TOKEN_STORAGE_KEY, data.token);
        }
        setIsAuthenticated(true);
        setLoginPassword('');
        await fetchState();
      } else {
        setLoginError(data.error || 'نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch {
      setLoginError('خطا در برقراری ارتباط با سرور');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
    } catch {
      // ignore
    }
    localStorage.removeItem(PANEL_TOKEN_STORAGE_KEY);
    setIsAuthenticated(false);
  };

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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders(),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newConfig),
    });
    const data = await res.json();
    if (data.ok && data.state) {
      if (data.panelToken) {
        localStorage.setItem(PANEL_TOKEN_STORAGE_KEY, data.panelToken);
        setAuthRequired(true);
        setIsAuthenticated(true);
      } else if (newConfig.panelPassword !== undefined && !newConfig.panelPassword.trim()) {
        localStorage.removeItem(PANEL_TOKEN_STORAGE_KEY);
        setAuthRequired(false);
      }
      setState(data.state);
    }
  };

  const handleWipeDatabase = async (factoryReset = false) => {
    try {
      const res = await fetch('/api/database/wipe', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ factoryReset }),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } catch (err) {
      console.error('Error wiping database:', err);
    }
  };

  const handleSendBackupNow = async () => {
    try {
      const res = await fetch('/api/database/send-backup', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } catch (err) {
      console.error('Error sending backup:', err);
    }
  };

  const handleRestoreDatabase = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch('/api/database/restore', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setState(data.state);
      }
    } catch (err) {
      console.error('Error restoring database:', err);
    }
  };

  if (loading && !state && isAuthenticated) {
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

  if (authRequired && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white">
              ورود به پنل مدیریت سامانه فیش حقوقی
            </h1>
            <p className="text-xs text-slate-400">
              {orgTitle} — دسترسی محدود به مدیران مجاز سازمان
            </p>
          </div>

          {loginError && (
            <div className="bg-rose-950/70 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-200 text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                نام کاربری (Username):
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="نام کاربری (پیش‌فرض: admin)"
                  autoComplete="username"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رمز عبور (Password):
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="رمز عبور پنل مدیریت"
                  autoComplete="current-password"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <GlassButton
              type="submit"
              variant="emerald"
              size="lg"
              fullWidth
              disabled={isLoggingIn}
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? 'در حال بررسی...' : 'ورود به پنل مدیریت'}</span>
            </GlassButton>
          </form>

          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>راهنمای بازیابی یا تغییر رمز در سرور لینوکس:</strong> در ترمینال سرور دستور{' '}
            <code className="text-emerald-300">salarybot</code> را وارد کرده و گزینه{' '}
            <code className="text-amber-300">11</code> (یا گزینه <code className="text-cyan-300">2</code> هنگام آپدیت) را انتخاب نمایید.
          </div>
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
  const totalNetPayroll = state.payslips.reduce((acc, item) => acc + item.netPay, 0);

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

        {/* Zone 3: Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/database/export"
            download="payroll-database-backup.json"
            title="دانلود مستقیم و دستی فایل کامل دیتابیس (.json)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-teal-300 border border-teal-500/40 transition-colors shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">دریافت بکاپ (.json)</span>
          </a>
          <GlassButton
            variant="emerald"
            size="sm"
            onClick={() => setActiveSection('payslips')}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>آپلود اکسل / PDF فیش</span>
          </GlassButton>
          {(authRequired || Boolean(state.config.panelPassword)) && (
            <button
              type="button"
              onClick={handleLogout}
              title="قفل و خروج از پنل مدیریت"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          )}
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
