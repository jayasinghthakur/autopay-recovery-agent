/**
 * 10 FICTIONAL customer records. No real people, merchants, or phone numbers.
 *
 * - Phone numbers use the "+91 00000 0xxxx" pattern, which is not a valid Indian
 *   mobile number (those must start with 6-9), so they can never be dialled by accident.
 *   Outbound calls always go to the operator's own DEMO_DESTINATION_NUMBER instead.
 * - Emails use the reserved example.com domain.
 * - Dates are stored relative to "today" so the demo never goes stale.
 */

export type FailureCode =
  | "INSUFFICIENT_FUNDS"
  | "CARD_EXPIRED"
  | "MANDATE_REVOKED"
  | "MANDATE_LIMIT_EXCEEDED"
  | "BANK_TECHNICAL_DECLINE"
  | "MANDATE_PAUSED"
  | "ACCOUNT_CLOSED";

export type MandateMethod = "UPI Autopay" | "Card e-mandate" | "eNACH";

export interface CustomerRecord {
  id: string;
  name: string;
  firstName: string;
  phone: string; // fictional, never dialled
  email: string;
  yearOfBirth: number; // verification factor, checked server-side only
  language: "en" | "hi";
  merchant: string;
  category: string;
  plan: string;
  amount: number; // INR
  mandate: { method: MandateMethod; instrument: string; maxAmount?: number };
  failure: { code: FailureCode; failedDaysAgo: number; debitAttempts: number };
  graceDays: number; // days after the failed debit before service is paused
  demoHint: string; // suggested role-play for whoever answers the call
}

export const CUSTOMERS: CustomerRecord[] = [
  {
    id: "CUST-1001",
    name: "Aarav Sharma",
    firstName: "Aarav",
    phone: "+910000000001",
    email: "aarav.sharma@example.com",
    yearOfBirth: 1994,
    language: "en",
    merchant: "StreamBox",
    category: "OTT streaming",
    plan: "Premium monthly",
    amount: 649,
    mandate: { method: "UPI Autopay", instrument: "aa•••@okicici", maxAmount: 1000 },
    failure: { code: "INSUFFICIENT_FUNDS", failedDaysAgo: 2, debitAttempts: 1 },
    graceDays: 7,
    demoHint: "Cooperative. Says the account was low on payday-eve and wants to pay right now — ask for the link.",
  },
  {
    id: "CUST-1002",
    name: "Priya Nair",
    firstName: "Priya",
    phone: "+910000000002",
    email: "priya.nair@example.com",
    yearOfBirth: 1990,
    language: "en",
    merchant: "FitNest Gyms",
    category: "Fitness membership",
    plan: "Gold membership",
    amount: 2499,
    mandate: { method: "Card e-mandate", instrument: "Visa •••• 4821 (expired 09/26)" },
    failure: { code: "CARD_EXPIRED", failedDaysAgo: 1, debitAttempts: 1 },
    graceDays: 5,
    demoHint: "Got a new card last month and forgot to update it. Wants to set up autopay on the new card.",
  },
  {
    id: "CUST-1003",
    name: "Rohan Mehta",
    firstName: "Rohan",
    phone: "+910000000003",
    email: "rohan.mehta@example.com",
    yearOfBirth: 1987,
    language: "en",
    merchant: "LedgerLite",
    category: "Accounting SaaS",
    plan: "Business plan",
    amount: 1180,
    mandate: { method: "eNACH", instrument: "HDFC Bank a/c •••• 2290" },
    failure: { code: "BANK_TECHNICAL_DECLINE", failedDaysAgo: 1, debitAttempts: 1 },
    graceDays: 7,
    demoHint: "Slightly annoyed — 'I had money in the account!'. Happy to let the system retry tomorrow.",
  },
  {
    id: "CUST-1004",
    name: "Sneha Iyer",
    firstName: "Sneha",
    phone: "+910000000004",
    email: "sneha.iyer@example.com",
    yearOfBirth: 1992,
    language: "en",
    merchant: "SecureLife Insurance",
    category: "Term insurance premium",
    plan: "Term cover ₹1 crore, monthly premium",
    amount: 3850,
    mandate: { method: "UPI Autopay", instrument: "sn•••@okhdfcbank", maxAmount: 5000 },
    failure: { code: "MANDATE_REVOKED", failedDaysAgo: 4, debitAttempts: 1 },
    graceDays: 15,
    demoHint: "Revoked the mandate on purpose and wants to cancel the policy. The agent should not push.",
  },
  {
    id: "CUST-1005",
    name: "Vikram Singh",
    firstName: "Vikram",
    phone: "+910000000005",
    email: "vikram.singh@example.com",
    yearOfBirth: 1985,
    language: "en",
    merchant: "QuickCredit Finance",
    category: "Personal loan EMI",
    plan: "Personal loan EMI 7 of 24",
    amount: 8200,
    mandate: { method: "eNACH", instrument: "SBI a/c •••• 6612" },
    failure: { code: "INSUFFICIENT_FUNDS", failedDaysAgo: 3, debitAttempts: 2 },
    graceDays: 7,
    demoHint: "Salary is delayed by a few days. Asks to retry the debit in 3 days. (Alt: say you lost your job → hardship.)",
  },
  {
    id: "CUST-1006",
    name: "Ananya Gupta",
    firstName: "Ananya",
    phone: "+910000000006",
    email: "ananya.gupta@example.com",
    yearOfBirth: 2001,
    language: "en",
    merchant: "LearnSphere",
    category: "Online learning",
    plan: "Pro monthly",
    amount: 999,
    mandate: { method: "UPI Autopay", instrument: "an•••@ybl", maxAmount: 1500 },
    failure: { code: "MANDATE_PAUSED", failedDaysAgo: 2, debitAttempts: 1 },
    graceDays: 7,
    demoHint: "Busy right now. Asks for a callback this evening around 6 PM.",
  },
  {
    id: "CUST-1007",
    name: "Karthik Reddy",
    firstName: "Karthik",
    phone: "+910000000007",
    email: "karthik.reddy@example.com",
    yearOfBirth: 1989,
    language: "en",
    merchant: "Zipnet Fiber",
    category: "Broadband",
    plan: "300 Mbps unlimited (upgraded last month)",
    amount: 1299,
    mandate: { method: "UPI Autopay", instrument: "ka•••@oksbi", maxAmount: 1000 },
    failure: { code: "MANDATE_LIMIT_EXCEEDED", failedDaysAgo: 1, debitAttempts: 1 },
    graceDays: 5,
    demoHint: "Upgraded the plan last month. Confused why it failed; agrees to re-authorise autopay with a higher limit.",
  },
  {
    id: "CUST-1008",
    name: "Meera Joshi",
    firstName: "Meera",
    phone: "+910000000008",
    email: "meera.joshi@example.com",
    yearOfBirth: 1996,
    language: "en",
    merchant: "GreenBowl",
    category: "Meal-kit subscription",
    plan: "Family box monthly",
    amount: 1750,
    mandate: { method: "Card e-mandate", instrument: "Mastercard •••• 1006" },
    failure: { code: "BANK_TECHNICAL_DECLINE", failedDaysAgo: 3, debitAttempts: 1 },
    graceDays: 7,
    demoHint: "Insists the money WAS debited from her account. The agent should raise a dispute, not ask her to pay again.",
  },
  {
    id: "CUST-1009",
    name: "Arjun Kapoor",
    firstName: "Arjun",
    phone: "+910000000009",
    email: "arjun.kapoor@example.com",
    yearOfBirth: 1998,
    language: "en",
    merchant: "VaultBox",
    category: "Cloud storage",
    plan: "2 TB monthly",
    amount: 299,
    mandate: { method: "eNACH", instrument: "Axis Bank a/c •••• 7781 (closed)" },
    failure: { code: "ACCOUNT_CLOSED", failedDaysAgo: 5, debitAttempts: 2 },
    graceDays: 10,
    demoHint: "Irritated. Says 'stop calling me' — the agent must record do-not-call and end politely.",
  },
  {
    id: "CUST-1010",
    name: "Fatima Khan",
    firstName: "Fatima",
    phone: "+910000000010",
    email: "fatima.khan@example.com",
    yearOfBirth: 1979,
    language: "hi",
    merchant: "Dainik Digital",
    category: "News subscription",
    plan: "Digital edition monthly",
    amount: 450,
    mandate: { method: "UPI Autopay", instrument: "fa•••@paytm", maxAmount: 500 },
    failure: { code: "INSUFFICIENT_FUNDS", failedDaysAgo: 2, debitAttempts: 1 },
    graceDays: 7,
    demoHint: "Prefers Hindi / Hinglish. Agrees to pay via link.",
  },
];

