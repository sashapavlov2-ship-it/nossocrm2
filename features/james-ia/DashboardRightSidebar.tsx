'use client';

import { useDashboardData } from '@/hooks/useDashboardData';
import { Wifi, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const GLASS_CARD_CLASS =
  'bg-zinc-900/30 backdrop-blur-md border border-white/5 rounded-xl p-4 transition-all hover:border-green-500/30 hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]';

export function DashboardRightSidebar() {
  const data = useDashboardData();

  return (
    <>
      <GlassCard title="Conectividade" icon={<Wifi className="h-4 w-4 text-green-400/80" aria-hidden />}>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">N8N</span>
            <span className="font-medium text-green-400">
              {data.n8nConectado ? 'CONECTADO' : 'DESCONECTADO'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">WHATSAPP</span>
            <span className="font-medium text-green-400">
              {data.whatsappAtivo ? 'ATIVO' : 'INATIVO'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">LATÊNCIA</span>
            <span className="font-medium text-zinc-300">{data.latenciaMs}ms</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Base de Dados" icon={<Database className="h-4 w-4 text-green-400/80" aria-hidden />}>
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">CONSULTAS</span>
            <span className="font-medium text-zinc-300">{data.consultas.toLocaleString('pt-PT')}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">SINCRONIZAÇÃO</span>
            <span className="font-medium text-green-400">{data.sincronizacaoOk ? 'OK' : 'PENDENTE'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-500">BACKUP</span>
            <span className="font-medium text-zinc-400">{data.backupAtras}</span>
          </div>
        </div>
      </GlassCard>
    </>
  );
}

function GlassCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(GLASS_CARD_CLASS, className)}>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}
