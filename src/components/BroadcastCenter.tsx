import React, { useState } from 'react';
import { CheckCircle2, Megaphone, Send, Users } from 'lucide-react';
import { AppStateResponse, GlassColorVariant } from '../types/payroll';
import { toPersianDigits } from '../utils/payslipGenerator';
import { GlassButton } from './GlassButton';

interface BroadcastCenterProps {
  state: AppStateResponse;
  onSendBroadcast: (params: {
    title: string;
    message: string;
    targetFilter: string;
    buttonText?: string;
    buttonColor?: GlassColorVariant;
    buttonCallback?: string;
  }) => Promise<number>;
}

const COLOR_OPTIONS: { value: GlassColorVariant; label: string }[] = [
  { value: 'emerald', label: 'سبز زمردی شیشه‌ای' },
  { value: 'cyan', label: 'فیروزه‌ای شیشه‌ای' },
  { value: 'indigo', label: 'نیلی شیشه‌ای' },
  { value: 'violet', label: 'بنفش شیشه‌ای' },
  { value: 'amber', label: 'طلایی شیشه‌ای' },
  { value: 'rose', label: 'سرخ یاقوتی شیشه‌ای' },
];

export const BroadcastCenter: React.FC<BroadcastCenterProps> = ({
  state,
  onSendBroadcast,
}) => {
  const [title, setTitle] = useState('اطلاعیه بارگذاری فیش حقوقی ماه جاری');
  const [message, setMessage] = useState(
    'همکاران گرامی، فیش حقوقی ماه جاری در سامانه بارگذاری گردید. هم‌اکنون می‌توانید با کلیک روی دکمه شیشه‌ای زیر، سال و ماه مورد نظر را انتخاب کرده و تصویر و فایل PDF فیش خود را دریافت نمایید.'
  );
  const [targetFilter, setTargetFilter] = useState<string>('all_active');
  const [buttonText, setButtonText] = useState('📄 دریافت فوری فیش حقوقی (تصویر + PDF)');
  const [buttonColor, setButtonColor] = useState<GlassColorVariant>('emerald');
  const [buttonCallback, setButtonCallback] = useState('menu_payslips');
  const [sentBanner, setSentBanner] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const departments = Array.from(
    new Set(state.personnelDirectory.map((p) => p.department))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSending) return;
    setIsSending(true);
    try {
      const count = await onSendBroadcast({
        title,
        message,
        targetFilter,
        buttonText,
        buttonColor,
        buttonCallback,
      });
      setSentBanner(
        `✅ پیام گروهی با دکمه شیشه‌ای رنگی با موفقیت برای ${toPersianDigits(
          count
        )} کاربر در تلگرام و بله ارسال گردید!`
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white">
            ارسال پیام گروهی و اطلاع‌رسانی سازمانی (تلگرام و بله)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            ارسال پیام گروهی به همه پرسنل فعال، کاربران تلگرام، کاربران بله یا یک واحد خاص همراه با دکمه‌های شیشه‌ای رنگی تعاملی
          </p>
        </div>

        {sentBanner && (
          <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3.5 text-xs sm:text-sm text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sentBanner}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Fields */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  گروه هدف دریافت‌کنندگان پیام *
                </label>
                <select
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="all_active">همه پرسنل فعال و احراز هویت شده</option>
                  <option value="all_users">تمامی کاربران ربات (تلگرام + بله)</option>
                  <option value="telegram_only">فقط کاربران پیام‌رسان تلگرام</option>
                  <option value="bale_only">فقط کاربران پیام‌رسان بله</option>
                  <option value="pending_verification">کاربران در انتظار تکمیل احراز هویت</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      واحد سازمانی: {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  عنوان اطلاعیه سازمانی *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                متن کامل پیام گروهی *
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-white leading-relaxed focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  متن دکمه شیشه‌ای زیر پیام:
                </label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  رنگ پس‌زمینه دکمه شیشه‌ای:
                </label>
                <select
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value as GlassColorVariant)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  عملیات دکمه پس از کلیک پرسنل:
                </label>
                <select
                  value={buttonCallback}
                  onChange={(e) => setButtonCallback(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="menu_payslips">باز کردن انتخاب سال و ماه فیش</option>
                  <option value="latest_payslip">ارسال فوری آخرین فیش حقوقی</option>
                  <option value="menu_profile">نمایش پرونده و کد پرسنلی</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <GlassButton type="submit" variant="emerald" size="lg" disabled={isSending}>
                <Send className="w-4 h-4" />
                <span>ارسال فوری پیام گروهی به کاربران هدف</span>
              </GlassButton>
            </div>
          </div>

          {/* Live Glassmorphic Message Preview */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
            <div className="text-xs font-bold text-slate-400 flex items-center gap-2 border-b border-slate-800 pb-2.5">
              <Megaphone className="w-4 h-4 text-violet-400" />
              <span>پیش‌نمایش زنده پیام گروهی در چت تلگرام و بله پرسنل</span>
            </div>

            <div className="space-y-2 my-auto">
              <div className="bg-gradient-to-br from-violet-950/90 via-slate-900 to-indigo-950/90 border border-violet-400/40 rounded-2xl rounded-tl-xs p-4 text-xs sm:text-sm text-slate-100 whitespace-pre-line leading-relaxed shadow-lg">
                <div className="font-bold text-violet-200 mb-2">
                  📢 {title || 'اطلاعیه رسمی مدیریت'}
                </div>
                <div>{message}</div>
              </div>

              {buttonText && (
                <GlassButton variant={buttonColor} size="md" fullWidth>
                  <span>{buttonText}</span>
                </GlassButton>
              )}
              <GlassButton variant="cyan" size="md" fullWidth>
                <span>🏠 منوی اصلی ربات</span>
              </GlassButton>
            </div>

            <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-2.5 flex items-center justify-between">
              <span>تحویل آنی در شبیه‌ساز و سرور ربات</span>
              <span className="text-cyan-400 font-semibold">پشتیبانی از دکمه‌های شیشه‌ای رنگی</span>
            </div>
          </div>
        </form>
      </div>

      {/* Broadcast History Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <h3 className="text-base font-bold text-white">
            تاریخچه پیام‌های گروهی ارسال شده ({toPersianDigits(state.broadcastLogs.length)})
          </h3>
        </div>

        <div className="space-y-2.5">
          {state.broadcastLogs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="text-sm font-bold text-white">{log.title}</div>
                <p className="text-xs text-slate-400 line-clamp-2">{log.message}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 shrink-0 tabular-nums">
                <span>تعداد گیرندگان: {toPersianDigits(log.sentCount)} نفر</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-400">{log.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
