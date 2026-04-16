export type UserRole = 'Owner/Admin' | 'Staff' | 'Operations';

export type Tutorial = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  keyActions: string[];
  steps: string[];
  notes: string[];
  screenshot?: {
    src: string;
    alt: string;
  };
  roles: UserRole[];
  order: number;
  parentSlug?: string;
};

export const tutorials: Tutorial[] = [
  {
    slug: 'dashboard',
    title: 'Dashboard',
    description: 'Start every shift with a quick view of sales and operations health.',
    intro:
      'Dashboard gives you a fast operational snapshot so you can see today’s activity, key totals, and what needs attention before customers arrive.',
    keyActions: ['Check today’s sales summary', 'Review quick metrics', 'Identify tasks before opening'],
    steps: [
      'Open Dashboard at the beginning of the shift.',
      'Review key cards for sales, transactions, and trend indicators.',
      'Note anything unusual and assign action to the right team member.',
      'Return during the day for quick performance checks.'
    ],
    notes: ['Owners can monitor performance while staff can quickly orient before checkout starts.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/%20dashboard.png',
      alt: 'Sedifex dashboard screen showing operational summaries'
    },
    roles: ['Owner/Admin', 'Staff', 'Operations'],
    order: 1
  },
  {
    slug: 'items',
    title: 'Items',
    description: 'Manage inventory, pricing, and item details in one place.',
    intro:
      'Items is where your product catalog lives. Keep names, prices, stock, and categories accurate so checkout stays fast and error-free.',
    keyActions: ['Add new items', 'Update price and stock', 'Organize categories', 'Import in bulk via CSV'],
    steps: [
      'Go to Items and select Add Item for manual entry.',
      'Fill in item name, price, stock quantity, image, and category.',
      'Use CSV import when adding many items at once.',
      'For CSV, typical required fields are name and price.',
      'Typical optional fields are image_url and image_alt.'
    ],
    notes: ['The old Product tab is now renamed to Items.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/items%20Sedifex%20%E2%80%94%20Inventory%20%26%20POS.png',
      alt: 'Items page in Sedifex with inventory list'
    },
    roles: ['Owner/Admin', 'Operations'],
    order: 2
  },
  {
    slug: 'sell',
    title: 'Sell',
    description: 'Run day-to-day checkout quickly and accurately.',
    intro:
      'Sell is the main checkout flow for front-of-house staff. It is designed for speed while still capturing accurate totals, payment details, and receipts.',
    keyActions: ['Search and select items', 'Adjust quantities', 'Choose payment method', 'Complete sale and share receipt'],
    steps: [
      'Open Sell and search for items by name or code.',
      'Add items to cart and adjust quantity if needed.',
      'Confirm subtotal, taxes, discounts, and final total.',
      'Select the payment method and capture amount paid.',
      'Complete checkout and share receipt with the customer.'
    ],
    notes: ['Invoice is available under Sell for Owner/Admin role.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/sell.png',
      alt: 'Sell page checkout interface in Sedifex'
    },
    roles: ['Owner/Admin', 'Staff'],
    order: 3
  },
  {
    slug: 'receipts',
    title: 'Receipts',
    description: 'Provide proof of sale and build customer trust after checkout.',
    intro:
      'Receipts confirm what was sold and paid, which helps customer confidence and makes future support easier for your team.',
    keyActions: ['Generate receipt after sale', 'Resend from sales history', 'Use receipts as proof of sale'],
    steps: [
      'After checkout, generate the receipt from the completed sale.',
      'Review details: sale ID, date, payment method, customer, items, subtotal, VAT/tax, discount, total, amount paid, and change due.',
      'Share the receipt by the available channel.',
      'If customer did not receive it, validate contact details and resend from sales history.'
    ],
    notes: ['Accurate customer contact details improve delivery success.'],
    roles: ['Owner/Admin', 'Staff', 'Operations'],
    order: 4
  },
  {
    slug: 'close-day',
    title: 'Close Day',
    description: 'Reconcile expected and recorded sales at end of day.',
    intro:
      'Close Day helps you finalize the business day with confidence by comparing what should be recorded against what was actually collected.',
    keyActions: ['Confirm totals', 'Compare expected vs recorded sales', 'Log checks and handover notes'],
    steps: [
      'Open Close Day near end of operations.',
      'Review expected totals and compare against recorded transactions.',
      'Investigate mismatches before finalizing.',
      'Submit end-of-day checks and save reconciliation logs.'
    ],
    notes: ['Use this process daily to reduce accounting surprises.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/close%20day.png',
      alt: 'Close Day reconciliation view in Sedifex'
    },
    roles: ['Owner/Admin', 'Operations'],
    order: 5
  },
  {
    slug: 'invoice',
    title: 'Invoice',
    description: 'Create formal invoices and track payment status.',
    intro:
      'Invoice is used for formal billing workflows where you need branded PDF documents, detailed line items, and payment follow-up.',
    keyActions: ['Create invoice', 'Add customer and line items', 'Generate PDF', 'Track payment status'],
    steps: [
      'Navigate to Sell and open Invoice (Owner/Admin role).',
      'Enter customer details and invoice line items.',
      'Apply discounts and verify totals before saving.',
      'Generate branded invoice PDF and share with customer.',
      'Track payment status and update when paid.'
    ],
    notes: ['If you cannot find Invoice, check role access or open Sell first.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/Invoice.jpeg',
      alt: 'Invoice editor in Sedifex'
    },
    roles: ['Owner/Admin', 'Operations'],
    order: 6,
    parentSlug: 'sell'
  },
  {
    slug: 'customers',
    title: 'Customers',
    description: 'Maintain customer records and transaction context.',
    intro:
      'Customers helps you keep purchase history and contact data organized, making receipts, reminders, and promotions more reliable.',
    keyActions: ['Create and update customer profiles', 'Attach customer to transactions', 'Review history for follow-up'],
    steps: [
      'Add customers with accurate phone and email details.',
      'Attach customers during checkout when appropriate.',
      'Use purchase history to support follow-up and targeted communication.'
    ],
    notes: ['Clean records improve receipt delivery and repeat sales campaigns.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/Customers%20.jpeg',
      alt: 'Customers management view in Sedifex'
    },
    roles: ['Owner/Admin', 'Staff', 'Operations'],
    order: 7
  },
  {
    slug: 'bookings',
    title: 'Bookings',
    description: 'Organize appointments and service schedules.',
    intro:
      'Bookings is useful when your business supports scheduled services. Keep appointment status and customer details current to avoid missed service windows.',
    keyActions: ['Create booking', 'Update booking status', 'Capture accurate customer details'],
    steps: [
      'Create a booking with service date, time, and customer info.',
      'Update booking state as it moves from scheduled to completed.',
      'Review booking board daily for upcoming workload.'
    ],
    notes: ['Consistent status updates help teams coordinate handoffs.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/Booking.jpeg',
      alt: 'Bookings dashboard in Sedifex'
    },
    roles: ['Owner/Admin', 'Staff', 'Operations'],
    order: 8
  },
  {
    slug: 'social-media',
    title: 'Social Media',
    description: 'Control linked social content and visibility settings.',
    intro:
      'Social Media features help you manage connected links and embedded content that support brand visibility across customer touchpoints.',
    keyActions: ['Manage connected links', 'Configure embedded media', 'Set visibility controls'],
    steps: [
      'Open Social Media settings and review active channels.',
      'Add or update connected links and media settings.',
      'Confirm visibility controls match your current campaign goals.'
    ],
    notes: ['Use consistent branding and working links to avoid customer confusion.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/Social%20media.jpeg',
      alt: 'Social Media settings page in Sedifex'
    },
    roles: ['Owner/Admin', 'Operations'],
    order: 9
  },
  {
    slug: 'sms',
    title: 'SMS',
    description: 'Send customer updates, reminders, and promotions.',
    intro:
      'SMS is best for short, clear messages that prompt customer action. Segment audiences first to keep campaigns relevant and avoid duplicates.',
    keyActions: ['Segment recipients', 'Draft concise messages', 'Avoid duplicate campaigns'],
    steps: [
      'Choose the right segment before writing your message.',
      'Keep copy short, direct, and actionable.',
      'Schedule or send once and monitor for duplicate overlap.'
    ],
    notes: ['Good segmentation improves response rate and customer experience.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/SMS.jpeg',
      alt: 'SMS campaign tools in Sedifex'
    },
    roles: ['Owner/Admin', 'Operations'],
    order: 10
  },
  {
    slug: 'data',
    title: 'Data',
    description: 'Handle exports, imports, and backup workflows.',
    intro:
      'Data tools support reporting, migration, and continuity planning. Many teams run weekly exports to maintain clean backups.',
    keyActions: ['Export reports', 'Import/move datasets', 'Create routine backups'],
    steps: [
      'Choose the report or dataset you need to export.',
      'Run exports on a weekly schedule if required by your process.',
      'Validate imported data after transfer between systems.'
    ],
    notes: ['Keep backups in secure storage and maintain a regular cadence.'],
    roles: ['Owner/Admin', 'Operations'],
    order: 11
  },
  {
    slug: 'public-page',
    title: 'Public Page',
    description: 'Manage your customer-facing storefront and profile details.',
    intro:
      'Public Page controls what customers see about your business, including profile details, catalog visibility, and contact channels.',
    keyActions: ['Update storefront profile', 'Control product visibility', 'Publish contact and promo details'],
    steps: [
      'Review store profile details and update branding/contact info.',
      'Confirm product or catalog visibility settings.',
      'Publish updates and verify storefront accuracy.'
    ],
    notes: [
      'Verified stores may have eligible inventory automatically displayed on www.sedifexmarket.com, helping new buyers discover your products.'
    ],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/Public%20page.jpeg',
      alt: 'Public Page settings for Sedifex storefront'
    },
    roles: ['Owner/Admin', 'Operations'],
    order: 12
  },
  {
    slug: 'account',
    title: 'Account',
    description: 'Manage billing, security, and workspace settings.',
    intro:
      'Account settings centralize subscription, integrations, access control, and workspace-level configuration for your organization.',
    keyActions: ['Manage billing/subscription', 'Configure integrations and API settings', 'Update security and access policies'],
    steps: [
      'Review billing plan and subscription settings.',
      'Configure integrations or API options as needed.',
      'Audit user access, authentication settings, and workspace configuration.'
    ],
    notes: ['Revisit access permissions whenever team roles change.'],
    screenshot: {
      src: 'https://raw.githubusercontent.com/learngermanghana/sedifexbiz/main/photos/Account.jpeg',
      alt: 'Account settings section in Sedifex'
    },
    roles: ['Owner/Admin'],
    order: 13
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Quick fixes for common navigation and workflow issues.',
    intro:
      'Use this page when things are hard to find or not behaving as expected. Most issues are role access or saved settings.',
    keyActions: ['Resolve missing navigation', 'Fix receipt delivery issues', 'Correct storefront details'],
    steps: [
      'Cannot find Product tab: use Items; Product was renamed.',
      'Cannot find Invoice: open Sell first and confirm Owner/Admin role.',
      'Navigation looks different: check role-based permissions.',
      'Receipts not reaching customers: verify contact details and resend from sales history.',
      'Public storefront is wrong: update in Public Page and save/publish.'
    ],
    notes: ['If a problem continues, escalate with screenshot evidence and timestamps.'],
    roles: ['Owner/Admin', 'Staff', 'Operations'],
    order: 14
  }
];

export const sortedTutorials = tutorials.toSorted((a, b) => a.order - b.order);

export const getTutorialBySlug = (slug: string) => tutorials.find((tutorial) => tutorial.slug === slug);
