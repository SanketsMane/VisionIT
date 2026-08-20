import { CouponDiscountType, CouponScope, PricingModel, ServiceCategory } from '@prisma/client';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * The studio's service catalog.
 *
 * Prices here are the **list** prices a visitor sees before any code is
 * entered. For VPS they mirror Hostinger's published rates exactly — verified
 * against hostinger.com/in/vps-hosting — with `compareAtPrice` carrying
 * Hostinger's own struck-through figure so the headline discount on each card
 * is theirs, not one we invented.
 *
 * The 20% advantage is a coupon applied on top (see `SEED_COUPONS`), which is
 * what keeps the standard rate honest when no code is in play.
 *
 * The 24-month rate is the one Hostinger publishes. Their 1- and 12-month
 * prices sit behind a checkout session and could not be read, so the shorter
 * terms use our own ladder: 12 months at +25% of the two-year rate, monthly at
 * the renewal rate. Every figure is editable in the UI.
 */

type SeedPrice = {
  termMonths: number;
  price: number;
  renewalPrice?: number;
  compareAtPrice?: number;
};

type SeedPlan = {
  name: string;
  slug: string;
  summary?: string;
  specs: { label: string; value: string }[];
  features?: string[];
  isPopular?: boolean;
  prices: SeedPrice[];
};

type SeedService = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ServiceCategory;
  pricingModel: PricingModel;
  icon: string;
  accentColor?: string;
  features: string[];
  deliverables?: string[];
  startingPrice?: number;
  priceSuffix?: string;
  isFeatured?: boolean;
  plans?: SeedPlan[];
};

/** Hostinger's published KVM rates: [24-month, renewal, was]. */
const VPS_TIERS = [
  { name: 'KVM 1', slug: 'kvm-1', vcpu: 1, ram: 4, disk: 50, bandwidth: 4, m24: 599, renewal: 999, was: 1649 },
  { name: 'KVM 2', slug: 'kvm-2', vcpu: 2, ram: 8, disk: 100, bandwidth: 8, m24: 799, renewal: 1199, was: 2099, popular: true },
  { name: 'KVM 4', slug: 'kvm-4', vcpu: 4, ram: 16, disk: 200, bandwidth: 16, m24: 1099, renewal: 2399, was: 3499 },
  { name: 'KVM 8', slug: 'kvm-8', vcpu: 8, ram: 32, disk: 400, bandwidth: 32, m24: 2199, renewal: 4399, was: 6199 },
];

const vpsPlan = (tier: (typeof VPS_TIERS)[number]): SeedPlan => ({
  name: tier.name,
  slug: tier.slug,
  isPopular: tier.popular ?? false,
  specs: [
    { label: 'vCPU', value: `${tier.vcpu} core${tier.vcpu > 1 ? 's' : ''}` },
    { label: 'RAM', value: `${tier.ram} GB` },
    { label: 'Disk', value: `${tier.disk} GB NVMe` },
    { label: 'Bandwidth', value: `${tier.bandwidth} TB` },
  ],
  features: [
    'AMD EPYC processors',
    'NVMe SSD storage',
    'Free weekly backups',
    'Full root access',
    'Dedicated IPv4 address',
    '24/7 support from us, not a queue',
  ],
  prices: [
    { termMonths: 24, price: tier.m24, renewalPrice: tier.renewal, compareAtPrice: tier.was },
    // +25% for halving the commitment.
    { termMonths: 12, price: Math.round(tier.m24 * 1.25), renewalPrice: tier.renewal, compareAtPrice: tier.was },
    // Month-to-month carries no introductory rate at all.
    { termMonths: 1, price: tier.renewal, renewalPrice: tier.renewal, compareAtPrice: tier.was },
  ],
});

