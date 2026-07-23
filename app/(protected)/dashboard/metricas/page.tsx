'use client';

import React from 'react';
import { InternalPageLayout } from '@/components/InternalPageLayout';
import { TrendingUp, DollarSign, Users, Target, BarChart3, PieChart } from 'lucide-react';

const SUMMARY_CARDS = [
  { title: 'Receita Total', value: '€ 45.231,00', change: '+12%', icon: DollarSign, positive: true },
  { title: 'Leads Qualificados', value: '1.247', change: '+8%', icon: Users, positive: true },
  { title: 'Taxa de Conversão', value: '23,4%', change: '-2%', icon: Target, positive: false },
  { title: 'Ticket Médio', value: '€ 2.890', change: '+5%', icon: TrendingUp, positive: true },
];

export default function DashboardMetricasPage() {
  return (
    <InternalPageLayout
      title="Funil / Dashboard"
      description="Métricas e desempenho do pipeline"
    >
      <div className="space-y-6">
        {/* Linha 1 - Cards de resumo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUMMARY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-xl border border-white/5 bg-zinc-900/60 p-5 transition-colors hover:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{card.title}</p>
                  <Icon size={18} className="text-zinc-500" aria-hidden />
                </div>
                <p className="mt-2 text-2xl font-bold text-zinc-100">{card.value}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      card.positive ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    <TrendingUp size={12} aria-hidden />
                    {card.change}
                  </span>
                  <span className="text-xs text-zinc-500">vs. mês anterior</span>
                </div>
                <div className="mt-3 h-8 w-full rounded bg-zinc-800/50 flex items-end">
                  <div
                    className="h-full rounded bg-green-500/30"
                    style={{ width: card.positive ? '70%' : '40%' }}
                    aria-hidden
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Linha 2 - Gráficos */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Gráfico de barras - Funil de Vendas */}
          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Funil de Vendas</h2>
              <BarChart3 size={20} className="text-zinc-500" aria-hidden />
            </div>
            <div className="space-y-4">
              {['Prospect', 'Qualificado', 'Proposta', 'Negociação', 'Fechado'].map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-zinc-400">{label}</span>
                  <div className="h-8 flex-1 rounded bg-zinc-800/50 overflow-hidden">
                    <div
                      className="h-full rounded bg-gradient-to-r from-green-500/40 to-green-500/20"
                      style={{ width: `${100 - i * 18}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="w-12 text-right text-sm text-zinc-500">{100 - i * 18}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico de rosca - Origem dos Leads */}
          <div className="rounded-xl border border-white/5 bg-zinc-900/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">Origem dos Leads</h2>
              <PieChart size={20} className="text-zinc-500" aria-hidden />
            </div>
            <div className="flex items-center justify-center gap-8">
              <div className="relative h-40 w-40 rounded-full border-[12px] border-zinc-700" aria-hidden>
                <div
                  className="absolute inset-0 rounded-full border-[12px] border-green-500/60"
                  style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)' }}
                />
                <div
                  className="absolute inset-0 rounded-full border-[12px] border-blue-500/60"
                  style={{ clipPath: 'polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)' }}
                />
                <div
                  className="absolute inset-0 rounded-full border-[12px] border-amber-500/60"
                  style={{ clipPath: 'polygon(50% 50%, 50% 100%, 0% 100%, 0% 50%)' }}
                />
                <div
                  className="absolute inset-0 rounded-full border-[12px] border-zinc-500"
                  style={{ clipPath: 'polygon(50% 50%, 0% 50%, 0% 0%, 50% 0%)' }}
                />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-green-500/60" aria-hidden />
                  <span className="text-zinc-400">Site (42%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-500/60" aria-hidden />
                  <span className="text-zinc-400">Indicação (28%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-500/60" aria-hidden />
                  <span className="text-zinc-400">Evento (18%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-zinc-500" aria-hidden />
                  <span className="text-zinc-400">Outros (12%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InternalPageLayout>
  );
}
