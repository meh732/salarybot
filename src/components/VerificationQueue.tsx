import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Link2,
  Power,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { AppStateResponse, BotUser } from '../types/payroll';
import { generateNationalCardSvgDataUrl, toPersianDigits } from '../utils/payslipGenerator';
import { GlassButton } from './GlassButton';

interface VerificationQueueProps {
  state: AppStateResponse;
  onVerifyUser: (params: {
    userId: string;
    decision: 'approve' | 'reject';
    personnelCode?: string;
    department?: string;
    jobTitle?: string;
    rejectionReason?: string;
  }) => Promise<void>;
  onToggleUserActive: (userId: string, isActive: boolean) => Promise<void>;
  onUpdateUserCode: (params: {
    userId: string;
    personnelCode: string;
    department?: string;
    jobTitle?: string;
  }) => Promise<void>;
  onOpenUserInBot: (userId: string) => void;
  highlightedUserId?: string | null;
}

export const VerificationQueue: React.FC<VerificationQueueProps> = ({
  state,
  onVerifyUser,
  onToggleUserActive,
  onUpdateUserCode,
  onOpenUserInBot,
  highlightedUserId,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'pending_admin' | 'approved' | 'telegram' | 'bale'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Record<string, string>>({});
  const [selectedDepts, setSelectedDepts] = useState<Record<string, string>>({});
  const [previewCardUser, setPreviewCardUser] = useState<BotUser | null>(null);
  const [rejectingUser, setRejectingUser] = useState<BotUser | null>(null);
  const [rejectReason, setRejectReason] = useState('تصویر کارت ملی ناخوانا است یا با مشخصات سازمانی مطابقت ندارد');
  const [editingCodeUserId, setEditingCodeUserId] = useState<string | null>(null);

  const filteredUsers = state.users.filter((u) => {
    if (filterTab === 'pending_admin' && u.verificationStatus !== 'pending_admin') return false;
    if (filterTab === 'approved' && u.verificationStatus !== 'approved') return false;
    if (filterTab === 'telegram' && u.platform !== 'telegram') return false;
    if (filterTab === 'bale' && u.platform !== 'bale') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        u.submittedName.toLowerCase().includes(q) ||
        u.messengerId.includes(q) ||
        (u.personnelCode && u.personnelCode.includes(q)) ||
        u.nationalCode.includes(q) ||
        u.username.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSuggestedCode = (user: BotUser): string => {
    if (selectedCodes[user.id] !== undefined) return selectedCodes[user.id];
    if (user.personnelCode) return user.personnelCode;

    // Auto-match by name or nationalCode from personnelDirectory if possible
    const match = state.personnelDirectory.find(
      (p) =>
        (user.nationalCode && p.nationalCode === user.nationalCode) ||
        (user.submittedName && p.fullName.includes(user.submittedName))
    );
    return match ? match.personnelCode : '1004';
  };

  const handleApproveAndLink = async (user: BotUser) => {
    const code = getSuggestedCode(user).trim();
    if (!code) return;
    const matchedRecord = state.personnelDirectory.find((p) => p.personnelCode === code);
    const dept =
      selectedDepts[user.id] ||
      matchedRecord?.department ||
      user.department ||
      'عملیات و لجستیک انبار';

    await onVerifyUser({
      userId: user.id,
      decision: 'approve',
      personnelCode: code,
      department: dept,
      jobTitle: matchedRecord?.jobTitle || user.jobTitle || 'کارشناس',
    });
    setEditingCodeUserId(null);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingUser) return;
    await onVerifyUser({
      userId: rejectingUser.id,
      decision: 'reject',
      rejectionReason: rejectReason,
    });
    setRejectingUser(null);
  };

  const pendingCount = state.users.filter((u) => u.verificationStatus === 'pending_admin').length;

  return (
    <div className="space-y-5">
      {/* Header & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              احراز هویت پرسنل، بررسی کارت ملی و اتصال به کد پرسنلی
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              بررسی تصویر کارت ملی، نام و شماره آیدی تلگرام یا بله پرسنل، لینک کردن هر حساب به یک کد پرسنلی اختصاصی و فعال/غیرفعال‌سازی دسترسی کاربران
            </p>
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام، کد پرسنلی، آیدی تلگرام/بله..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Interactive Filter Segmented Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filterTab === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            همه کاربران ({toPersianDigits(state.users.length)})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pending_admin')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filterTab === 'pending_admin'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            در انتظار بررسی کارت ملی و لینک کد ({toPersianDigits(pendingCount)})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('approved')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filterTab === 'approved'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                : 'text-slate-400 hover:text-emerald-300'
            }`}
          >
            تأیید شده و متصل به کد پرسنلی (
            {toPersianDigits(state.users.filter((u) => u.verificationStatus === 'approved').length)})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('telegram')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filterTab === 'telegram'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40'
                : 'text-slate-400 hover:text-sky-300'
            }`}
          >
            کاربران تلگرام ({toPersianDigits(state.users.filter((u) => u.platform === 'telegram').length)})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('bale')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filterTab === 'bale'
                ? 'bg-teal-500/25 text-teal-200 border border-teal-500/40'
                : 'text-slate-400 hover:text-teal-300'
            }`}
          >
            کاربران بله ({toPersianDigits(state.users.filter((u) => u.platform === 'bale').length)})
          </button>
        </div>
      </div>

      {/* User Verification Cards / Rows */}
      <div className="space-y-3">
        {filteredUsers.map((user) => {
          const isPending = user.verificationStatus === 'pending_admin';
          const isApproved = user.verificationStatus === 'approved';
          const isHighlighted = highlightedUserId === user.id;
          const cardUrl =
            user.nationalCardImageUrl ||
            generateNationalCardSvgDataUrl(
              user.submittedName || 'در انتظار ارسال',
              user.nationalCode || '0010000000'
            );
          const currentCodeValue = getSuggestedCode(user);

          return (
            <div
              key={user.id}
              className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 transition-all ${
                isHighlighted
                  ? 'border-amber-400 shadow-[0_0_25px_-5px_rgba(245,158,11,0.35)]'
                  : isPending
                  ? 'border-amber-500/40'
                  : 'border-slate-800'
              }`}
            >
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-center">
                {/* Col 1: National ID Card Thumbnail (`تصویر کارت ملی ارسالی`) */}
                <div className="xl:col-span-3 flex flex-col gap-2">
                  <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-[16/10]">
                    <img
                      src={cardUrl}
                      alt={`کارت ملی ${user.submittedName}`}
                      referrerPolicy="no-referrer"
                      onClick={() => setPreviewCardUser(user)}
                      className="w-full h-full object-contain cursor-zoom-in group-hover:scale-[1.02] transition-transform"
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewCardUser(user)}
                      className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/85 text-cyan-300 text-[11px] font-medium border border-cyan-500/30 flex items-center gap-1 cursor-pointer hover:bg-slate-900"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>بزرگنمایی کارت ملی</span>
                    </button>
                  </div>
                </div>

                {/* Col 2: Identity & Messenger Metadata (`نام، کد ملی، پیام‌رسان، آیدی عددی تلگرام/بله`) */}
                <div className="xl:col-span-4 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-white">
                      {user.submittedName || 'کاربر جدید (هنوز نام ارسال نکرده)'}
                    </h3>
                    <span className="text-slate-500" aria-hidden="true">
                      ·
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        user.platform === 'telegram' ? 'text-sky-400' : 'text-emerald-400'
                      }`}
                    >
                      پیام‌رسان {user.platform === 'telegram' ? 'تلگرام' : 'بله'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-400">شماره آیدی {user.platform === 'telegram' ? 'تلگرام' : 'بله'}: </span>
                      <strong className="font-mono text-cyan-300 tabular-nums">{user.messengerId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">نام کاربری: </span>
                      <strong className="font-mono text-slate-200">@{user.username}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">کد ملی ثبت‌شده: </span>
                      <strong className="font-mono text-slate-200 tabular-nums">
                        {user.nationalCode ? toPersianDigits(user.nationalCode) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">عضویت کانال اجباری: </span>
                      <strong className={user.isChannelMember ? 'text-emerald-400' : 'text-amber-400'}>
                        {user.isChannelMember ? 'عضو شده ✅' : 'عضو نشده ⚠️'}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs pt-1">
                    {isApproved ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" />
                        <span>
                          احراز هویت تأیید شده · متصل به کد پرسنلی {toPersianDigits(user.personnelCode)} ({user.department})
                        </span>
                      </span>
                    ) : isPending ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-4 h-4" />
                        <span>منتظر بررسی کارت ملی توسط ادمین و اتصال به کد پرسنلی</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">
                        وضعیت: در مرحله عضویت کانال / ارسال تصویر کارت ملی در ربات
                      </span>
                    )}
                  </div>
                </div>

                {/* Col 3: Personnel Code Linking & Active/Inactive Controls (`لینک کردن به کد پرسنلی خاص + فعال/غیرفعال`) */}
                <div className="xl:col-span-5 bg-slate-950/80 border border-slate-800/90 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                      <Link2 className="w-4 h-4 text-cyan-400" />
                      <span>اتصال حساب پیام‌رسان به کد پرسنلی اختصاصی:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenUserInBot(user.id)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                    >
                      مشاهده چت در ربات
                    </button>
                  </div>

                  {/* Select or Type Personnel Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        انتخاب از لیست پرسنل سازمان:
                      </label>
                      <select
                        value={currentCodeValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedCodes((prev) => ({ ...prev, [user.id]: val }));
                          const found = state.personnelDirectory.find((p) => p.personnelCode === val);
                          if (found) {
                            setSelectedDepts((prev) => ({ ...prev, [user.id]: found.department }));
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        {state.personnelDirectory.map((p) => (
                          <option key={p.personnelCode} value={p.personnelCode}>
                            کد {toPersianDigits(p.personnelCode)} — {p.fullName} ({p.department})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        یا درج دستی کد پرسنلی خاص:
                      </label>
                      <input
                        type="text"
                        value={currentCodeValue}
                        onChange={(e) =>
                          setSelectedCodes((prev) => ({ ...prev, [user.id]: e.target.value }))
                        }
                        placeholder="مثال: 1004"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Action Buttons (Glassmorphic Colored Buttons) */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isApproved || editingCodeUserId === user.id ? (
                        <>
                          <GlassButton
                            variant="emerald"
                            size="sm"
                            onClick={() => handleApproveAndLink(user)}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>
                              تأیید و لینک به کد {toPersianDigits(currentCodeValue)}
                            </span>
                          </GlassButton>
                          <GlassButton
                            variant="rose"
                            size="sm"
                            onClick={() => setRejectingUser(user)}
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>رد مدارک</span>
                          </GlassButton>
                        </>
                      ) : (
                        <GlassButton
                          variant="cyan"
                          size="sm"
                          onClick={() =>
                            onUpdateUserCode({
                              userId: user.id,
                              personnelCode: currentCodeValue,
                              department: selectedDepts[user.id] || user.department,
                            })
                          }
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            بروزرسانی کد پرسنلی ({toPersianDigits(currentCodeValue)})
                          </span>
                        </GlassButton>
                      )}
                    </div>

                    {/* Activate / Deactivate Toggle Button (`فعال و غیرفعال کردن کاربر`) */}
                    <GlassButton
                      variant={user.isActive ? 'amber' : 'teal'}
                      size="sm"
                      onClick={() => onToggleUserActive(user.id, !user.isActive)}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>
                        {user.isActive ? 'غیرفعال کردن کاربر' : 'فعال‌سازی مجدد کاربر'}
                      </span>
                    </GlassButton>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Zoomed National ID Card */}
      {previewCardUser && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewCardUser(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white">
                  بررسی تصویر کارت ملی — {previewCardUser.submittedName}
                </h4>
                <p className="text-xs text-slate-400">
                  پیام‌رسان: {previewCardUser.platform === 'telegram' ? 'تلگرام' : 'بله'} · آیدی عددی:{' '}
                  {previewCardUser.messengerId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCardUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              src={
                previewCardUser.nationalCardImageUrl ||
                generateNationalCardSvgDataUrl(
                  previewCardUser.submittedName || 'پرسنل',
                  previewCardUser.nationalCode || '0010000000'
                )
              }
              alt="تصویر کارت ملی"
              referrerPolicy="no-referrer"
              className="w-full h-auto rounded-xl border border-slate-700"
            />

            <div className="flex items-center justify-end gap-2">
              <GlassButton
                variant="emerald"
                size="md"
                onClick={() => {
                  const u = previewCardUser;
                  setPreviewCardUser(null);
                  handleApproveAndLink(u);
                }}
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  تأیید کارت ملی و اتصال به کد پرسنلی {toPersianDigits(getSuggestedCode(previewCardUser))}
                </span>
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject User Reason */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white">
                رد درخواست احراز هویت ({rejectingUser.submittedName})
              </h4>
              <button
                type="button"
                onClick={() => setRejectingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  علت رد درخواست (برای کاربر در ربات ارسال می‌شود):
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <GlassButton
                  variant="sky"
                  size="sm"
                  onClick={() => setRejectingUser(null)}
                >
                  انصراف
                </GlassButton>
                <GlassButton type="submit" variant="rose" size="sm">
                  ثبت و ارسال پیام رد به کاربر
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
