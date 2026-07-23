'use client';

import { InternalPageLayout } from '@/components/InternalPageLayout';
import { Plus, Filter } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLeadsCRMPage() {
  return (
    <InternalPageLayout
      title="Leads CRM"
      description="Gerencie e qualifique seus leads em um só lugar."
      actions={
        <>
          <Link
            href="/dashboard/contatos"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50"
          >
            <Plus size={18} aria-hidden />
            Novo Lead
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-green-500/50"
          >
            <Filter size={18} aria-hidden />
            Filtros
          </button>
        </>
      }
    >
      <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-8 text-center text-zinc-400">
        <p className="text-sm">Página de gestão de leads em construção.</p>
        <p className="mt-1 text-xs">Use os botões acima para adicionar leads ou filtrar.</p>
      </div>
    </InternalPageLayout>
  );
}
