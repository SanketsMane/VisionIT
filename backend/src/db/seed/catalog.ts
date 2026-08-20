import { PrismaClient, ProjectCategory } from '@prisma/client';

/**
 * The catalog: the studio's shipped work, as the website shows it.
 *
 * These are deliberately not derived from the `Project` table. A project row is
 * an engagement — it carries a client, a contract value and a delivery board.
 * A catalog entry is a public showcase piece, and several of them (the same app
 * on two stores, two products under one brand) do not map one-to-one onto an
 * engagement at all. Keeping the list here means the website can be curated
 * without touching client records.
 *
 * Every field below was read off the live product — the site, the Play listing
 * or the App Store listing — in August 2026. Two rules follow from that:
 *
 *   1. **Nothing is invented.** Where a product's own marketing makes a claim
 *      ("95% placement", "1000+ listings"), that is the client's claim about
 *      their business, not ours about our work, so it is not repeated here.
 *      What is described is what was built.
 *   2. **No client identity.** `clientLabel` and `testimonial` stay empty.
 *      Naming a client is a decision the studio makes per project, after
 *      asking them.
 *
 * Images live in `frontend/public/catalog/<slug>/` and are captured from the
 * running products, so the paths are stable and nothing depends on a third
 * party continuing to serve an image.
 */

export interface CatalogEntry {
  slug: string;
  /** "Name — what it is". The website splits on the dash for the card. */
  title: string;
  tagline: string;
  summary: string;
  category: ProjectCategory;
  industry: string;
  liveUrl: string | null;
  coverImage: string | null;
  gallery: string[];
  techStack: string[];
  highlights: string[];
  /** Only set where a store or the product itself states a date. */
  deliveredAt?: Date;
  isFeatured?: boolean;
  /** Entries with nothing verifiable to say stay off the website. */
  isPublished?: boolean;
}

const asset = (slug: string, file: string): string => `/catalog/${slug}/${file}`;