export const SEED_SERVICES: SeedService[] = [
  {
    slug: 'web-development',
    name: 'Web Development',
    tagline: 'Fast, accessible web applications built to last',
    description:
      'Custom web applications and marketing sites — from a landing page to a full product with authentication, payments and an admin panel. Built on modern frameworks, deployed properly, and handed over with the source code.',
    category: ServiceCategory.WEB_DEVELOPMENT,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Globe',
    accentColor: '#0076FF',
    isFeatured: true,
    features: [
      'Next.js, React and TypeScript',
      'Responsive down to mobile, tested on real devices',
      'SEO groundwork and Core Web Vitals',
      'Admin panel and CMS where you need one',
      'Payments, authentication and third-party integrations',
    ],
    deliverables: ['Full source code', 'Deployment and documentation', '30-day bug-fix warranty'],
  },
  {
    slug: 'android-app-development',
    name: 'Android App Development',
    tagline: 'Native and cross-platform apps for the Play Store',
    description:
      'Android applications from first build to Play Store release — including the backend, push notifications, in-app payments and the release pipeline.',
    category: ServiceCategory.ANDROID_APP,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Smartphone',
    accentColor: '#3DDC84',
    isFeatured: true,
    features: [
      'React Native or native Kotlin',
      'Play Store submission handled for you',
      'Push notifications and deep links',
      'Offline-first where it matters',
      'Crash reporting and analytics wired in',
    ],
    deliverables: ['Signed release build', 'Play Store listing', 'Source code and keystore handover'],
  },
  {
    slug: 'ios-app-development',
    name: 'iOS App Development',
    tagline: 'Apps that feel at home on iPhone and iPad',
    description:
      'iOS applications built to Apple’s guidelines and taken through App Store review, with the same backend serving your Android build where that makes sense.',
    category: ServiceCategory.IOS_APP,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Apple',
    accentColor: '#111827',
    features: [
      'React Native or native Swift',
      'App Store submission and review handled',
      'Push notifications via APNs',
      'Sign in with Apple and in-app purchases',
      'TestFlight builds for your reviewers',
    ],
    deliverables: ['App Store release', 'Source code and certificates', 'TestFlight access'],
  },
  {
    slug: 'ai-software-development',
    name: 'AI Software Development',
    tagline: 'LLM features that do something useful',
    description:
      'AI built into your product where it earns its place — document understanding, assistants grounded in your own data, classification and automation. Costs measured, outputs validated, and a fallback when the model is wrong.',
    category: ServiceCategory.AI_SOFTWARE,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Sparkles',
    accentColor: '#8B5CF6',
    isFeatured: true,
    features: [
      'Retrieval over your own documents',
      'Assistants and chat interfaces',
      'Document extraction and classification',
      'Token and cost tracking per feature',
      'Guardrails, evaluation and human review',
    ],
    deliverables: ['Working feature in your product', 'Prompt and evaluation set', 'Cost model'],
  },
  {
    slug: 'fintech-platform-development',
    name: 'Fintech Platform Development',
    tagline: 'Wallets, ledgers and payouts that reconcile',
    description:
      'Financial products where the numbers have to be right: double-entry ledgers, wallet balances, payment gateway and UPI integration, settlement and reconciliation, and the audit trail a regulator or an accountant will ask for.',
    category: ServiceCategory.FINTECH_PLATFORM,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Landmark',
    accentColor: '#059669',
    isFeatured: true,
    features: [
      'Double-entry ledger with balanced postings',
      'Wallets, payouts and UPI withdrawals',
      'Payment gateway and settlement reconciliation',
      'KYC flows and role-based access',
      'Full audit trail on every money movement',
    ],
    deliverables: ['Platform and admin panel', 'Reconciliation reports', 'Security review notes'],
  },
  {
    slug: 'vps-hosting',
    name: 'VPS Hosting',
    tagline: 'AMD EPYC servers with NVMe storage, managed by us',
    description:
      'Virtual private servers with full root access, weekly backups and NVMe storage — set up, secured and monitored by the same people who built your application. Prices below are the standard rate; apply a coupon for the current offer.',
    category: ServiceCategory.VPS_HOSTING,
    pricingModel: PricingModel.TIERED,
    icon: 'Server',
    accentColor: '#0076FF',
    priceSuffix: '/mo',
    isFeatured: true,
    features: [
      'AMD EPYC processors and NVMe SSD',
      'Free weekly backups',
      'Full root access and dedicated IPv4',
      'We handle the setup, firewall and updates',
      '30-day money-back guarantee',
    ],
    plans: VPS_TIERS.map(vpsPlan),
  },
  {
    slug: 'windows-hosting',
    name: 'Windows VPS Hosting',
    tagline: 'Windows Server for .NET, MSSQL and desktop workloads',
    description:
      'Windows Server instances for applications that need it — .NET, MSSQL, or software that simply will not run anywhere else. Licensing is included in the monthly price. Tell us the workload and we will size it.',
    category: ServiceCategory.WINDOWS_HOSTING,
    pricingModel: PricingModel.FROM,
    icon: 'MonitorCog',
    accentColor: '#00A4EF',
    startingPrice: 1500,
    priceSuffix: '/mo',
    features: [
      'Windows Server licence included',
      'Remote Desktop access',
      'MSSQL and .NET ready',
      'Weekly backups',
      'Sized to your workload',
    ],
  },
  {
    slug: 'social-media-management',
    name: 'Social Media Management',
    tagline: 'Your channels, run properly',
    description:
      'Day-to-day management of your social channels — content calendar, design, scheduling, community replies and monthly reporting on what actually moved.',
    category: ServiceCategory.SOCIAL_MEDIA,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Share2',
    accentColor: '#EC4899',
    features: [
      'Content calendar and creative',
      'Scheduling across platforms',
      'Community management and replies',
      'Monthly performance reporting',
    ],
  },
  {
    slug: 'digital-marketing',
    name: 'Digital Marketing',
    tagline: 'Paid campaigns measured against revenue',
    description:
      'Paid acquisition across search and social, with tracking set up first so spend is judged on pipeline rather than impressions.',
    category: ServiceCategory.DIGITAL_MARKETING,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Megaphone',
    accentColor: '#F59E0B',
    features: [
      'Google and Meta campaigns',
      'Conversion tracking configured properly',
      'Landing pages built to convert',
      'Reporting tied to revenue, not clicks',
    ],
  },
  {
    slug: 'seo-optimization',
    name: 'SEO Optimization',
    tagline: 'Rank for the searches that bring buyers',
    description:
      'Technical SEO, content and links — starting with an audit that says plainly what is holding the site back and what it is worth fixing first.',
    category: ServiceCategory.SEO,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'TrendingUp',
    accentColor: '#10B981',
    features: [
      'Technical audit and fixes',
      'Keyword and competitor research',
      'On-page and content optimisation',
      'Local SEO and Google Business Profile',
      'Monthly ranking and traffic reporting',
    ],
  },
  {
    slug: 'lead-generation',
    name: 'Lead Generation',
    tagline: 'Qualified enquiries, not a list of names',
    description:
      'Outbound and inbound lead generation with qualification built in, so what reaches your inbox is worth answering.',
    category: ServiceCategory.LEAD_GENERATION,
    pricingModel: PricingModel.QUOTE_ONLY,
    icon: 'Target',
    accentColor: '#6366F1',
    features: [
      'Ideal customer profile and targeting',
      'Outreach sequences and follow-up',
      'Landing pages and lead magnets',
      'Qualification before it reaches you',
      'CRM handover',
    ],
  },
];

