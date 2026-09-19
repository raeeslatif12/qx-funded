export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  updated: string;
  description: string;
  sections: LegalSection[];
};

export const legalDocuments = {
  terms: {
    title: "Terms & Agreement",
    updated: "August 1, 2026",
    description:
      "The terms governing QXT Funded accounts, evaluations, payments, and acceptable use.",
    sections: [
      {
        title: "1. Acceptance of Terms",
        paragraphs: [
          "By purchasing an account or otherwise using QXT Funded's services, you agree to be bound by these Terms & Agreement. If you do not agree, please do not use the service.",
        ],
      },
      {
        title: "2. Nature of the Service",
        paragraphs: [
          "QXT Funded offers simulated trading evaluations. Instant and Challenge accounts operate on demo trading environments provided through our broker partners. No client funds are placed into live markets during the evaluation phase. Traders who meet the applicable performance criteria become eligible for a funded account, at which point profit splits are paid from QXT Funded's own capital in accordance with the funded account agreement.",
        ],
      },
      {
        title: "3. Account Rules",
        paragraphs: [
          "Each account size lists its own profit target, daily loss limit, and maximum drawdown. Breaching any stated limit results in the account being closed. Rules are fixed at the time of purchase and displayed on the account's pricing page.",
        ],
      },
      {
        title: "4. Payments and Fees",
        paragraphs: [
          "Account fees are one-time charges due at checkout. Fees are non-refundable except as described in our Refund Policy.",
        ],
      },
      {
        title: "5. Prohibited Conduct",
        paragraphs: [
          "Use of automated exploits, latency arbitrage, account sharing, or coordinated trading across multiple accounts to circumvent risk limits is prohibited and may result in account termination without refund.",
        ],
      },
      {
        title: "6. Termination",
        paragraphs: [
          "QXT Funded may suspend or terminate any account found to be in violation of these Terms, the account rules, or applicable law.",
        ],
      },
      {
        title: "7. Limitation of Liability",
        paragraphs: [
          "QXT Funded is not liable for indirect, incidental, or consequential damages arising from use of the service, to the maximum extent permitted by law.",
        ],
      },
      {
        title: "8. Changes to Terms",
        paragraphs: [
          "We may update these Terms from time to time. Continued use of the service after changes take effect constitutes acceptance of the revised Terms.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Agreement & Terms Policy",
    updated: "August 14, 2026",
    description: "How QXT Funded collects, uses, protects, and retains trader information.",
    sections: [
      {
        title: "1. Information We Collect",
        paragraphs: [
          "We collect the information needed to create your account and deliver our trading evaluation service: your full legal name, authentic personal email address, country of residence, phone number, and payment transaction references required to process and verify your orders. We do not store private payment credentials or private blockchain keys on our systems.",
        ],
      },
      {
        title: "2. Mandatory Legal Email Address Requirement",
        paragraphs: [
          "All users must register using an authentic, verifiable, personal, or legal business email address, such as a genuine personal Gmail, Outlook, or Yahoo account.",
          "To maintain security, prevent unauthorized brand misrepresentation, and protect trader accounts, it is strictly prohibited to register or place orders using email addresses containing proprietary, deceptive, or impersonating terms.",
        ],
        bullets: [
          "qxtfunded or qxt-funded",
          "fundedaccount or funded-account",
          "quotexfunded or quotex-funded",
          "Any email prefix or username containing company names, support spoofing, or unauthorized brand references",
        ],
      },
      {
        title: "3. Refund Policy & Privacy Agreement Compliance",
        paragraphs: [
          "QXT Funded provides instant digital access to proprietary simulated trading evaluation accounts. Because resources, server infrastructure, and broker partner slots are provisioned immediately upon order placement, refunds are not provided for agreement violations, invalid or impersonating email submissions, or trading rule breaches.",
        ],
      },
      {
        title: "4. How We Use Your Information",
        paragraphs: [
          "Your information is used strictly to verify trader identity, deliver evaluation credentials, process profit payouts, respond to support requests, and send important service-related updates. We do not sell, rent, or trade your personal data to third parties for marketing purposes.",
        ],
      },
      {
        title: "5. Data Storage and Security",
        paragraphs: [
          "Account records, order history, and support communications are secured using industry-standard encrypted cloud infrastructure with SSL/TLS encryption in transit and at rest. Access to sensitive records is restricted to authorized compliance and administrative personnel.",
        ],
      },
      {
        title: "6. Payment & Blockchain Information",
        paragraphs: [
          "Where payments are made via cryptocurrency, transactions are recorded on public decentralized ledgers according to standard blockchain protocol. QXT Funded does not publish your personal identity or private account details on public ledgers.",
        ],
      },
      {
        title: "7. Cookies & Session Management",
        paragraphs: [
          "We use functional cookies and secure local session tokens to keep your session authenticated and safeguard your dashboard navigation. You may manage browser cookie settings at any time.",
        ],
      },
      {
        title: "8. User Rights & Account Compliance",
        paragraphs: [
          "Traders may request review of their stored profile details or request account closure, subject to statutory retention requirements for financial auditing and anti-fraud compliance.",
        ],
      },
      {
        title: "9. Changes to This Policy",
        paragraphs: [
          "QXT Funded reserves the right to amend this Privacy Agreement and Terms Policy at any time to reflect operational, regulatory, or security updates. Continued use of the platform constitutes acceptance of the revised policies.",
        ],
      },
    ],
  },
  refund: {
    title: "Refund Policy",
    updated: "August 14, 2026",
    description:
      "The limited circumstances in which QXT Funded account fees may be reviewed for refund.",
    sections: [
      {
        title: "1. General Policy & Compliance Requirement",
        paragraphs: [
          "Account evaluation fees for Instant and Challenge accounts are one-time service charges. Because access to the proprietary trading environment and broker provisioning is allocated immediately upon transaction submission, fees are strictly non-refundable once processed.",
          "We do not provide refunds if a user fails to adhere to our Privacy Agreement, Terms of Service, or Account Registration guidelines.",
        ],
      },
      {
        title: "2. Eligible Refund Cases",
        paragraphs: [
          "A refund review may only be considered under the following limited conditions:",
        ],
        bullets: [
          "The account credentials were never delivered due to an unresolved technical processing error on our server.",
          "You were inadvertently charged multiple times for the exact same order transaction.",
          "You submitted a formal cancellation request via support within 24 hours of payment before any trading login or market activity occurred on the evaluation account.",
        ],
      },
      {
        title: "3. Strictly Non-Refundable Situations",
        bullets: [
          "Use of prohibited, deceptive, fake, or brand-impersonating email addresses or falsified identification.",
          "Accounts terminated due to maximum drawdown breaches, daily loss limit violations, coordinated arbitrage, latency abuse, or sharing account credentials.",
          "Accounts where trading positions or demo market executions have already been placed.",
        ],
      },
      {
        title: "4. How to Request a Refund Review",
        paragraphs: [
          "To request a review for an eligible processing discrepancy, open a Billing support ticket from your QXT dashboard within the applicable 24-hour window, citing your Order Number and transaction hash. Our compliance department reviews requests within 2 business days.",
        ],
      },
      {
        title: "5. Processing Time",
        paragraphs: [
          "Approved discrepancy refunds are returned via the original payment method. Cryptocurrency settlements are completed within 3 to 5 business days.",
        ],
      },
    ],
  },
  risk: {
    title: "Risk Disclosure",
    updated: "August 1, 2026",
    description:
      "Important information about simulated evaluations, funded accounts, and trading risk.",
    sections: [
      {
        title: "1. Nature of Evaluation Accounts",
        paragraphs: [
          "Instant and Challenge accounts are simulated trading environments. The account sizes, balances, and price feeds shown during the evaluation phase are demo parameters used to measure trading performance against fixed rules. No client capital is placed into live markets during this phase.",
        ],
      },
      {
        title: "2. Nature of Funded Accounts",
        paragraphs: [
          "Traders who meet the profit target, daily loss limit, and drawdown requirements of their account become eligible for a funded account. Profit splits on funded accounts are real payments made from QXT Funded's own capital, in accordance with your funded account agreement — they are not paid out of other traders' evaluation fees.",
        ],
      },
      {
        title: "3. General Trading Risk",
        paragraphs: [
          "Trading financial instruments, including through the broker platforms made available to funded traders, carries risk. Past performance during an evaluation is not a guarantee of future results, and market conditions can change quickly.",
        ],
      },
      {
        title: "4. No Investment Advice",
        paragraphs: [
          "Nothing on this site or provided by our support team constitutes financial, investment, or trading advice. Decisions you make while trading, on evaluation or funded accounts, are your own.",
        ],
      },
      {
        title: "5. Suitability",
        paragraphs: [
          "Prop-firm evaluations are not suitable for everyone. You should only pay the account fee if you can afford the loss of that fee and understand that passing an evaluation is not guaranteed.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookies Policy",
    updated: "August 1, 2026",
    description: "How QXT Funded uses essential and analytics cookies and how you can manage them.",
    sections: [
      {
        title: "1. What Are Cookies",
        paragraphs: [
          "Cookies are small text files stored on your device that help websites remember information about your visit.",
        ],
      },
      {
        title: "2. How We Use Cookies",
        paragraphs: [
          "We use essential cookies to keep you signed in and to remember your preferences, such as the Instant or Challenge tab you last viewed. We use analytics cookies to understand how the site is used so we can improve it.",
        ],
      },
      {
        title: "3. Managing Cookies",
        paragraphs: [
          "Most browsers let you block or delete cookies through their settings. Blocking essential cookies may prevent you from staying signed in to your dashboard.",
        ],
      },
      {
        title: "4. Third-Party Cookies",
        paragraphs: [
          "Some analytics or payment providers we use may set their own cookies when you interact with their embedded tools on our site.",
        ],
      },
    ],
  },
} satisfies Record<string, LegalDocument>;