export interface FailureInfo {
  label: string;
  /** Plain-language explanation the agent can say to the customer. */
  explanation: string;
  /** Can a plain re-debit on the existing mandate succeed? */
  retryable: boolean;
  /** Resolution paths that make sense for this failure, in order of preference. */
  actions: string[];
}

export const FAILURES: Record<FailureCode, FailureInfo> = {
  INSUFFICIENT_FUNDS: {
    label: "Insufficient funds",
    explanation: "the bank declined the auto-debit because the account balance was low on the debit date",
    retryable: true,
    actions: ["pay now via secure link", "schedule a retry of the auto-debit on a date when funds are available"],
  },
  CARD_EXPIRED: {
    label: "Card expired",
    explanation: "the card linked to the autopay has expired, so the debit could not go through",
    retryable: false,
    actions: ["send a link to pay this bill and re-authorise autopay on a new card"],
  },
  MANDATE_REVOKED: {
    label: "Mandate revoked",
    explanation: "the autopay mandate was cancelled from the customer's UPI app, so no debit was attempted on the bank side",
    retryable: false,
    actions: [
      "ask whether cancelling was intentional",
      "if they want to continue: send a link to pay and set up autopay again",
      "if they want to stop the service: record a cancellation request for the merchant team",
    ],
  },
  MANDATE_LIMIT_EXCEEDED: {
    label: "Above mandate limit",
    explanation: "the bill is higher than the maximum amount approved on the autopay mandate",
    retryable: false,
    actions: ["send a link to pay this bill and re-authorise autopay with a higher limit"],
  },
  BANK_TECHNICAL_DECLINE: {
    label: "Bank technical decline",
    explanation: "the bank's systems had a temporary technical issue during the debit — nothing was wrong on the customer's side",
    retryable: true,
    actions: ["schedule an automatic retry (usually the next day)", "or pay now via secure link"],
  },
  MANDATE_PAUSED: {
    label: "Mandate paused",
    explanation: "the autopay mandate is paused in the customer's UPI app",
    retryable: true,
    actions: [
      "ask them to resume the mandate in their UPI app, then schedule a retry",
      "or pay now via secure link",
    ],
  },
  ACCOUNT_CLOSED: {
    label: "Bank account closed",
    explanation: "the bank account linked to the autopay has been closed",
    retryable: false,
    actions: ["send a link to pay this bill and set up autopay on the new account"],
  },
};

export function findCustomer(id: string | undefined | null): CustomerRecord | undefined {
  if (!id) return undefined;
  const norm = id.trim().toUpperCase();
  return CUSTOMERS.find((c) => c.id === norm);
}