/** The launch offer: 20% off, applied on top of the list prices above. */
export const SEED_COUPONS = [
  {
    code: 'VISION20',
    description: '20% off any hosting plan',
    discountType: CouponDiscountType.PERCENT,
    discountValue: 20,
    scope: CouponScope.CATEGORY,
    categories: [ServiceCategory.VPS_HOSTING, ServiceCategory.WINDOWS_HOSTING],
    isActive: true,
  },
];

/**
 * Idempotent: matched on slug, so re-running updates the catalog in place
 * rather than duplicating it, and leaves anything the studio has since edited
 * by hand alone except for the fields defined here.
 */
export const seedServices = async (tx: PrismaClient | Prisma.TransactionClient, userId: string) => {
  let created = 0;
  let updated = 0;

  for (const [index, definition] of SEED_SERVICES.entries()) {
    const { plans, ...fields } = definition;
    const existing = await tx.service.findFirst({ where: { userId, slug: definition.slug } });

    const data = {
      ...fields,
      sortOrder: index,
      userId,
      startingPrice: fields.startingPrice ?? null,
    };

    const service = existing
      ? await tx.service.update({ where: { id: existing.id }, data })
      : await tx.service.create({ data });

    existing ? (updated += 1) : (created += 1);

    if (plans) {
      // Replaced wholesale so a renamed or dropped tier cannot linger.
      await tx.servicePlan.deleteMany({ where: { serviceId: service.id } });
      for (const [planIndex, plan] of plans.entries()) {
        await tx.servicePlan.create({
          data: {
            serviceId: service.id,
            name: plan.name,
            slug: plan.slug,
            summary: plan.summary ?? null,
            specs: plan.specs,
            features: plan.features ?? [],
            isPopular: plan.isPopular ?? false,
            sortOrder: planIndex,
            prices: {
              create: plan.prices.map((price) => ({
                termMonths: price.termMonths,
                price: price.price,
                renewalPrice: price.renewalPrice ?? null,
                compareAtPrice: price.compareAtPrice ?? null,
              })),
            },
          },
        });
      }
    }
  }

  for (const coupon of SEED_COUPONS) {
    const existing = await tx.coupon.findFirst({ where: { userId, code: coupon.code } });
    if (!existing) await tx.coupon.create({ data: { ...coupon, userId } });
  }

  return { created, updated, total: SEED_SERVICES.length };
};

export default seedServices;
