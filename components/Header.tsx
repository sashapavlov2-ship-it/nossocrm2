'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronDown,
  Search,
  Settings,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCRM } from '@/context/CRMContext';
import { useTheme } from '@/context/ThemeContext';
import { NotificationPopover } from '@/components/notifications/NotificationPopover';
import { cn } from '@/lib/utils';

/**
 * Header global fixo no topo — identidade NossoCRM.
 * Logo + busca central + ações e card do usuário.
 */
export function Header() {
  const { profile } = useAuth();
  const { isGlobalAIOpen, setIsGlobalAIOpen } = useCRM();
  const { darkMode, toggleDarkMode } = useTheme();
  const [searchFocused, setSearchFocused] = useState(false);

  const displayName =
    profile?.nickname ||
    profile?.email?.split('@')[0] ||
    'gustavo.rodrigo';
  const initials = (
    profile?.first_name && profile?.last_name
      ? `${profile.first_name[0]}${profile.last_name[0]}`
      : profile?.nickname?.substring(0, 2) || profile?.email?.substring(0, 2) || 'GU'
  ).toUpperCase();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-header-search]');
        input?.focus();
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/5 bg-zinc-950/80 px-6 backdrop-blur-sm"
      role="banner"
    >
      {/* Logo / Brand */}
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white shadow-lg"
          aria-hidden
        >
          N
        </div>
        <span className="text-lg font-bold text-white whitespace-nowrap">
          NossoCRM
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 text-zinc-500"
          aria-hidden
        />
      </div>

      {/* Barra de pesquisa (centro) */}
      <div className="relative flex flex-1 justify-center">
        <div
          className={cn(
            'relative flex w-96 max-w-full items-center rounded-md border bg-zinc-900 transition-colors',
            searchFocused ? 'border-white/20' : 'border-white/10'
          )}
        >
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <input
            type="search"
            data-header-search
            placeholder="Buscar clientes, colaboradores..."
            className="h-9 w-full flex-1 bg-transparent py-1.5 pl-10 pr-20 text-sm text-white outline-none placeholder:text-zinc-500"
            aria-label="Buscar"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Ações e perfil (direita) */}
      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsGlobalAIOpen(!isGlobalAIOpen)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50"
            aria-label={isGlobalAIOpen ? 'Fechar assistente IA' : 'Abrir assistente IA'}
          >
            <Sparkles size={20} aria-hidden />
          </button>
          <NotificationPopover />
          <Link
            href="/settings"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50"
            aria-label="Configurações"
          >
            <Settings size={20} aria-hidden />
          </Link>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50"
            aria-label={darkMode ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          >
            {darkMode ? <Moon size={20} aria-hidden /> : <Sun size={20} aria-hidden />}
          </button>
        </div>
        {/* Card do usuário */}
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg py-1.5 pl-1 pr-2 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50"
          aria-label="Menu do usuário"
        >
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
              aria-hidden
            >
              {initials}
            </div>
          )}
          <span className="text-sm font-bold text-white truncate max-w-[120px]">
            {displayName}
          </span>
          <ChevronDown size={16} className="shrink-0 text-zinc-500" aria-hidden />
        </button>
      </div>
    </header>
  );
}
