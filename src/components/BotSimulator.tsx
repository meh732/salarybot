import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Crown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AppStateResponse,
  BotButton,
  BotMessage,
  BotUser,
  PayslipItem,
  PERSIAN_MONTHS,
  PlatformType,
} from '../types/payroll';
import {
  downloadPayslipImage,
  downloadPayslipPdf,
  formatRial,
  generateNationalCardSvgDataUrl,
  generatePayslipSvgDataUrl,
  parseExcelPayrollFile,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/payslipGenerator';
import { GlassButton } from './GlassButton';

interface BotSimulatorProps {
  state: AppStateResponse;
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  onBotInteract: (params: {
    userId: string;
    actionType: 'command' | 'callback' | 'text' | 'national_card_upload' | 'join_channel';
    payload?: string;
    nationalCardImageUrl?: string;
    submittedName?: string;
    nationalCode?: string;
  }) => Promise<void>;
  onAdminUploadInChat?: (params: {
    adminUserId: string;
    items: Omit<PayslipItem, 'id' | 'createdAt'>[];
    fileName: string;
  }) => Promise<void>;
  onCreateSimUser: (platform: PlatformType) => Promise<void>;
  onJumpToAdminVerify?: (userId: string) => void;
  isBusy?: boolean;
}

export const BotSimulator: React.FC<BotSimulatorProps> = ({
  state,
  selectedUserId,
  onSelectUser,
  onBotInteract,
  onAdminUploadInChat,
  onCreateSimUser,
  onJumpToAdminVerify,
  isBusy = false,
}) => {
  const activeUser: BotUser | undefined =
    state.users.find((u) => u.id === selectedUserId) || state.users[0];

  const messages: BotMessage[] = activeUser
    ? state.messagesByUser[activeUser.id] || []
    : [];

  const [inputText, setInputText] = useState('');
  const [showMenuKeyboard, setShowMenuKeyboard] = useState(true);
  const [showCardModal, setShowCardModal] = useState(false);
  const [authFullName, setAuthFullName] = useState('');
  const [authNationalCode, setAuthNationalCode] = useState('');
  const [authCardPreview, setAuthCardPreview] = useState<string>('');
  const [zoomedPayslip, setZoomedPayslip] = useState<PayslipItem | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adminChatFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedUserId]);

  useEffect(() => {
    if (activeUser) {
      setAuthFullName(activeUser.submittedName || '');
      setAuthNationalCode(activeUser.nationalCode || '');
      setAuthCardPreview('');
    }
  }, [activeUser?.id]);

  if (!activeUser) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4 my-auto min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <MessageSquare className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">دیتابیس در وضعیت کاملاً خام (Clean State)</h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            هیچ کاربری در دیتابیس ثبت نشده است. برای تست گردش کار احراز هویت اولیه پرسنل یا شروع به عنوان ادمین کل، یکی از گزینه‌های زیر را انتخاب فرمایید:
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-center pt-2">
          {onCreateSimUser && (
            <button
              type="button"
              onClick={() => onCreateSimUser('telegram')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg transition-colors cursor-pointer"
            >
              ➕ ایجاد پرسنل جدید در شبیه‌ساز (تست احراز هویت و کارت ملی)
            </button>
          )}
        </div>
      </div>
    );
  }

  const isTelegram = activeUser.platform === 'telegram';
  const isUserAdmin =
    Boolean(activeUser.isAdmin) ||
    Boolean(state.config.adminMessengerIds?.includes(activeUser.messengerId));

  const botHandle = isTelegram
    ? state.config.telegramBotUsername
    : state.config.baleBotUsername;
  const channelHandle = isTelegram
    ? state.config.telegramChannelId
    : state.config.baleChannelId;

  const handleInlineButtonClick = async (btn: BotButton) => {
    if (btn.callbackData === 'open_card_uploader') {
      setShowCardModal(true);
      return;
    }
    if (btn.callbackData === 'open_admin_bot_file_picker') {
      adminChatFileInputRef.current?.click();
      await onBotInteract({
        userId: activeUser.id,
        actionType: 'callback',
        payload: 'open_admin_bot_file_picker',
      });
      return;
    }
    if (btn.callbackData === 'join_channel_now') {
      await onBotInteract({
        userId: activeUser.id,
        actionType: 'join_channel',
      });
      return;
    }
    if (btn.callbackData) {
      await onBotInteract({
        userId: activeUser.id,
        actionType: 'callback',
        payload: btn.callbackData,
      });
    }
  };

  const handleAdminChatFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAdminUploadInChat) return;

    const uploadYear = activeUser.adminSession?.uploadYear || 1404;
    const uploadMonth = activeUser.adminSession?.uploadMonth || 9;
    const monthObj = PERSIAN_MONTHS.find((m) => m.number === uploadMonth) || PERSIAN_MONTHS[8];

    try {
      if (
        file.name.toLowerCase().endsWith('.xlsx') ||
        file.name.toLowerCase().endsWith('.xls') ||
        file.name.toLowerCase().endsWith('.csv')
      ) {
        const parsedItems = await parseExcelPayrollFile(file, uploadYear, uploadMonth);
        await onAdminUploadInChat({
          adminUserId: activeUser.id,
          items: parsedItems,
          fileName: file.name,
        });
      } else {
        // PDF or Image payslip uploaded directly inside bot chat
        const codeMatch = toEnglishDigits(file.name).match(/\b(10\d{2}|\d{3,6})\b/);
        const detectedCode = codeMatch ? codeMatch[1] : (activeUser.adminSession?.targetPersonnelCode || '1001');
        const person = state.personnelDirectory.find((p) => p.personnelCode === detectedCode);
        const personCode = person?.personnelCode || detectedCode;
        const employeeName = person?.fullName || `پرسنل کد ${detectedCode}`;
        const nationalCode = person?.nationalCode || '0010000000';
        const department = person?.department || 'عمومی';
        const jobTitle = person?.jobTitle || 'کارشناس';
        const bankAccount = person?.bankAccount || 'IR420170000000109283746501';

        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const isPdf = file.name.toLowerCase().endsWith('.pdf');
          const singleItem: Omit<PayslipItem, 'id' | 'createdAt'> = {
            personnelCode: personCode,
            employeeName,
            nationalCode,
            department,
            jobTitle,
            bankAccount,
            year: uploadYear,
            month: uploadMonth,
            monthName: monthObj.name,
            workingDays: 30,
            overtimeHours: 22,
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
            customPdfFileName: isPdf ? file.name : undefined,
            customImageUrl: !isPdf ? dataUrl : undefined,
          };

          await onAdminUploadInChat({
            adminUserId: activeUser.id,
            items: [singleItem],
            fileName: file.name,
          });
        };
        reader.readAsDataURL(file);
      }
    } finally {
      e.target.value = '';
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isBusy) return;
    const text = inputText.trim();
    setInputText('');
    await onBotInteract({
      userId: activeUser.id,
      actionType: text.startsWith('/') ? 'command' : 'text',
      payload: text,
    });
  };

  const handleCustomCardFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAuthCardPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitVerificationCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = authFullName.trim() || 'پرسنل جدید';
    const cleanNational = authNationalCode.trim() || '0014829103';
    const cardUrl =
      authCardPreview ||
      generateNationalCardSvgDataUrl(cleanName, cleanNational, '۱۳۷۰/۰۶/۲۱', 'محمد');

    setShowCardModal(false);
    await onBotInteract({
      userId: activeUser.id,
      actionType: 'national_card_upload',
      submittedName: cleanName,
      nationalCode: cleanNational,
      nationalCardImageUrl: cardUrl,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Hidden File Input for Admin In-Bot Excel/PDF Upload */}
      <input
        ref={adminChatFileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf,image/*"
        onChange={handleAdminChatFileSelected}
        className="hidden"
      />

      {/* Top Account Switcher Bar */}
      <div className="bg-slate-950/90 border-b border-slate-800 p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-slate-200">
              محیط زنده ربات تلگرام و بله (شامل پنل مدیریت کامل درون خود بات)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <GlassButton
              variant="amber"
              size="sm"
              onClick={() => {
                onSelectUser('usr-admin-master');
                onBotInteract({
                  userId: 'usr-admin-master',
                  actionType: 'callback',
                  payload: 'adm_panel',
                });
              }}
              disabled={isBusy}
              title="ورود به اکانت ادمین در داخل خود بات بدون نیاز به پنل وب"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>پنل ادمین داخل بات</span>
            </GlassButton>
            <GlassButton
              variant="cyan"
              size="sm"
              onClick={() => onCreateSimUser('telegram')}
              disabled={isBusy}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>پرسنل جدید تلگرام</span>
            </GlassButton>
            <GlassButton
              variant="emerald"
              size="sm"
              onClick={() => onCreateSimUser('bale')}
              disabled={isBusy}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>پرسنل جدید بله</span>
            </GlassButton>
          </div>
        </div>

        {/* User Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {state.users.map((u) => {
            const isSelected = u.id === activeUser.id;
            const pLabel = u.platform === 'telegram' ? 'تلگرام' : 'بله';
            const statusText = u.isAdmin
              ? 'ادمین کل در بات'
              : !u.isActive
              ? 'غیرفعال'
              : u.verificationStatus === 'approved'
              ? `کد ${toPersianDigits(u.personnelCode)}`
              : u.verificationStatus === 'pending_admin'
              ? 'منتظر تأیید'
              : 'احراز نشده';

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUser(u.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
                  isSelected
                    ? u.isAdmin
                      ? 'bg-amber-500/25 border-amber-400/70 text-amber-100 shadow-sm'
                      : u.platform === 'telegram'
                      ? 'bg-sky-500/25 border-sky-400/60 text-sky-100 shadow-sm'
                      : 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                <span>{u.submittedName || `کاربر جدید (${u.username})`}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span className="opacity-85">{pLabel}</span>
                <span className="mx-1.5 opacity-50">·</span>
                <span className="tabular-nums font-mono text-[11px]">{statusText}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messenger Bot Header (Telegram / Bale themed) */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${
          activeUser.isAdmin
            ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border-amber-500/30'
            : isTelegram
            ? 'bg-gradient-to-r from-sky-950/90 via-slate-900 to-indigo-950/80 border-sky-500/25'
            : 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/80 border-emerald-500/25'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
              activeUser.isAdmin
                ? 'bg-amber-500/25 border-amber-400/50 text-amber-200'
                : isTelegram
                ? 'bg-sky-500/25 border-sky-400/40 text-sky-200'
                : 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200'
            }`}
          >
            {activeUser.isAdmin ? <Crown className="w-5 h-5" /> : isTelegram ? 'TG' : 'بله'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">
                ربات فیش حقوقی {state.config.organizationName}
              </h3>
              <span className="text-xs text-slate-400 font-mono truncate">{botHandle}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5 flex-wrap">
              <span>
                اکانت فعلی: <strong className="text-white">{activeUser.submittedName || 'کاربر جدید'}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-mono">
                ID {isTelegram ? 'تلگرام' : 'بله'}: {activeUser.messengerId}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isUserAdmin && (
            <GlassButton
              variant="amber"
              size="sm"
              onClick={() =>
                onBotInteract({
                  userId: activeUser.id,
                  actionType: 'callback',
                  payload: 'adm_panel',
                })
              }
              disabled={isBusy}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>منوی ادمین در بات (/admin)</span>
            </GlassButton>
          )}
          <GlassButton
            variant={isTelegram ? 'cyan' : 'emerald'}
            size="sm"
            onClick={() =>
              onBotInteract({
                userId: activeUser.id,
                actionType: 'command',
                payload: '/start',
              })
            }
            disabled={isBusy}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
            <span>/start</span>
          </GlassButton>
        </div>
      </div>

      {/* Security & Status Strip inside Bot */}
      <div className="bg-slate-950/75 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between gap-2 text-xs text-slate-300 flex-wrap">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            کانال اجباری ({channelHandle}):{' '}
            <strong className={activeUser.isChannelMember ? 'text-emerald-400' : 'text-amber-400'}>
              {activeUser.isChannelMember ? 'عضو شده' : 'عضو نشده'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            نقش در بات:{' '}
            <strong className={isUserAdmin ? 'text-amber-300' : 'text-emerald-400'}>
              {isUserAdmin
                ? '👑 ادمین کل (دسترسی کامل مدیریت از داخل چت ربات)'
                : activeUser.verificationStatus === 'approved'
                ? `پرسنل تأیید شده (کد ${toPersianDigits(activeUser.personnelCode)})`
                : 'کاربر در حال احراز هویت'}
            </strong>
          </span>
        </div>

        {isUserAdmin ? (
          <button
            type="button"
            onClick={() => adminChatFileInputRef.current?.click()}
            className="text-xs text-emerald-300 hover:text-emerald-200 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ارسال مستقیم فایل اکسل / PDF فیش در چت بات</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowCardModal(true)}
            className="text-xs text-cyan-300 hover:text-cyan-200 underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
          >
            ارسال / ویرایش نام و تصویر کارت ملی
          </button>
        )}
      </div>

      {/* Chat Messages Viewport */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{
          backgroundImage: isTelegram
            ? 'radial-gradient(circle at 20% 20%, rgba(14, 165, 233, 0.08) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 45%)'
            : 'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(20, 184, 166, 0.08) 0%, transparent 45%)',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isBroadcast = msg.sender === 'admin_broadcast';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 border transition-all ${
                  isUser
                    ? isTelegram
                      ? 'bg-sky-600/25 border-sky-400/35 text-slate-100 rounded-tr-xs'
                      : 'bg-emerald-600/25 border-emerald-400/35 text-slate-100 rounded-tr-xs'
                    : isBroadcast
                    ? 'bg-gradient-to-br from-violet-950/90 via-slate-900 to-indigo-950/90 border-violet-400/40 text-slate-100 rounded-tl-xs shadow-lg'
                    : 'bg-slate-800/90 border-slate-700/80 text-slate-100 rounded-tl-xs shadow-md'
                }`}
              >
                {/* Attachment: National ID Card Image */}
                {msg.attachment?.type === 'national_card' && msg.attachment.imageUrl && (
                  <div className="mb-3 rounded-xl overflow-hidden border border-slate-600/60 bg-slate-950">
                    <img
                      src={msg.attachment.imageUrl}
                      alt={msg.attachment.caption || 'تصویر کارت ملی پرسنل'}
                      referrerPolicy="no-referrer"
                      onClick={() => setZoomedImage(msg.attachment!.imageUrl!)}
                      className="w-full max-h-52 object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                    />
                    <div className="px-3 py-1.5 bg-slate-900/90 text-[11px] text-slate-300 flex items-center justify-between">
                      <span>🪪 {msg.attachment.caption || 'تصویر کارت ملی ارسالی'}</span>
                      <button
                        type="button"
                        onClick={() => setZoomedImage(msg.attachment!.imageUrl!)}
                        className="text-cyan-300 hover:underline cursor-pointer"
                      >
                        بزرگنمایی تصویر
                      </button>
                    </div>
                  </div>
                )}

                {/* Message Text */}
                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  {msg.text}
                </div>

                {/* Attachment: Payslip Image + PDF Bundle (`تصویر فیش حقوقی + فایل PDF`) */}
                {msg.attachment?.type === 'payslip_bundle' && msg.attachment.payslipData && (
                  <div className="mt-3.5 space-y-3 border-t border-slate-700/80 pt-3">
                    <div className="rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 shadow-inner">
                      <div className="px-3 py-2 bg-emerald-950/70 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <ImageIcon className="w-4 h-4 text-emerald-400" />
                          <span>
                            تصویر فیش حقوقی — {msg.attachment.payslipData.monthName}{' '}
                            {toPersianDigits(msg.attachment.payslipData.year)} (کد پرسنلی:{' '}
                            {toPersianDigits(msg.attachment.payslipData.personnelCode)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setZoomedPayslip(msg.attachment!.payslipData!)}
                          className="text-emerald-300 hover:text-white underline cursor-pointer text-[11px]"
                        >
                          مشاهده تمام‌صفحه
                        </button>
                      </div>
                      <img
                        src={generatePayslipSvgDataUrl(
                          msg.attachment.payslipData,
                          state.config.organizationName
                        )}
                        alt={`فیش حقوقی ${msg.attachment.payslipData.employeeName}`}
                        referrerPolicy="no-referrer"
                        onClick={() => setZoomedPayslip(msg.attachment!.payslipData!)}
                        className="w-full h-auto object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate font-mono">
                            {msg.attachment.pdfFileName ||
                              `Payslip-${msg.attachment.payslipData.personnelCode}-${msg.attachment.payslipData.year}-${msg.attachment.payslipData.month}.pdf`}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            فایل PDF رسمی فیش حقوقی · خالص:{' '}
                            <span className="text-emerald-300 font-semibold tabular-nums">
                              {formatRial(msg.attachment.payslipData.netPay)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <GlassButton
                          variant="emerald"
                          size="sm"
                          onClick={() =>
                            downloadPayslipImage(
                              msg.attachment!.payslipData!,
                              state.config.organizationName
                            )
                          }
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>دانلود عکس فیش</span>
                        </GlassButton>
                        <GlassButton
                          variant="rose"
                          size="sm"
                          onClick={() =>
                            downloadPayslipPdf(
                              msg.attachment!.payslipData!,
                              state.config.organizationName
                            )
                          }
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>دانلود PDF فیش</span>
                        </GlassButton>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-1.5 text-[10px] text-slate-400 text-left tabular-nums font-mono">
                  {msg.timestamp}
                </div>
              </div>

              {/* Glassmorphic Colored Inline Keyboard Buttons (`دکمه‌های شیشه‌ای با پس‌زمینه رنگی`) */}
              {msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                <div className="mt-2 w-full max-w-[92%] sm:max-w-[85%] space-y-1.5">
                  {msg.inlineKeyboard.map((row, rIdx) => (
                    <div
                      key={rIdx}
                      className="grid gap-1.5"
                      style={{
                        gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {row.map((btn, bIdx) => (
                        <GlassButton
                          key={bIdx}
                          variant={btn.colorVariant}
                          size="md"
                          fullWidth
                          disabled={isBusy}
                          onClick={() => handleInlineButtonClick(btn)}
                        >
                          <span className="truncate">{btn.text}</span>
                          {btn.url && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                        </GlassButton>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Persistent Square Reply Keyboard Grid (منوی مربع کیبورد زیر نوار چت در تلگرام و بله) */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
        {showMenuKeyboard && (
          <>
            <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between px-1">
              <span>⌨️ منوی مربع کیبورد پیوست زیر نوار چت (Reply Keyboard):</span>
              <span className="text-[10px] text-cyan-400 font-mono">
                {isUserAdmin ? 'کیبورد ویژه ادمین کل' : 'کیبورد پرسنلی'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
          {isUserAdmin ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '📄 دریافت فیش حقوقی',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-emerald-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                📄 دریافت فیش حقوقی
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '📊 آخرین فیش صادر شده',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-cyan-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                📊 آخرین فیش صادر شده
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '👑 پنل مدیریت (/admin)',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-200 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm col-span-2 sm:col-span-1"
              >
                👑 پنل مدیریت (/admin)
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '🪪 صف کارت ملی',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-amber-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm col-span-2 sm:col-span-1"
              >
                🪪 صف کارت ملی
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '📤 آپلود فیش',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-emerald-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                📤 آپلود فیش
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '💾 دریافت بکاپ دیتابیس',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-xs font-semibold text-teal-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                💾 دریافت بکاپ دیتابیس
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '👤 کد پرسنلی و اطلاعات من',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-indigo-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm col-span-2 sm:col-span-1"
              >
                👤 کد پرسنلی و اطلاعات من
              </button>
            </>
          ) : activeUser.verificationStatus === 'approved' && Boolean(activeUser.personnelCode) ? (
            <>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '📄 دریافت فیش حقوقی',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-emerald-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                📄 دریافت فیش حقوقی
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '📊 آخرین فیش صادر شده',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-cyan-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                📊 آخرین فیش صادر شده
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '👤 کد پرسنلی و اطلاعات من',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-indigo-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                👤 کد پرسنلی و اطلاعات من
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'text',
                    payload: '💬 پشتیبانی',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-violet-300 transition-all cursor-pointer text-center truncate active:scale-98 shadow-sm"
              >
                💬 پشتیبانی
              </button>
            </>
          ) : (
            <>
              {/* Strictly Gated: Unverified / Pending User Only Gets Verification & Support */}
              <button
                type="button"
                onClick={() => {
                  if (activeUser.verificationStatus === 'pending_admin') {
                    onBotInteract({
                      userId: activeUser.id,
                      actionType: 'callback',
                      payload: 'check_verification',
                    });
                  } else {
                    setShowCardModal(true);
                  }
                }}
                disabled={isBusy}
                className="py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition-all cursor-pointer text-center col-span-2 shadow-sm"
              >
                {activeUser.verificationStatus === 'pending_admin'
                  ? '⏳ استعلام وضعیت تأیید احراز هویت توسط مدیریت'
                  : '🪪 احراز هویت و ارسال کارت ملی (تنها گزینه فعال)'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'callback',
                    payload: 'menu_support',
                  })
                }
                disabled={isBusy}
                className="py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-slate-300 transition-all cursor-pointer text-center col-span-2"
              >
                💬 ارتباط با پشتیبانی و امور پرسنلی
              </button>
            </>
          )}
        </div>
          </>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {isUserAdmin && (
            <>
              <GlassButton
                variant="amber"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'callback',
                    payload: 'adm_panel',
                  })
                }
              >
                <Crown className="w-3.5 h-3.5" />
                <span>👑 پنل ادمین درون بات</span>
              </GlassButton>
              <GlassButton
                variant="emerald"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'callback',
                    payload: 'adm_queue',
                  })
                }
              >
                <span>🪪 بررسی کارت ملی در بات</span>
              </GlassButton>
              <GlassButton
                variant="cyan"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'callback',
                    payload: 'adm_upload_menu',
                  })
                }
              >
                <span>📤 آپلود اکسل/PDF در بات</span>
              </GlassButton>
              <GlassButton
                variant="violet"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'callback',
                    payload: 'adm_manage_admins',
                  })
                }
              >
                <span>👑 مدیریت ادمین‌ها در بات</span>
              </GlassButton>
            </>
          )}
          {!isUserAdmin && (
            <>
              {!state.config.adminClaimLocked && !(state.config.adminMessengerIds && state.config.adminMessengerIds.length > 0) && !state.users.some(u => u.isAdmin) && (
                <GlassButton
                  variant="amber"
                  size="sm"
                  disabled={isBusy}
                  onClick={() =>
                    onBotInteract({
                      userId: activeUser.id,
                      actionType: 'command',
                      payload: `/setadmin ${state.config.adminSecretCode || '123456'}`,
                    })
                  }
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>ثبت اولین ادمین (/setadmin)</span>
                </GlassButton>
              )}
              <GlassButton
                variant="cyan"
                size="sm"
                disabled={isBusy}
                onClick={() =>
                  onBotInteract({
                    userId: activeUser.id,
                    actionType: 'command',
                    payload: '/id',
                  })
                }
              >
                <span>آیدی عددی من (/id)</span>
              </GlassButton>
            </>
          )}
          <GlassButton
            variant="emerald"
            size="sm"
            disabled={isBusy}
            onClick={() =>
              onBotInteract({
                userId: activeUser.id,
                actionType: 'callback',
                payload: 'menu_payslips',
              })
            }
          >
            <span>📄 فیش حقوقی (انتخاب سال و ماه)</span>
          </GlassButton>
          <GlassButton
            variant="indigo"
            size="sm"
            disabled={isBusy}
            onClick={() =>
              onBotInteract({
                userId: activeUser.id,
                actionType: 'callback',
                payload: 'menu_profile',
              })
            }
          >
            <span>👤 کد پرسنلی من</span>
          </GlassButton>
        </div>

        {/* Command Menu Popup List (نمایش لیست دستورات مجاز مختص هر نقش) */}
        {inputText.startsWith('/') && (
          <div className="p-2 bg-slate-900 border border-slate-700 rounded-xl space-y-1 text-xs shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
              <span>دستورات مجاز در پیام‌رسان ({isUserAdmin ? 'دسترسی ادمین کل' : 'دسترسی پرسنل عادی'})</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setInputText('/start');
                onBotInteract({ userId: activeUser.id, actionType: 'command', payload: '/start' });
                setInputText('');
              }}
              className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between text-slate-200 cursor-pointer"
            >
              <span className="font-mono text-cyan-300 font-bold">/start</span>
              <span className="text-slate-400 text-[11px]">شروع ربات و مشاهده منوی اصلی</span>
            </button>
            {isUserAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setInputText('/admin');
                    onBotInteract({ userId: activeUser.id, actionType: 'command', payload: '/admin' });
                    setInputText('');
                  }}
                  className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between text-amber-200 cursor-pointer bg-amber-500/10"
                >
                  <span className="font-mono text-amber-300 font-bold">/admin</span>
                  <span className="text-amber-200 text-[11px]">پنل مدیریت کل درون ربات (مختص ادمین)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputText('/backup');
                    onBotInteract({ userId: activeUser.id, actionType: 'command', payload: '/backup' });
                    setInputText('');
                  }}
                  className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between text-teal-200 cursor-pointer"
                >
                  <span className="font-mono text-teal-300 font-bold">/backup</span>
                  <span className="text-slate-400 text-[11px]">دریافت فوری فایل بکاپ دیتابیس (.json)</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setInputText('/help');
                onBotInteract({ userId: activeUser.id, actionType: 'command', payload: '/help' });
                setInputText('');
              }}
              className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between text-slate-200 cursor-pointer"
            >
              <span className="font-mono text-violet-300 font-bold">/help</span>
              <span className="text-slate-400 text-[11px]">راهنما و ارتباط با پشتیبانی پرسنلی</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSendText} className="flex items-center gap-2">
          {/* Menu button ([::] / ☰) */}
          <button
            type="button"
            onClick={() => setShowMenuKeyboard((prev) => !prev)}
            title="نمایش یا بستن منوی دکمه‌های ربات"
            className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 flex items-center justify-center font-bold text-xs gap-1 ${
              showMenuKeyboard
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <span className="text-sm">⊞</span>
            <span className="text-[11px] hidden sm:inline">منو</span>
          </button>
          {isUserAdmin ? (
            <button
              type="button"
              onClick={() => adminChatFileInputRef.current?.click()}
              title="ارسال مستقیم فایل اکسل یا PDF فیش حقوقی در چت ربات"
              className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors cursor-pointer shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCardModal(true)}
              title="بارگذاری تصویر کارت ملی جهت احراز هویت"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isUserAdmin
                ? 'دستور (/admin یا /start)، کد پرسنلی، یا متن پیام گروهی را در چت بنویسید...'
                : 'ارسال دستور (/start) یا نوشتن نام و نام خانوادگی در ربات...'
            }
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <GlassButton
            type="submit"
            variant={isUserAdmin ? 'amber' : isTelegram ? 'cyan' : 'emerald'}
            size="md"
            disabled={isBusy || !inputText.trim()}
          >
            <Send className="w-4 h-4" />
            <span>ارسال</span>
          </GlassButton>
        </form>
      </div>

      {/* Modal: First-Time Identity Verification (Send Full Name + National ID Card Photo) */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white">
                  احراز هویت اولیه پرسنل (ارسال نام و تصویر کارت ملی)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  اطلاعات شما به همراه آیدی {isTelegram ? 'تلگرام' : 'بله'} ({activeUser.messengerId}) مستقیماً به چت ربات ادمین ارسال می‌شود.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitVerificationCard} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    نام و نام خانوادگی کامل پرسنل *
                  </label>
                  <input
                    type="text"
                    required
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    placeholder="مثال: رضا رضایی‌پور"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    شماره ملی (۱۰ رقمی) *
                  </label>
                  <input
                    type="text"
                    required
                    value={authNationalCode}
                    onChange={(e) => setAuthNationalCode(e.target.value)}
                    placeholder="مثال: 0491827364"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    تصویر کارت ملی هوشمند *
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    انتخاب فایل تصویر از دستگاه
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomCardFileChange}
                  className="hidden"
                />

                <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 p-2">
                  <img
                    src={
                      authCardPreview ||
                      generateNationalCardSvgDataUrl(
                        authFullName || 'نام پرسنل',
                        authNationalCode || '0014829103'
                      )
                    }
                    alt="پیش‌نمایش کارت ملی"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-48 object-contain rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <GlassButton
                  variant="rose"
                  size="md"
                  onClick={() => setShowCardModal(false)}
                >
                  انصراف
                </GlassButton>
                <GlassButton type="submit" variant="emerald" size="md">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ارسال نام و تصویر کارت ملی به ربات ادمین</span>
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Payslip Preview Modal */}
      {zoomedPayslip && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedPayslip(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white">
                  فیش حقوقی {zoomedPayslip.employeeName} — {zoomedPayslip.monthName}{' '}
                  {toPersianDigits(zoomedPayslip.year)}
                </h4>
                <p className="text-xs text-slate-400">
                  کد پرسنلی: {toPersianDigits(zoomedPayslip.personnelCode)} · واحد:{' '}
                  {zoomedPayslip.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedPayslip(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl p-2 border border-slate-800 overflow-hidden">
              <img
                src={generatePayslipSvgDataUrl(zoomedPayslip, state.config.organizationName)}
                alt="تصویر کامل فیش حقوقی"
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <GlassButton
                variant="emerald"
                size="md"
                onClick={() =>
                  downloadPayslipImage(zoomedPayslip, state.config.organizationName)
                }
              >
                <Download className="w-4 h-4" />
                <span>دانلود تصویر فیش (PNG)</span>
              </GlassButton>
              <GlassButton
                variant="rose"
                size="md"
                onClick={() =>
                  downloadPayslipPdf(zoomedPayslip, state.config.organizationName)
                }
              >
                <FileText className="w-4 h-4" />
                <span>دانلود فایل PDF فیش حقوقی</span>
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen National ID Card Preview Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">پیش‌نمایش تصویر کارت ملی پرسنل</span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={zoomedImage}
              alt="تصویر کارت ملی"
              referrerPolicy="no-referrer"
              className="w-full h-auto rounded-xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