export const CATALOG: CatalogEntry[] = [
  // ── Featured. These three lead the homepage, so they are the ones that have
  //    to carry the argument: a SaaS platform, a real-time trading tool and a
  //    shipped mobile product. ────────────────────────────────────────────────
  {
    slug: 'collabuzz',
    title: 'Collabuzz — AI-powered influencer marketing platform',
    tagline: 'A two-sided platform where brands and creators find each other, run campaigns and get paid.',
    summary:
      'Collabuzz is an influencer marketing platform built for India’s creator economy. Brands discover creators whose audience actually matches the campaign, brief them, and track what the collaboration returned. Creators see verified brands, pitch for work, and get paid without chasing anyone.\n\nWe built the platform end to end: the matchmaking that scores a creator against a brief, the campaign workflow that carries a collaboration from pitch through deliverables to payout, the analytics both sides see, and the marketing site that sells it.\n\nThe same product ships as native apps on both stores — those are catalogued separately.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Creator economy',
    liveUrl: 'https://collabuzz.com/',
    coverImage: asset('collabuzz', 'cover.webp'),
    gallery: [asset('collabuzz', '01.webp'), asset('collabuzz', '02.webp'), asset('collabuzz', '03.webp')],
    techStack: ['Next.js', 'React', 'TypeScript'],
    highlights: [
      'AI matchmaking on content, audience and brand fit',
      'Campaign workflow from pitch to payout',
      'Real-time campaign analytics for both sides',
      'Verified brand and creator profiles',
      'Integrated payouts',
      'Companion apps on Android and iOS',
    ],
    isFeatured: true,
  },
  {
    slug: 'mbfx-trade-copier',
    title: 'MBFX Trade Copier — real-time trade copying for MT4 and MT5',
    tagline: 'One master account mirrors every position to ten slaves, with per-account risk control.',
    summary:
      'Money Bank FX needed every trade taken on one account to appear on the others the moment it opened — with different lot sizes, different brokers and different risk on each.\n\nThe copier runs master-to-slave copying for MT4 and MT5 with nothing to install: lot scaling by fixed size, multiplier or balance ratio, symbol mapping across broker suffixes, reverse mode that mirrors a position as its opposite, and stop-loss and take-profit changes carried across as they happen.\n\nEvery copy is streamed to a live log over WebSocket and written to an audit trail, so a disputed fill can be traced back to the tick that caused it.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Forex & trading',
    liveUrl: 'http://mbfx.visionitinfra.com/',
    coverImage: asset('mbfx-trade-copier', 'cover.webp'),
    gallery: [asset('mbfx-trade-copier', '01.webp')],
    techStack: ['React', 'Vite', 'TypeScript', 'MetaApi', 'CopyFactory', 'WebSocket'],
    highlights: [
      'One master fans out to up to ten slaves',
      'Lot scaling: fixed, multiplier or balance ratio',
      'Symbol mapping across broker suffixes',
      'Reverse copy mode',
      'Stop-loss and take-profit kept in sync',
      'Live copy log and full audit trail',
    ],
    isFeatured: true,
  },
  {
    slug: 'arthomed-clinic-android',
    title: 'Arthomed Clinic — clinic appointments on Android',
    tagline: 'Patients book and track visits; the clinic runs its day from the same app.',
    summary:
      'Arthomed puts both sides of a clinic visit in one Android app. Patients sign in with a mobile number, find a doctor by speciality, pick a free slot from the calendar and choose between an in-clinic appointment and an online consultation. Their upcoming, completed and cancelled visits stay in one list, with rescheduling in a tap.\n\nOn the other side, doctors and reception staff manage the same appointments, patient records and payments, so the schedule a patient sees is the schedule the front desk is working from.\n\nEverything moves over HTTPS, which matters when the payload is a medical record.',
    category: ProjectCategory.ANDROID_APP,
    industry: 'Healthcare',
    liveUrl: 'https://play.google.com/store/apps/details?id=com.arthomed.clinic',
    coverImage: asset('arthomed-clinic-android', 'cover.webp'),
    gallery: [
      asset('arthomed-clinic-android', '01.webp'),
      asset('arthomed-clinic-android', '02.webp'),
      asset('arthomed-clinic-android', '03.webp'),
      asset('arthomed-clinic-android', '04.webp'),
      asset('arthomed-clinic-android', '05.webp'),
      asset('arthomed-clinic-android', '06.webp'),
      asset('arthomed-clinic-android', '07.webp'),
    ],
    techStack: [],
    highlights: [
      'Mobile-number sign-in with OTP',
      'Doctors listed by speciality',
      'Slot-level appointment calendar',
      'In-clinic visits or online consultation',
      'Reschedule and cancel from the app',
      'Records and payments for clinic staff',
    ],
    isFeatured: true,
  },

  // ── Web platforms. ───────────────────────────────────────────────────────────
  {
    slug: 'makemypropertyz-materials',
    title: 'MakeMyPropertyz — construction material ordering platform',
    tagline: 'Cement, steel and finishing materials ordered from nearby stores and delivered to site.',
    summary:
      'A marketplace that puts building material procurement on the same footing as ordering anything else online. A builder picks from stores near the site, orders cement, steel, bricks, tiles, plumbing and electrical supplies, and tracks the delivery to the plot.\n\nThe platform runs four kinds of account, each with its own way in: customers, the stores fulfilling orders, delivery riders and internal staff — plus a customer-care chat sitting over all of them.\n\nThe customer-facing Android app is catalogued separately.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Construction & retail',
    liveUrl: 'https://makemypropertyz.in/',
    coverImage: asset('makemypropertyz-materials', 'cover.webp'),
    gallery: [asset('makemypropertyz-materials', '01.webp')],
    techStack: ['React', 'JavaScript'],
    highlights: [
      'Store-by-location catalog',
      'Separate logins for stores, delivery and staff',
      'Order tracking through to site delivery',
      'Built-in customer-care chat',
      'Progressive web app with an offline state',
    ],
  },
  {
    slug: 'makemypropertyz-realty',
    title: 'MakeMyPropertyz — property marketplace for Bengaluru',
    tagline: 'Search, shortlist and enquire on apartments, villas and plots across Bengaluru.',
    summary:
      'The property side of the MakeMyPropertyz brand: a listings site for buying, selling and renting across Bengaluru. Each listing carries its configuration, area, amenities and price, presented as a gallery you can move through rather than a table you have to read.\n\nWe built the search and filtering, the featured-property carousel, the agent-contact flow and the live chat, and cross-linked it to the material hub so a buyer who just closed on a property lands somewhere useful.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Real estate',
    liveUrl: 'https://makemypropertyz.com/',
    coverImage: asset('makemypropertyz-realty', 'cover.webp'),
    gallery: [
      asset('makemypropertyz-realty', '01.webp'),
      asset('makemypropertyz-realty', '02.webp'),
      asset('makemypropertyz-realty', '03.webp'),
    ],
    techStack: ['React', 'Vite', 'TypeScript'],
    highlights: [
      'Property search with configuration and area filters',
      'Featured listings carousel with amenities',
      'Instant agent contact by chat or call',
      'Cross-linked to the material ordering hub',
      'Structured data and metadata for search',
    ],
  },
  {
    slug: 'chirag-homes',
    title: 'ChiragHomes — furnished stays in Goa',
    tagline: 'Nightly, weekly and monthly rentals in North Goa, bookable without a phone call.',
    summary:
      'ChiragHomes lists furnished accommodation across Goa — single rooms through to beachside villas — with the nightly rate, the amenities and the check-in window on the card, so a guest can decide before they enquire.\n\nWe built the listing catalog, the rate card covering daily, weekly and monthly stays, the enquiry flow that hands off to a call or WhatsApp for instant confirmation, and an online payment prompt for the deposit.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Travel & hospitality',
    liveUrl: 'https://www.chiraghomes.in/',
    coverImage: asset('chirag-homes', 'cover.webp'),
    gallery: [
      asset('chirag-homes', '01.webp'),
      asset('chirag-homes', '02.webp'),
      asset('chirag-homes', '03.webp'),
    ],
    techStack: ['React', 'Vite', 'TypeScript'],
    highlights: [
      'Listings with rates, amenities and photos',
      'Daily, weekly and monthly rate card',
      'Check-in and check-out rules on the page',
      'Instant confirmation by call or WhatsApp',
      'Online payment for deposits',
    ],
  },
  {
    slug: 'parineetha',
    title: 'Parineetha — training institute site for Bengaluru',
    tagline: 'Courses, internships and placement, laid out so a prospective student can self-qualify.',
    summary:
      'A marketing site for a Bengaluru training institute teaching full-stack development, data science and AI. Every programme carries its level, duration, project count and the stack it covers, so someone browsing can work out which course is theirs before they fill in a form.\n\nWe built the course catalog, the internship and mentorship sections, the graduate stories, an FAQ, and the enquiry flow that feeds admissions — with structured data and per-page metadata throughout, because this site lives or dies on local search.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Education',
    liveUrl: 'https://parineetha.in/',
    coverImage: asset('parineetha', 'cover.webp'),
    gallery: [
      asset('parineetha', '01.webp'),
      asset('parineetha', '02.webp'),
      asset('parineetha', '03.webp'),
    ],
    techStack: ['Next.js', 'React', 'TypeScript'],
    highlights: [
      'Course catalog with level, duration and stack',
      'Internship and mentorship programmes',
      'Graduate stories and outcomes',
      'FAQ and enquiry flow into admissions',
      'Structured data and local-search metadata',
    ],
  },
  {
    slug: 'svm-dharwad-puc',
    title: 'SVM Dharwad — pre-university science college site',
    tagline: 'Programmes, facilities and admissions for a PU science college, in one place.',
    summary:
      'SVM Dharwad runs PCMB and PCMCS streams for students heading into NEET, JEE and KCET. The site sets out both combinations subject by subject, then covers the things parents actually ask about: the laboratories, the library, the computer lab, transport routes, hostel and cafeteria.\n\nWe built the programme pages, the facilities section, an admissions call-to-action that stays visible through the year, and an FAQ that answers the admission-process questions the office was fielding by phone. Bilingual metadata and local-business structured data help it rank for Dharwad.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Education',
    liveUrl: 'https://svmdharwadpuc.com/',
    coverImage: asset('svm-dharwad-puc', 'cover.webp'),
    gallery: [
      asset('svm-dharwad-puc', '01.webp'),
      asset('svm-dharwad-puc', '02.webp'),
      asset('svm-dharwad-puc', '03.webp'),
    ],
    techStack: ['Next.js', 'React', 'TypeScript'],
    highlights: [
      'PCMB and PCMCS programmes, subject by subject',
      'Laboratories, library, transport and hostel',
      'Admissions call-to-action and enquiry',
      'FAQ covering the admission process',
      'Local-business structured data, English and Kannada',
    ],
  },
  {
    slug: 'aura-properties',
    title: 'Aura Properties — coffee estate listings in Sakleshpur',
    tagline: 'Three plantation estates on NH-75, presented to be enquired about on WhatsApp.',
    summary:
      'Aura Properties sells coffee estate land in Sakleshpur, where the buyer is an investor and the enquiry almost always starts on WhatsApp.\n\nThe site is built around that: three estates — 22.20, 11.30 and 5.06 acres — each with its acreage and position on the highway, and a WhatsApp handoff never more than one tap away, plus click-to-call and the Bangalore office address for the buyers who want to walk in.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Real estate',
    liveUrl: 'https://auraproperties.in/',
    coverImage: asset('aura-properties', 'cover.webp'),
    gallery: [asset('aura-properties', '01.webp')],
    techStack: ['React', 'Vite', 'TypeScript'],
    highlights: [
      'Three estates with acreage and highway position',
      'WhatsApp enquiry from every section',
      'Click-to-call and office address',
      'Single-page build tuned for local search',
    ],
  },
  {
    slug: 'gastronaut-hospitality-erp',
    title: 'Gastronaut Hospitality — ERP for a hospitality group',
    tagline: 'People, processes and performance for a restaurant group, in one internal system.',
    summary:
      'A hosted ERP for Gastronaut Hospitality, running on the MOM Digital platform: the internal system a hospitality group works in day to day — staff, process and performance across the sites it operates, behind a single sign-in.\n\nEverything past that sign-in is a client’s operational data, so this entry shows the door rather than the rooms.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Hospitality',
    liveUrl: 'https://gastronauthospitality.momdigital.io/',
    coverImage: asset('gastronaut-hospitality-erp', 'cover.webp'),
    gallery: [],
    techStack: ['Laravel', 'PHP', 'MySQL', 'jQuery', 'Bootstrap', 'Nginx'],
    highlights: [
      'Hosted, per-tenant ERP deployment',
      'Single sign-in across the group’s sites',
      'Staff, process and performance modules',
      'Runs on managed Nginx hosting',
    ],
  },
  {
    slug: 'agenthro-hrms',
    title: 'AgentHRO — leave and work-from-home management',
    tagline: 'Requests, approvals and balances for a distributed team, without the spreadsheet.',
    summary:
      'A leave planner for a software team: staff raise leave and work-from-home requests, managers approve or decline them, and the balance updates without anyone maintaining a shared sheet.\n\nAccounts are created by an administrator rather than by self-service — this is an internal tool, and the sign-in page says so. Built as a Next.js application with light and dark themes and a thirty-day remembered session, so the daily "am I approved" check costs one tap.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'HR & internal tools',
    liveUrl: 'https://leave.agenthro.com/',
    coverImage: asset('agenthro-hrms', 'cover.webp'),
    gallery: [],
    techStack: ['Next.js', 'React', 'TypeScript'],
    highlights: [
      'Leave and work-from-home requests',
      'Manager approval flow',
      'Admin-provisioned accounts only',
      'Light and dark themes',
      'Remembered sessions',
    ],
  },
  {
    slug: 'agenthro-project-management',
    title: 'AgentHRO — workspace, project and reminder management',
    tagline: 'Workspaces, projects, tasks and reminders for a team that lives in its own tooling.',
    summary:
      'The second half of the AgentHRO suite: a workspace tool where a team organises projects, breaks them into tasks and sets the reminders that keep them moving.\n\nBuilt on the same Next.js foundation as the leave planner and deployed alongside it, so the two share a look and a login pattern and the team only learns one interface.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Productivity & internal tools',
    liveUrl: 'https://reminders.agenthro.com/',
    coverImage: asset('agenthro-project-management', 'cover.webp'),
    gallery: [],
    techStack: ['Next.js', 'React', 'TypeScript'],
    highlights: [
      'Workspaces grouping projects',
      'Task management inside a project',
      'Reminders against tasks',
      'Shares its foundation with the leave planner',
    ],
  },
  {
    // The host stopped answering while this catalog was being written, so there
    // is nothing to describe honestly and nothing to screenshot. Left as a
    // draft: it shows in the studio catalog, flagged, and never on the website.
    slug: 'cubex-admin',
    title: 'CubeEx — admin panel',
    tagline: '',
    summary: '',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Internal tools',
    liveUrl: 'https://cubex.innovizia.in/admin',
    coverImage: null,
    gallery: [],
    techStack: [],
    highlights: [],
    isPublished: false,
  },
  {
    // hcfinvest.com now serves a domain-parking lander, so the product it used
    // to host cannot be verified or captured. Draft, for the same reason.
    slug: 'hcf-invest',
    title: 'HCF Invest',
    tagline: '',
    summary: '',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Fintech',
    liveUrl: null,
    coverImage: null,
    gallery: [],
    techStack: [],
    highlights: [],
    isPublished: false,
  },

  // ── Mobile. ─────────────────────────────────────────────────────────────────
  {
    slug: 'collabuzz-influencer-android',
    title: 'Collabuzz Influencer App — Android',
    tagline: 'The creator half of Collabuzz, in the pocket of the person doing the work.',
    summary:
      'The Android app creators use to run their side of Collabuzz: browse campaigns matched to their niche, pitch for the ones they want, chat with the brand, upload deliverables against a step-by-step workflow, and watch the payout land.\n\nIt also carries the parts of a creator business that usually live in five different places — profile analytics, a link-in-bio page, and payment history — so the whole thing fits in one app.',
    category: ProjectCategory.ANDROID_APP,
    industry: 'Creator economy',
    liveUrl: 'https://play.google.com/store/apps/details?id=in.collabuzz.influencers',
    coverImage: asset('collabuzz-influencer-android', 'cover.webp'),
    gallery: [
      asset('collabuzz-influencer-android', '01.webp'),
      asset('collabuzz-influencer-android', '02.webp'),
      asset('collabuzz-influencer-android', '03.webp'),
      asset('collabuzz-influencer-android', '04.webp'),
      asset('collabuzz-influencer-android', '05.webp'),
    ],
    techStack: ['Razorpay'],
    highlights: [
      'Campaign discovery matched to a creator’s niche',
      'Pitch and get awarded in-app',
      'Brand chat and deliverable workflow',
      'Profile and content analytics',
      'Link-in-bio page',
      'Razorpay payouts',
    ],
  },
  {
    slug: 'collabuzz-influencer-ios',
    title: 'Collabuzz Influencer App — iOS',
    tagline: 'The same creator workflow, shipped to the App Store and reviewed for it.',
    summary:
      'The iOS build of the Collabuzz creator app, live on the App Store since December 2025 and shipping regular updates since.\n\nCreators browse curated campaigns from verified brands, apply with a personalised pitch, and track requests, approvals and progress. Instagram and YouTube accounts connect to the profile so the analytics a brand sees are the real ones, and payments and collaboration status stay in the app.',
    category: ProjectCategory.IOS_APP,
    industry: 'Creator economy',
    liveUrl: 'https://apps.apple.com/in/app/collabuzz-influencer-app/id6755725811',
    coverImage: asset('collabuzz-influencer-ios', 'cover.webp'),
    gallery: [
      asset('collabuzz-influencer-ios', '01.webp'),
      asset('collabuzz-influencer-ios', '02.webp'),
      asset('collabuzz-influencer-ios', '03.webp'),
      asset('collabuzz-influencer-ios', '04.webp'),
    ],
    techStack: [],
    highlights: [
      'Curated campaigns from verified brands',
      'Personalised pitches, tracked to approval',
      'Instagram and YouTube connected for real analytics',
      'Payments and collaboration status in-app',
      'Through App Store review, and updated since',
    ],
    deliveredAt: new Date('2025-12-15T00:00:00.000Z'),
  },
  {
    slug: 'makemypropertyz-android',
    title: 'Make My Propertyz — construction materials on Android',
    tagline: 'Order cement, steel and finishing materials to a building site from a phone.',
    summary:
      'The customer app for the MakeMyPropertyz material platform. Builders, contractors and homeowners browse by category — cement, steel, bricks, sand and aggregates, tiles, paints, plumbing and electrical, doors and windows, sanitaryware — place the order, and track it to the site.\n\nIt is built for the way the trade actually buys: bulk quantities, transparent per-unit pricing, and a delivery address that is a plot rather than a doorstep.',
    category: ProjectCategory.ANDROID_APP,
    industry: 'Construction & retail',
    liveUrl: 'https://play.google.com/store/apps/details?id=com.MakeMyPropertyz.app',
    coverImage: asset('makemypropertyz-android', 'cover.webp'),
    gallery: [
      asset('makemypropertyz-android', '01.webp'),
      asset('makemypropertyz-android', '02.webp'),
      asset('makemypropertyz-android', '03.webp'),
      asset('makemypropertyz-android', '04.webp'),
      asset('makemypropertyz-android', '05.webp'),
    ],
    techStack: [],
    highlights: [
      'Full material catalog by category',
      'Bulk ordering with per-unit pricing',
      'Delivery to a construction site',
      'Order tracking and support in-app',
      'Built for builders, contractors and homeowners',
    ],
  },
  {
    slug: 'ojas-android',
    title: 'Ojas — devotional audio and priest booking',
    tagline: 'Mantras, aartis and poojas to listen to, and a pandit you can actually book.',
    summary:
      'Ojas is a devotional companion app: a curated audio library of mantras, aartis and complete pooja recordings — from daily chants through to the ceremonies for a Griha Pravesh, a wedding or a Mundan — with a player built for listening through a ceremony rather than skipping tracks.\n\nAround the library sits the part that makes it useful on the day: browsing pandit profiles by experience and speciality, checking their real availability, booking a slot, and paying the dakshina securely in-app. Temples are listed too, with sevas to book and donations to make.',
    category: ProjectCategory.ANDROID_APP,
    industry: 'Devotional & lifestyle',
    liveUrl: 'https://play.google.com/store/apps/details?id=com.formonex.ojasapp',
    coverImage: asset('ojas-android', 'cover.webp'),
    gallery: [
      asset('ojas-android', '01.webp'),
      asset('ojas-android', '02.webp'),
      asset('ojas-android', '03.webp'),
      asset('ojas-android', '04.webp'),
    ],
    techStack: [],
    highlights: [
      'Audio library of mantras, aartis and poojas',
      'Ceremony collections: Griha Pravesh, Vivah, Mundan',
      'Pandit profiles with experience and reviews',
      'Real availability and slot booking',
      'Secure in-app dakshina payment',
      'Temple listings, sevas and donations',
    ],
  },

  // ── Added from live products. Everything below is drawn from the running
  //    site or the store listing — no download counts, since both apps are
  //    early and the number says nothing useful about the build. ─────────────
  {
    slug: 'tawktoo',
    title: 'tawktoo — browser video meetings on WebRTC',
    tagline: 'Group video, screen sharing and chat that runs in a tab, with no install.',
    summary:
      'tawktoo is a video meeting platform built on WebRTC with a mediasoup SFU behind it. An SFU is what makes group calls work at more than a handful of people: each participant sends one stream up and the server forwards it, rather than every browser encoding a copy for every other browser.\n\nA meeting is a link. Participants join from any modern browser on a laptop or a phone with nothing to install, and get high-quality video and audio, screen sharing and in-call messaging. Video quality adapts to the connection rather than stalling on it.\n\nAlongside the meeting UI there is a host portal for running scheduled meetings and a documented API for teams embedding calls into their own product.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Communications',
    liveUrl: 'https://tawktoo.com/',
    coverImage: asset('tawktoo', 'cover.webp'),
    gallery: [asset('tawktoo', '01.webp'), asset('tawktoo', '02.webp'), asset('tawktoo', '03.webp')],
    techStack: ['WebRTC', 'mediasoup', 'Node.js', 'Socket.IO'],
    highlights: [
      'mediasoup SFU for group calls',
      'Joins from a browser, nothing to install',
      'Screen sharing and in-call messaging',
      'Encrypted in transit',
      'Adapts quality to the connection',
      'Host portal and developer API',
    ],
    isFeatured: true,
  },
  {
    slug: 'kidokool',
    title: 'Kidokool — learning management platform for tutors and students',
    tagline: 'Courses, 1-on-1 sessions and group classes, with the tutor marketplace around them.',
    summary:
      'Kidokool is a learning management platform built around live teaching rather than recorded video alone. Students browse tutors by subject and language, book one-to-one live sessions or join scheduled group classes, and work through structured courses with downloadable material and practice exams.\n\nTutors get the other half of the same system: a public profile, verification, their own classes and materials, and a route to being paid for teaching. Language learning is the strongest use case on it, with tutors listed across a dozen languages.\n\nThe platform ships with light and dark themes and a pricing page, and is on its second major version.',
    category: ProjectCategory.WEB_DEVELOPMENT,
    industry: 'Education',
    liveUrl: 'https://kidokool.xyz/',
    coverImage: asset('kidokool', 'cover.webp'),
    gallery: [asset('kidokool', '01.webp'), asset('kidokool', '02.webp'), asset('kidokool', '03.webp')],
    techStack: [],
    highlights: [
      'Tutor marketplace with verification',
      '1-on-1 live sessions',
      'Scheduled group classes',
      'Structured courses with materials',
      'Certificates and practice exams',
      'Separate student and tutor journeys',
    ],
  },
  {
    slug: 'metaquant-pro-android',
    title: 'MetaQuant Pro — Forex trading terminal on Android',
    tagline: 'A terminal-style trading app: live pricing, candlestick charts and open positions.',
    summary:
      'MetaQuant Pro puts a trading terminal on a phone. The market watch carries live bid, ask and spread across major and minor currency pairs plus gold and crypto, and taps through to a full candlestick chart with multiple timeframes and drawing and indicator tools down the side.\n\nThe trade screen is the part that has to be right: balance, equity, used and free margin and margin level at the top, open positions underneath with running profit and loss per position. History covers closed trades day by day, with deposits and withdrawals reconciled against the balance.\n\nBuilt dark throughout, which is what traders actually use, and laid out so the numbers stay legible on a small screen.',
    category: ProjectCategory.ANDROID_APP,
    industry: 'Forex & trading',
    liveUrl: 'https://play.google.com/store/apps/details?id=com.metaquantpro.app',
    coverImage: asset('metaquant-pro-android', 'cover.webp'),
    gallery: [
      asset('metaquant-pro-android', '01.webp'),
      asset('metaquant-pro-android', '02.webp'),
      asset('metaquant-pro-android', '03.webp'),
      asset('metaquant-pro-android', '04.webp'),
    ],
    techStack: [],
    highlights: [
      'Live bid, ask and spread per pair',
      'Candlestick charts with timeframes',
      'Indicator and drawing tools',
      'Balance, equity and margin at a glance',
      'Open positions with running P&L',
      'Trade history with deposits and withdrawals',
    ],
    deliveredAt: new Date('2026-06-23'),
  },
  {
    slug: 'ecolive-android',
    title: 'Ecolive — food, grocery and shopping super app',
    tagline: 'One Ahmedabad app for restaurant delivery, kirana and local retail.',
    summary:
      'Ecolive folds three apps into one. A single storefront switches between restaurant delivery, quick grocery from neighbourhood kirana stores, and a shopping section for clothing, gifts and household goods, all from local vendors rather than a central warehouse.\n\nIt is a strictly vegetarian marketplace, which is a product decision rather than a filter: every restaurant and product listed on it respects that, so nobody has to check. Ordering carries the things that decide whether a delivery app gets used twice — coupons and UPI cashback applied at checkout, live rider tracking on a map, and a rating prompt afterwards that feeds back to the vendor.\n\nBuilt for one city and for the vendors already trading in it.',
    category: ProjectCategory.ANDROID_APP,
    industry: 'Q-commerce & retail',
    liveUrl: 'https://play.google.com/store/apps/details?id=com.ecoliveindia.ecoliveindia',
    coverImage: asset('ecolive-android', 'cover.webp'),
    gallery: [
      asset('ecolive-android', '01.webp'),
      asset('ecolive-android', '02.webp'),
      asset('ecolive-android', '03.webp'),
      asset('ecolive-android', '04.webp'),
      asset('ecolive-android', '05.webp'),
      asset('ecolive-android', '06.webp'),
    ],
    techStack: [],
    highlights: [
      'Food, grocery and retail in one app',
      'Strictly vegetarian marketplace',
      'Local vendors, not a central warehouse',
      'Coupons and UPI cashback at checkout',
      'Live rider tracking',
      'Order rating back to the vendor',
    ],
  },

  {
    slug: 'ecolive-ios',
    title: 'Ecolive — iOS',
    tagline: 'The same super app on iPhone and iPad, through App Store review.',
    summary:
      'The iOS build of Ecolive, on the App Store since March 2026 and updated since. Same three storefronts in one app — restaurant delivery, quick grocery from neighbourhood kirana stores, and local retail — on a strictly vegetarian marketplace.\n\nBuilt to iOS rather than ported to it: native tab-bar navigation, iOS-native sheets and the platform\u2019s own layout conventions throughout. It ships as a universal app, so it runs on iPad at iPad proportions rather than as a stretched phone build.\n\nSupports iOS 15.5 and above, which covers phones going back several years — worth having when the audience is a whole city rather than an early-adopter segment.',
    category: ProjectCategory.IOS_APP,
    industry: 'Q-commerce & retail',
    liveUrl: 'https://apps.apple.com/in/app/ecolive/id6758672255',
    coverImage: asset('ecolive-ios', 'cover.webp'),
    gallery: [
      asset('ecolive-ios', '01.webp'),
      asset('ecolive-ios', '02.webp'),
      asset('ecolive-ios', '03.webp'),
      asset('ecolive-ios', '04.webp'),
      asset('ecolive-ios', '05.webp'),
      asset('ecolive-ios', '06.webp'),
    ],
    techStack: [],
    highlights: [
      'Universal — iPhone and iPad',
      'Native iOS navigation and sheets',
      'Food, grocery and retail in one app',
      'Strictly vegetarian marketplace',
      'Supports iOS 15.5 and above',
      'Through App Store review, and updated since',
    ],
    deliveredAt: new Date('2026-03-23'),
  },
];

