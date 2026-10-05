/** Types shared between the server and the dashboard. */

export type Outcome =
  | "link_sent"
  | "retry_scheduled"
  | "callback_scheduled"
  | "dispute"
  | "cancellation_request"
  | "hardship"
  | "escalate_to_human"
  | "do_not_call"
  | "wrong_person"
  | "not_verified"
  | "refused"
  | "no_answer"
  | "no_resolution";

export type DisplayStatus =
  | "pending"
  | "in_call"
  | "recovered"
  | "awaiting_payment"
  | "retry_scheduled"
  | "callback"
  | "escalated"
  | "do_not_call"
  | "follow_up";

export interface PaymentLink {
  id: string;
  url: string;
  type: "pay_now" | "update_mandate";
  provider: "razorpay" | "mock";
  amount: number;
  status: "created" | "paid";
  createdAt: string;
  callId?: string;
}

export interface CustomerState {
  outcome?: Outcome;
  outcomeNote?: string;
  outcomeAt?: string;
  outcomeCallId?: string;
  paymentLink?: PaymentLink;
  retryDate?: string;
  callbackAt?: string;
  paid?: { at: string; amount: number; paymentId?: string; via: "razorpay" | "mock" };
  doNotCall?: boolean;
  callCount?: number;
}

export interface CallRecord {
  id: string;
  customerId: string;
  channel: "web" | "phone";
  status: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  durationSec?: number;
  cost?: number;
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
  analysis?: {
    outcome?: string;
    customer_reason?: string;
    sentiment?: string;
    follow_up_required?: boolean;
    compliance_flags?: string[];
  };
}

export interface ActivityEvent {
  ts: string;
  customerId: string;
  callId?: string;
  kind: "call" | "tool" | "payment" | "outcome" | "system";
  text: string;
}

export interface SimulatedSms {
  ts: string;
  customerId: string;
  to: string;
  body: string;
  url?: string;
}

export interface CustomerView {
  id: string;
  name: string;
  firstName: string;
  phoneMasked: string;
  language: "en" | "hi";
  merchant: string;
  category: string;
  plan: string;
  amount: number;
  mandate: { method: string; instrument: string; maxAmount?: number };
  failure: { code: string; label: string; explanation: string; failedOn: string; debitAttempts: number };
  latestRetryDate: string;
  scenario: string;
  tryLine: string;
  /** Year of birth, shown to the person role-playing. Checked server-side; never sent to the agent. */
  verifyAnswer: string;
  state: CustomerState;
  lastCall?: CallRecord;
  status: DisplayStatus;
}

export interface Snapshot {
  version: number;
  customers: CustomerView[];
  events: ActivityEvent[];
  sms: SimulatedSms[];
  setup: {
    webCalls: boolean;
    phoneCalls: boolean;
    destinationMasked?: string;
    payments: "razorpay-test" | "mock";
    storage: "redis" | "memory";
    webhookUrl: string;
    webhookReachable: boolean;
    callingHoursOpen: boolean;
    callingHoursEnforced: boolean;
    passcodeRequired: boolean;
  };
}
