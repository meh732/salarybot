export type PlatformType = 'telegram' | 'bale';

export type VerificationStatus =
  | 'unverified'
  | 'awaiting_channel'
  | 'awaiting_name'
  | 'awaiting_national_code'
  | 'awaiting_photo'
  | 'pending_admin'
  | 'approved'
  | 'rejected';

export type GlassColorVariant =
  | 'emerald'
  | 'cyan'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'teal'
  | 'sky';

export interface BotButton {
  text: string;
  callbackData?: string;
  url?: string;
  colorVariant: GlassColorVariant;
}

export interface PayslipItem {
  id: string;
  personnelCode: string;
  employeeName: string;
  nationalCode: string;
  department: string;
  jobTitle: string;
  bankAccount: string;
  year: number;
  month: number; // 1..12
  monthName: string;
  workingDays: number;
  overtimeHours: number;
  baseSalary: number;
  housingAllowance: number;
  groceryAllowance: number;
  childAllowance: number;
  overtimePay: number;
  bonusPay: number;
  totalEarnings: number;
  insuranceDeduction: number;
  taxDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  netPay: number;
  sourceType: 'excel' | 'pdf_image';
  customImageUrl?: string;
  customPdfUrl?: string;
  customPdfFileName?: string;
  createdAt: string;
}

export interface BotMessage {
  id: string;
  userId: string;
  sender: 'bot' | 'user' | 'admin_broadcast';
  text: string;
  timestamp: string;
  inlineKeyboard?: BotButton[][];
  attachment?: {
    type: 'national_card' | 'payslip_bundle' | 'broadcast_banner';
    imageUrl?: string;
    pdfUrl?: string;
    pdfFileName?: string;
    payslipData?: PayslipItem;
    caption?: string;
  };
}

export type AdminBotFlowStep =
  | 'idle'
  | 'awaiting_custom_code_for_user'
  | 'awaiting_reject_reason_for_user'
  | 'awaiting_broadcast_text'
  | 'awaiting_tg_channel_id'
  | 'awaiting_bale_channel_id'
  | 'awaiting_org_name'
  | 'awaiting_new_admin_id'
  | 'awaiting_new_admin_secret'
  | 'awaiting_file_upload';

export interface AdminBotSession {
  step: AdminBotFlowStep;
  targetUserId?: string;
  targetPersonnelCode?: string;
  broadcastTargetFilter?: string;
  uploadYear?: number;
  uploadMonth?: number;
}

export interface BotUser {
  id: string;
  messengerId: string;
  username: string;
  platform: PlatformType;
  isAdmin?: boolean;
  adminSession?: AdminBotSession;
  submittedName: string;
  nationalCode: string;
  phoneNumber: string;
  nationalCardImageUrl: string;
  personnelCode: string | null;
  department: string;
  jobTitle: string;
  isChannelMember: boolean;
  verificationStatus: VerificationStatus;
  verificationStep?: 'idle' | 'awaiting_name' | 'awaiting_national_code' | 'awaiting_photo';
  rejectionReason?: string;
  isActive: boolean;
  selectedYear?: number;
  joinedAt: string;
  lastInteractionAt: string;
}

export interface PersonnelRecord {
  personnelCode: string;
  fullName: string;
  nationalCode: string;
  department: string;
  jobTitle: string;
  bankAccount: string;
  phoneNumber: string;
  isActive?: boolean;
}

export interface BotConfig {
  organizationName: string;
  adminMessengerIds?: string[];
  adminSecretCode?: string;
  adminClaimLocked?: boolean;
  telegramBotToken: string;
  telegramBotUsername: string;
  telegramChannelId: string;
  baleBotToken: string;
  baleBotUsername: string;
  baleChannelId: string;
  requireMandatoryChannel: boolean;
  requireNationalCardPhoto: boolean;
  welcomeMessage: string;
  channelPromptMessage: string;
  verificationApprovedMessage: string;
  supportContact: string;
  livePollingEnabled: boolean;
  autoBackupEnabled?: boolean;
  autoBackupIntervalHours?: number;
  lastBackupAt?: string;
}

export interface BroadcastLog {
  id: string;
  title: string;
  message: string;
  targetFilter: 'all_active' | 'telegram_only' | 'bale_only' | 'pending_verification' | string;
  buttonText?: string;
  buttonColor?: GlassColorVariant;
  sentCount: number;
  createdAt: string;
}

export interface AppStateResponse {
  config: BotConfig;
  users: BotUser[];
  personnelDirectory: PersonnelRecord[];
  payslips: PayslipItem[];
  messagesByUser: Record<string, BotMessage[]>;
  broadcastLogs: BroadcastLog[];
}

export const PERSIAN_MONTHS: { number: number; name: string; season: 'spring' | 'summer' | 'autumn' | 'winter' }[] = [
  { number: 1, name: 'فروردین', season: 'spring' },
  { number: 2, name: 'اردیبهشت', season: 'spring' },
  { number: 3, name: 'خرداد', season: 'spring' },
  { number: 4, name: 'تیر', season: 'summer' },
  { number: 5, name: 'مرداد', season: 'summer' },
  { number: 6, name: 'شهریور', season: 'summer' },
  { number: 7, name: 'مهر', season: 'autumn' },
  { number: 8, name: 'آبان', season: 'autumn' },
  { number: 9, name: 'آذر', season: 'autumn' },
  { number: 10, name: 'دی', season: 'winter' },
  { number: 11, name: 'بهمن', season: 'winter' },
  { number: 12, name: 'اسفند', season: 'winter' },
];
