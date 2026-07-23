'use client';

/**
 * AI Observability Panel — /ai-observability
 *
 * Apple-esque dark mode page displaying the LangGraph reasoning timeline.
 * Shows agent steps, intents, skills invoked, and decision rationale in real-time.
 */

import { useEffect, useState } from 'react';
import type { OrchestratorStep, AgentRole } from '@/lib/orchestrator/agentState';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ObservabilityData {
    date: string;
    total: number;
    steps: OrchestratorStep[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_STYLES: Record<AgentRole, { label: string; color: string; bg: string }> = {
    FRONTEND: { label: 'Frontend', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    BACKEND: { label: 'Backend', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
    DNA: { label: 'DNA', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
    RESEARCHER: { label: 'Researcher', color: '#c084fc', bg: 'rgba(192,132,252,0.15)' },
    FOLLOWUP: { label: 'Follow-up', color: '#facc15', bg: 'rgba(250,204,21,0.15)' },
};

function AgentBadge({ agent }: { agent: AgentRole }) {
    const style = AGENT_STYLES[agent] ?? { label: agent, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: style.color,
            background: style.bg,
            border: `1px solid ${style.color}40`,
        }}>
            {style.label}
        </span>
    );
}

function StepCard({ step, index }: { step: OrchestratorStep; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const ts = new Date(step.timestamp).toLocaleTimeString('pt-PT');

    return (
        <div id={`step-${step.stepId}`} style={{
            display: 'flex',
            gap: 16,
            padding: '0 0 28px 0',
            position: 'relative',
        }}>
            {/* Timeline line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1.5px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                    flexShrink: 0,
                }}>
                    {index + 1}
                </div>
                <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.07)', marginTop: 6 }} />
            </div>

            {/* Card */}
            <div style={{
                flex: 1,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
            }}
                onClick={() => setExpanded((e) => !e)}
            >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <AgentBadge agent={step.agent} />
                    {step.intent && (
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
                            {step.intent}
                        </span>
                    )}
                    {step.skillInvoked && (
                        <span style={{
                            fontSize: 11, color: '#818cf8', background: 'rgba(129,140,248,0.1)',
                            border: '1px solid rgba(129,140,248,0.25)',
                            borderRadius: 6, padding: '1px 8px',
                        }}>
                            {step.skillInvoked}
                        </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                        {ts}{step.durationMs != null ? ` · ${step.durationMs}ms` : ''}
                    </span>
                </div>

                {/* Reasoning summary */}
                {step.reasoning && (
                    <p style={{
                        margin: '8px 0 0 0', fontSize: 13, lineHeight: 1.55,
                        color: 'rgba(255,255,255,0.6)',
                    }}>
                        {step.reasoning.slice(0, 160)}{step.reasoning.length > 160 ? '…' : ''}
                    </p>
                )}

                {/* Expand details */}
                {expanded && (
                    <pre style={{
                        marginTop: 12, padding: 12, borderRadius: 8,
                        background: 'rgba(0,0,0,0.3)', fontSize: 11,
                        color: 'rgba(255,255,255,0.55)', overflowX: 'auto',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    }}>
                        {JSON.stringify(step, null, 2)}
                    </pre>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function AIObservabilityPage() {
    const [data, setData] = useState<ObservabilityData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/ai/observability?date=${date}&limit=100`);
            if (!res.ok) throw new Error('Falha ao carregar dados de observabilidade.');
            const json = await res.json() as ObservabilityData;
            setData(json);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro desconhecido.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [date]);

    return (
        <div style={{
            minHeight: '100vh',
            background: '#080b0f',
            color: '#f1f5f9',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            padding: '0 0 80px 0',
        }}>
            {/* Header */}
            <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                background: 'rgba(8,11,15,0.9)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '18px 24px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
                        🧠 AI Observability
                    </h1>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                        LangGraph reasoning log · tempo real
                    </p>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                        id="obs-date-input"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8, padding: '6px 12px',
                            color: '#f1f5f9', fontSize: 13, cursor: 'pointer',
                        }}
                    />
                    <button
                        id="obs-refresh-btn"
                        onClick={fetchData}
                        style={{
                            background: 'rgba(99,102,241,0.2)',
                            border: '1px solid rgba(99,102,241,0.4)',
                            borderRadius: 8, padding: '6px 16px',
                            color: '#a5b4fc', fontSize: 13, cursor: 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            {data && (
                <div style={{
                    display: 'flex', gap: 16, padding: '16px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    flexWrap: 'wrap',
                }}>
                    {[
                        { label: 'Steps', value: data.total },
                        { label: 'Frontend', value: data.steps.filter(s => s.agent === 'FRONTEND').length, color: '#60a5fa' },
                        { label: 'Backend', value: data.steps.filter(s => s.agent === 'BACKEND').length, color: '#fb923c' },
                        { label: 'DNA', value: data.steps.filter(s => s.agent === 'DNA').length, color: '#4ade80' },
                    ].map((stat) => (
                        <div key={stat.label} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 10, padding: '10px 18px',
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: stat.color ?? '#f1f5f9' }}>
                                {stat.value}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Content */}
            <div style={{ padding: '28px 24px', maxWidth: 860, margin: '0 auto' }}>
                {loading && (
                    <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingTop: 60 }}>
                        Carregando logs…
                    </p>
                )}
                {error && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 10, padding: 16, color: '#f87171', fontSize: 14,
                    }}>
                        {error}
                    </div>
                )}
                {!loading && !error && data && data.steps.length === 0 && (
                    <div style={{ textAlign: 'center', paddingTop: 80, color: 'rgba(255,255,255,0.3)' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
                        <p style={{ fontSize: 15, marginBottom: 6 }}>Nenhum step registrado para esta data.</p>
                        <p style={{ fontSize: 13 }}>Faça uma interação com o agente para ver os logs aqui.</p>
                    </div>
                )}
                {!loading && data && data.steps.map((step, i) => (
                    <StepCard key={step.stepId} step={step} index={i} />
                ))}
            </div>
        </div>
    );
}
