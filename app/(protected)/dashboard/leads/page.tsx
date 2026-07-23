'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { InternalPageLayout } from '@/components/InternalPageLayout';
import { Search, Download, Plus, MoreHorizontal, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Temperature = 'QUENTE' | 'MORNO' | 'FRIO' | 'PERDIDO' | null;

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  total_value: number;
  last_interaction: string | null;
  lead_temperature: Temperature;
  lead_score: number | null;
  lead_classified_at: string | null;
  created_at: string;
}

const TEMP_CONFIG: Record<NonNullable<Temperature>, { label: string; emoji: string; badge: string }> = {
  QUENTE: { label: 'Quente', emoji: '🔥', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  MORNO: { label: 'Morno', emoji: '🌤️', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  FRIO: { label: 'Frio', emoji: '❄️', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PERDIDO: { label: 'Perdido', emoji: '💀', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function TemperatureBadge({ temperature, score }: { temperature: Temperature; score: number | null }) {
  if (!temperature) {
    return (
      <span className="inline-flex rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
        Não classificado
      </span>
    );
  }
  const cfg = TEMP_CONFIG[temperature];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
      {cfg.emoji} {cfg.label}
      {score !== null && <span className="opacity-70">· {Math.round(score)}</span>}
    </span>
  );
}

function avatarInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const PAGE_SIZE = 20;

export default function DashboardLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTemp, setFilterTemp] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = React.useMemo(() => createClient()!, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('id, name, email, phone, source, total_value, last_interaction, lead_temperature, lead_score, lead_classified_at, created_at', { count: 'exact' })
        .is('deleted_at', null)
        .order('lead_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (search.trim()) {
        // Escapar caracteres com significado especial em PostgREST (vírgula, parênteses,
        // asterisco, aspas, barra) antes de interpolar no filtro .or().
        const safe = search.trim().replace(/[,()*"\\]/g, '');
        if (safe) {
          query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
        }
      }
      if (filterTemp) {
        query = query.eq('lead_temperature', filterTemp);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setLeads((data ?? []) as Lead[]);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, filterTemp, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function classifyLead(contactId: string) {
    setClassifying(contactId);
    try {
      const resp = await fetch('/api/ai/classify-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      });
      if (resp.ok) await fetchLeads();
    } finally {
      setClassifying(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <InternalPageLayout
      title="Leads / Contactos"
      description="Gerencie e qualifique os seus leads"
      actions={
        <>
          <button
            type="button"
            onClick={fetchLeads}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/5"
          >
            <RefreshCw size={16} aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
          >
            <Plus size={18} aria-hidden />
            Adicionar Lead
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
            <input
              type="search"
              placeholder="Pesquisar leads..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-md border border-white/10 bg-zinc-900 py-2 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-green-500/50 focus:outline-none"
            />
          </div>
          <select
            value={filterTemp}
            onChange={(e) => { setFilterTemp(e.target.value); setPage(1); }}
            className="rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-green-500/50 focus:outline-none"
          >
            <option value="">Temperatura</option>
            <option value="QUENTE">🔥 Quente</option>
            <option value="MORNO">🌤️ Morno</option>
            <option value="FRIO">❄️ Frio</option>
            <option value="PERDIDO">💀 Perdido</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-lg border border-white/5 bg-zinc-900/30">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Temperatura</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Valor Total</th>
                <th className="px-4 py-3">Último Contacto</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">A carregar...</td>
                </tr>
              )}
              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenhum lead encontrado.</td>
                </tr>
              )}
              {!loading && leads.map((row) => (
                <tr key={row.id} className="h-14 border-b border-white/5 transition-colors hover:bg-zinc-900/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-200">
                        {avatarInitials(row.name)}
                      </span>
                      <div>
                        <p className="font-medium text-zinc-100">{row.name}</p>
                        {row.email && <p className="text-xs text-zinc-500">{row.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <TemperatureBadge temperature={row.lead_temperature} score={row.lead_score} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{row.source ?? '—'}</td>
                  <td className="px-4 py-3 text-green-400">
                    {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(row.total_value ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.last_interaction
                      ? new Date(row.last_interaction).toLocaleDateString('pt-PT')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={classifying === row.id}
                        onClick={() => classifyLead(row.id)}
                        title="Classificar lead com IA"
                        className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                      >
                        {classifying === row.id ? '...' : '🤖 Classificar'}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label={`Ações ${row.name}`}
                      >
                        <MoreHorizontal size={18} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <p className="text-xs text-zinc-500">
            {total} lead{total !== 1 ? 's' : ''} no total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50 hover:bg-white/5"
            >
              Anterior
            </button>
            <span className="flex items-center px-3 text-sm text-zinc-400">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 disabled:opacity-50 hover:bg-white/5"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}
