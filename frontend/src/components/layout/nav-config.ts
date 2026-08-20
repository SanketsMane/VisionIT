import {
  BarChart3, BookOpen, Briefcase, FileText, LayoutDashboard, Mail, MessageSquare, PackageCheck, Receipt, Settings, UserCheck, Users, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped by what the user is *doing*, not by which API module backs it —
 * "Money in / money out" is a clearer mental model than "invoices, payments,
 * expenses, accounts, ledger" as five peers.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, description: 'Your business at a glance' },
    ],
  },
  {
    label: 'Work',
    items: [
      { label: 'Projects', href: '/projects', icon: Briefcase, description: 'Your portfolio catalog' },
      { label: 'Clients', href: '/clients', icon: Users, description: 'People you work with' },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Invoices', href: '/invoices', icon: FileText, description: 'Bill your clients' },
      { label: 'Payment requests', href: '/payments/requests', icon: UserCheck, description: 'Verify client payments' },
      { label: 'Expenses', href: '/expenses', icon: Receipt, description: 'What you spend' },
      { label: 'Accounts', href: '/accounts', icon: Wallet, description: 'Chart of accounts & balances' },
      { label: 'Ledger', href: '/ledger', icon: BookOpen, description: 'Double-entry journal' },
      { label: 'Reports', href: '/reports', icon: BarChart3, description: 'Financial statements' },
    ],
  },
  {
    label: 'Client portal',
    items: [
      { label: 'Portal users', href: '/portal-users', icon: Users, description: 'Who can reach your projects' },
      { label: 'Delivery board', href: '/delivery-board', icon: PackageCheck, description: 'Handover status across projects' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Messages', href: '/chat', icon: MessageSquare, description: 'Chat with clients and their teams' },
      { label: 'Email', href: '/email', icon: Mail, description: 'AI-assisted client email' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', href: '/settings', icon: Settings, description: 'Business profile & preferences' },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
