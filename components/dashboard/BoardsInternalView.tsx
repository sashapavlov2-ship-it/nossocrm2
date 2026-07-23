'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Clock } from 'lucide-react';

const KANBAN_LANES = [
  { id: 'prospect', title: 'Em Negociação', count: 2 },
  { id: 'qualificado', title: 'Qualificado', count: 3 },
  { id: 'proposta', title: 'Proposta', count: 1 },
  { id: 'ganho', title: 'Ganho', count: 2 },
  { id: 'perdido', title: 'Perdido', count: 0 },
] as const;

const MOCK_CARDS = [
  { id: '1', columnId: 'prospect', company: 'Tech Solutions Ltda', value: '€ 45.000', tags: ['Urgente'], assignee: 'GR', date: '24/02' },
  { id: '2', columnId: 'prospect', company: 'Indústria Beta', value: '€ 12.500', tags: ['NPS Alto'], assignee: 'TS', date: '25/02' },
  { id: '3', columnId: 'qualificado', company: 'Comércio Delta', value: '€ 78.200', tags: ['Urgente', 'NPS Alto'], assignee: 'GR', date: '23/02' },
  { id: '4', columnId: 'qualificado', company: 'Serviços Omega', value: '€ 33.000', tags: [], assignee: 'TS', date: '26/02' },
  { id: '5', columnId: 'qualificado', company: 'Logística Norte', value: '€ 21.000', tags: ['Novo'], assignee: 'GR', date: '27/02' },
  { id: '6', columnId: 'proposta', company: 'Varejo Sul', value: '€ 156.000', tags: ['Urgente'], assignee: 'TS', date: '20/02' },
  { id: '7', columnId: 'ganho', company: 'Consultoria XYZ', value: '€ 89.000', tags: ['NPS Alto'], assignee: 'GR', date: '15/02' },
  { id: '8', columnId: 'ganho', company: 'Software House', value: '€ 210.000', tags: [], assignee: 'TS', date: '10/02' },
];

function KanbanCard({
  company,
  value,
  tags,
  assignee,
  date,
}: {
  company: string;
  value: string;
  tags: string[];
  assignee: string;
  date: string;
}) {
  return (
    <motion.div
      layout
      initial={false}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="cursor-grab rounded-lg border border-white/10 bg-zinc-900 p-4 mt-3 transition-all hover:border-green-500/30 hover:shadow-lg"
    >
      <p className="text-sm font-bold text-zinc-100">{company}</p>
      <p className="mt-1 text-sm font-medium text-green-400">{value}</p>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                tag === 'Urgente' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
          {assignee}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={12} aria-hidden />
          {date}
        </span>
      </div>
    </motion.div>
  );
}

export function BoardsInternalView() {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4 mt-6 h-[calc(100vh-200px)] min-h-[400px]">
      {KANBAN_LANES.map((col) => {
        const cards = MOCK_CARDS.filter((c) => c.columnId === col.id);
        return (
          <div
            key={col.id}
            className="w-80 min-w-[20rem] flex flex-col rounded-lg border border-white/5 bg-zinc-900/20 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                {col.title}
              </h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{cards.length}</span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label={`Adicionar card em ${col.title}`}
                >
                  <Plus size={18} aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
              {cards.map((card) => (
                <KanbanCard
                  key={card.id}
                  company={card.company}
                  value={card.value}
                  tags={card.tags}
                  assignee={card.assignee}
                  date={card.date}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
