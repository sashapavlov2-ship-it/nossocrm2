'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Inbox,
  LayoutDashboard,
  KanbanSquare,
  ContactRound,
  CheckSquare,
  Filter,
  DollarSign,
  Package,
  PieChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { prefetchRoute, type RouteName } from '@/lib/prefetch';
import { cn } from '@/lib/utils';

const SIDEBAR_WIDTH = 256;

type NavItem = { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; prefetch?: RouteName };

const BLOCK_1: NavItem[] = [
  { to: '/dashboard/james-ia', label: 'James IA', icon: Sparkles, prefetch: 'james-ia' },
];

const BLOCK_2: NavItem[] = [
  { to: '/inbox', label: 'Inbox', icon: Inbox, prefetch: 'inbox' },
  { to: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard, prefetch: 'dashboard' },
  { to: '/dashboard/boards', label: 'Boards', icon: KanbanSquare, prefetch: 'boards' },
  { to: '/dashboard/contatos', label: 'Contatos', icon: ContactRound, prefetch: 'contacts' },
  { to: '/activities', label: 'Atividades', icon: CheckSquare, prefetch: 'activities' },
  { to: '/dashboard/leads-crm', label: 'Leads CRM', icon: Filter },
];

const BLOCK_3: NavItem[] = [
  { to: '/dashboard/financeiro', label: 'Financeiro', icon: DollarSign },
  { to: '/settings/products', label: 'Produtos e Serviços', icon: Package, prefetch: 'settings' },
  { to: '/reports', label: 'Relatórios', icon: PieChart, prefetch: 'reports' },
];

const BLOCK_4: NavItem[] = [
  { to: '/settings', label: 'Configurações', icon: Settings, prefetch: 'settings' },
];

const BLOCKS: Array<{ title: string; items: NavItem[] }> = [
  { title: 'IA & Assistente', items: BLOCK_1 },
  { title: 'CRM', items: BLOCK_2 },
  { title: 'Gestão', items: BLOCK_3 },
  { title: 'Sistema', items: BLOCK_4 },
];

function NavButton({
  to,
  label,
  icon: Icon,
  isActive,
  prefetch,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isActive: boolean;
  prefetch?: RouteName;
}) {
  const className = cn(
    'flex w-full cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-lg p-2.5 text-sm transition-all',
    isActive
      ? 'border border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400'
      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'
  );

  return (
    <Link
      href={to}
      className={className}
      aria-current={isActive ? 'page' : undefined}
      onMouseEnter={prefetch ? () => prefetchRoute(prefetch) : undefined}
    >
      <Icon size={20} className="shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const displayName = profile?.nickname || profile?.first_name || profile?.email?.split('@')[0] || 'Utilizador';
  const displayEmail = profile?.email || '';
  const initials = (profile?.first_name && profile?.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`
    : profile?.nickname?.substring(0, 2) || profile?.email?.substring(0, 2) || 'SR'
  ).toUpperCase();

  return (
    <>
      {/* Trigger strip — always visible on the left edge */}
      {!isSidebarOpen && (
        <div
          className="fixed left-0 top-0 z-50 h-screen w-3 cursor-pointer"
          onMouseEnter={() => setIsSidebarOpen(true)}
          aria-hidden
        />
      )}
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-md transition-transform duration-300 ease-in-out dark:border-white/10 dark:bg-zinc-900/95 dark:shadow-[20px_0_30px_rgba(0,0,0,0.5)]',
        isSidebarOpen ? 'translate-x-0 shadow-xl dark:shadow-[20px_0_30px_rgba(0,0,0,0.5)]' : '-translate-x-full'
      )}
      style={{ width: SIDEBAR_WIDTH }}
      onMouseEnter={() => setIsSidebarOpen(true)}
      onMouseLeave={() => setIsSidebarOpen(false)}
      aria-label="Menu principal"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-3 dark:border-white/5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white shadow-lg" aria-hidden>
            N
          </div>
          <span className="truncate text-base font-bold text-slate-900 dark:text-white">NossoCRM</span>
        </div>
        <span className="shrink-0 text-slate-500 dark:text-zinc-400" aria-hidden>
          {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </span>
      </div>

      <nav
        className="app-sidebar-nav flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-2"
        aria-label="Navegação do sistema"
      >
        {BLOCKS.map((block) => (
          <div key={block.title} className="px-2">
            <p className="mb-2 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 first:mt-0 dark:text-zinc-500">
              {block.title}
            </p>
            <div className="space-y-0.5">
              {block.items.map((item) => {
                const isActive =
                  item.to !== '#' &&
                  (pathname === item.to || (item.to === '/dashboard/boards' && pathname === '/pipeline'));
                return (
                  <NavButton
                    key={item.to + item.label}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive}
                    prefetch={item.prefetch}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto shrink-0 border-t border-slate-200 pt-4 dark:border-white/5">
        <div className="relative px-3 pb-4">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10"
          >
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-slate-200 dark:ring-white/10"
                unoptimized
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white ring-2 ring-slate-200 dark:ring-white/10" aria-hidden>
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{displayName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-zinc-500">{displayEmail}</p>
            </div>
          </button>

          {isUserMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} aria-hidden />
              <div className="absolute bottom-full left-3 right-3 z-50 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-zinc-900">
                <div className="p-1">
                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
                  >
                    <User className="h-4 w-4 text-slate-500 dark:text-zinc-500" aria-hidden />
                    Editar Perfil
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sair da conta
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
