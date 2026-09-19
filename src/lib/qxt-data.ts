export type Plan = {
  id: string;
  size: string;
  price: number;
  dailyLoss: string;
  type: "Instant" | "Challenge";
  target?: string;
  drawdown?: string;
  popular?: boolean;
};

export const instantPlans: Plan[] = [
  { id: "instant-3000", size: "$3,000", price: 70, dailyLoss: "$700", type: "Instant" },
  { id: "instant-5000", size: "$5,000", price: 116, dailyLoss: "$1,167", type: "Instant" },
  { id: "instant-8000", size: "$8,000", price: 186, dailyLoss: "$1,867", type: "Instant" },
  { id: "instant-11000", size: "$11,000", price: 256, dailyLoss: "$2,567", type: "Instant" },
  { id: "instant-15000", size: "$15,000", price: 349, dailyLoss: "$3,500", type: "Instant" },
  {
    id: "instant-20000",
    size: "$20,000",
    price: 466,
    dailyLoss: "$4,667",
    type: "Instant",
    popular: true,
  },
  { id: "instant-25000", size: "$25,000", price: 582, dailyLoss: "$5,833", type: "Instant" },
  { id: "instant-35000", size: "$35,000", price: 815, dailyLoss: "$8,167", type: "Instant" },
  { id: "instant-50000", size: "$50,000", price: 1165, dailyLoss: "$11,667", type: "Instant" },
];

export const challengePlans: Plan[] = [
  {
    id: "challenge-5000",
    size: "$5,000",
    price: 49,
    dailyLoss: "$250",
    type: "Challenge",
    target: "$500",
    drawdown: "$500",
  },
  {
    id: "challenge-10000",
    size: "$10,000",
    price: 89,
    dailyLoss: "$500",
    type: "Challenge",
    target: "$1,000",
    drawdown: "$1,000",
    popular: true,
  },
  {
    id: "challenge-25000",
    size: "$25,000",
    price: 179,
    dailyLoss: "$1,250",
    type: "Challenge",
    target: "$2,500",
    drawdown: "$2,500",
  },
  {
    id: "challenge-50000",
    size: "$50,000",
    price: 299,
    dailyLoss: "$2,500",
    type: "Challenge",
    target: "$5,000",
    drawdown: "$5,000",
  },
];

export const brokers = [
  {
    name: "Pocket Option",
    image: "/brokers/pocketoption.png",
    copy: "Fast execution, wide instrument range",
  },
  { name: "Quotex", image: "/brokers/quotex.png", copy: "Low-latency order routing" },
  { name: "Binomo", image: "/brokers/binomo.png", copy: "Clean charting, mobile-first" },
  {
    name: "Olymp Trade",
    image: "/brokers/olymptrade.png",
    copy: "Established platform, deep liquidity",
  },
  {
    name: "Tradowix",
    image: "/brokers/tradowix.jpg",
    copy: "Institutional grade speed, high reliability",
  },
];

export const reviews = [
  {
    quote: "Dashboard is clean and payouts are reliable. Best prop firm experience I’ve had.",
    initials: "AE",
    name: "Mohammed K.",
    country: "UAE",
  },
  {
    quote:
      "Passed my evaluation in two weeks and got funded. The 92% split is real, no hidden fees.",
    initials: "GB",
    name: "Sarah P.",
    country: "UK",
  },
  {
    quote:
      "Payments are fast and secure. Highly recommend QXT Funded for anyone serious about trading.",
    initials: "PK",
    name: "Ahmed L.",
    country: "Pakistan",
  },
  {
    quote:
      "Being able to track my drawdown and targets live made a real difference. Professional setup.",
    initials: "US",
    name: "James R.",
    country: "USA",
  },
];

export const faqs = [
  {
    q: "When I select an account, how do I receive my account confirmation?",
    a: "Once your payment is confirmed, your account credentials and platform access are sent to the email on file, typically within minutes. You can also track the status from your dashboard under Orders.",
    cat: "Accounts",
  },
  {
    q: "What are the rules and profit targets for Challenge accounts?",
    a: "Each Challenge account lists its profit target, daily loss limit, and maximum drawdown directly on the pricing card. You must reach the profit target without breaching either loss limit during the evaluation window.",
    cat: "Challenge",
  },
  {
    q: "How does the Daily Loss Limit function on Instant and Challenge tracks?",
    a: "The Daily Loss Limit resets every trading day at the platform’s server time. If your open and closed losses for the day reach that figure, trading is paused until the next reset.",
    cat: "Risk Rules",
  },
  {
    q: "Which brokers and trading environments are supported?",
    a: "Accounts currently run on Pocket Option, Quotex, Binomo, Olymp Trade, and Tradowix. You choose your broker when you select your account.",
    cat: "Brokers",
  },
  {
    q: "How and when do I get paid?",
    a: "Eligible funded traders can request a payout from the dashboard. Approved requests are processed on the recurring payout cycle shown on your account.",
    cat: "Payouts",
  },
  {
    q: "Can I upgrade my account size later?",
    a: "Yes. You can purchase a larger account at any time, and qualifying funded accounts may become eligible for scaling.",
    cat: "Accounts",
  },
];