/** Fields a person is expected to rewrite; a re-run never clobbers them. */
const WRITTEN = [
  'title', 'tagline', 'summary', 'highlights', 'coverImage', 'gallery',
] as const;

export interface CatalogSeedResult {
  created: number;
  refreshed: number;
  rewritten: number;
}

/**
 * Writes the catalog, attached to the account the public site reads from.
 *
 * Idempotent. A re-run refreshes the facts — category, industry, live URL,
 * stack, ordering — and leaves anything in {@link WRITTEN} alone, so copy
 * edited in the studio survives. Pass `rewrite` to overwrite that too, which is
 * what you want after editing this file.
 */
export const seedCatalog = async (
  prisma: PrismaClient,
  ownerId: string,
  { rewrite = false }: { rewrite?: boolean } = {},
): Promise<CatalogSeedResult> => {
  let created = 0;
  let refreshed = 0;
  let rewritten = 0;

  for (const [index, entry] of CATALOG.entries()) {
    const facts = {
      category: entry.category,
      industry: entry.industry,
      liveUrl: entry.liveUrl,
      techStack: entry.techStack,
      deliveredAt: entry.deliveredAt ?? null,
      isFeatured: entry.isFeatured ?? false,
      isPublished: entry.isPublished ?? true,
      sortOrder: index,
    };

    const written = {
      title: entry.title,
      tagline: entry.tagline,
      summary: entry.summary,
      highlights: entry.highlights,
      coverImage: entry.coverImage,
      gallery: entry.gallery,
    };

    const existing = await prisma.portfolioItem.findFirst({
      where: { ownerId, slug: entry.slug },
      select: { id: true },
    });

    if (existing) {
      await prisma.portfolioItem.update({
        where: { id: existing.id },
        data: rewrite ? { ...facts, ...written } : facts,
      });
      if (rewrite) rewritten += 1;
      else refreshed += 1;
      continue;
    }

    await prisma.portfolioItem.create({
      data: {
        ownerId,
        slug: entry.slug,
        ...facts,
        ...written,
        // Never seeded — see the note at the top of this file.
        clientLabel: null,
        testimonial: null,
      },
    });
    created += 1;
  }

  return { created, refreshed, rewritten };
};

export { WRITTEN };
