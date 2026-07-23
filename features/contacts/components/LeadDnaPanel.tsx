'use client';

/**
 * LeadDnaPanel
 * Accordion panel displaying extracted Lead DNA signals.
 * Shown in the Contact Detail page.
 */

import { useState, useEffect } from 'react';
import type { LeadDna } from '@/lib/orchestrator/agentState';

interface Props {
    contactId: string;
    /** Preloaded DNA (from SSR), or fetched client-side */
    initialDna?: LeadDna | null;
}

function DnaField({ icon, label, values }: { icon: string; label: string; values: string[] }) {
    if (values.length === 0) return null;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.35)', marginBottom: 6,
                textTransform: 'uppercase',
            }}>
                <span>{icon}</span> {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {values.map((v, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 8, padding: '6px 12px',
                        fontSize: 13, color: 'rgba(255,255,255,0.75)',
                        lineHeight: 1.45,
                    }}>
                        {v}
                    </div>
                ))}
            </div>
        </div>
    );
}

function MoneyField({ icon, label, value }: { icon: string; label: string; value?: number }) {
    if (value == null) return null;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.35)', marginBottom: 6,
                textTransform: 'uppercase',
            }}>
                {icon} {label}
            </div>
            <div style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.15)',
                borderRadius: 8, padding: '6px 12px',
                fontSize: 15, fontWeight: 700,
                color: '#4ade80',
            }}>
                € {value.toLocaleString('pt-PT')}
            </div>
        </div>
    );
}

export function LeadDnaPanel({ contactId, initialDna }: Props) {
    const [open, setOpen] = useState(false);
    const [dna, setDna] = useState<LeadDna | null>(initialDna ?? null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        if (dna) return; // already loaded
        setLoading(true);
        try {
            // The observability skill or a future /api/contacts/[id]/dna endpoint would supply this
            // For now, we fetch from Supabase via a public API contact query
            const res = await fetch(`/api/public/contacts/${contactId}/dna`);
            if (res.ok) setDna(await res.json());
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (open) load(); }, [open]);

    const isEmpty = !dna || (
        (dna.pains?.length ?? 0) === 0 &&
        (dna.objections?.length ?? 0) === 0 &&
        !dna.avgTicket && !dna.revenue && !dna.decisionMaker
    );

    return (
        <div id={`lead-dna-panel-${contactId}`} style={{
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 12,
        }}>
            {/* Accordion trigger */}
            <button
                id={`lead-dna-toggle-${contactId}`}
                onClick={() => setOpen((o) => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: 'none', cursor: 'pointer', color: '#f1f5f9',
                    fontSize: 14, fontWeight: 600,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🧬</span> DNA do Lead
                    {!isEmpty && (
                        <span style={{
                            fontSize: 10, fontWeight: 700,
                            background: 'rgba(74,222,128,0.15)',
                            border: '1px solid rgba(74,222,128,0.3)',
                            color: '#4ade80', borderRadius: 999, padding: '1px 8px',
                        }}>
                            {(dna?.pains?.length ?? 0) + (dna?.objections?.length ?? 0)} sinais
                        </span>
                    )}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
            </button>

            {/* Panel body */}
            {open && (
                <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {loading && (
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Carregando DNA…</p>
                    )}
                    {!loading && isEmpty && (
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                            Nenhum sinal extraído ainda. O DNA será atualizado conforme a conversa evolui.
                        </p>
                    )}
                    {!loading && dna && !isEmpty && (
                        <>
                            <DnaField icon="🩺" label="Dores" values={dna.pains ?? []} />
                            <DnaField icon="🛡️" label="Objeções" values={dna.objections ?? []} />
                            <MoneyField icon="💰" label="Ticket Médio" value={dna.avgTicket} />
                            <MoneyField icon="📈" label="Faturamento" value={dna.revenue} />
                            {dna.decisionMaker && (
                                <DnaField icon="👔" label="Decisor" values={[dna.decisionMaker]} />
                            )}
                            <p style={{
                                marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.25)',
                            }}>
                                Atualizado: {new Date(dna.lastUpdated).toLocaleString('pt-PT')}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
