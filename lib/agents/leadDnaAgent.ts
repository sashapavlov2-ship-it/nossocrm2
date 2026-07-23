/**
 * Lead DNA Agent — background sub-routine.
 *
 * Runs AFTER each FrontendAgent turn (fire-and-forget, no await required from caller).
 * Extracts pain points, objections, ticket signals, revenue signals from conversation text.
 * Persists to Upstash (short-term) and Supabase lead_dna table (long-term).
 *
 * Architecture note: This agent has NO UI and no model call —
 * it uses regex/heuristic extraction to keep token costs at zero for DNA capture.
 */

import { redis, leadDnaKey, TTL } from '@/lib/upstash';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import type { DnaSignal, LeadDna } from '@/lib/orchestrator/agentState';

// ─────────────────────────────────────────────────────────────────────────────
// Extraction patterns (Portuguese CRM context)
// ─────────────────────────────────────────────────────────────────────────────

const PAIN_PATTERNS = [
    /nosso maior problema[ée] ([^,.!?]{5,80})/gi,
    /sofremos com ([^,.!?]{5,80})/gi,
    /temos dificuldade[s]? (?:com|em|para) ([^,.!?]{5,80})/gi,
    /não conseguimos ([^,.!?]{5,80})/gi,
    /falta[m]? ([^,.!?]{5,80})/gi,
    /perdemos (?:tempo|dinheiro|cliente) (?:com|por) ([^,.!?]{5,80})/gi,
];

const OBJECTION_PATTERNS = [
    /(?:muito caro|não temos orçamento|orçamento limitado|preço alto)/gi,
    /(?:já temos|já usamos|já trabalhamos com) ([^,.!?]{3,60})/gi,
    /(?:não é o momento|momento errado|agora não|vou pensar)/gi,
    /(?:preciso conversar|falar com|aprovação (?:do|da)) ([^,.!?]{3,60})/gi,
    /(?:não estou convencido|não ví valor|sem ROI)/gi,
];

const TICKET_PATTERNS = [
    /(?:€|EUR)\s*([\d.,]+)\s*(?:mil|k|\/m[eê]s)?/gi,
    /invest(?:imento|ir)\s+(?:de|em|até)\s+(€\s*[\d.,]+)/gi,
    /ticket\s+(?:médio|de)\s+(€\s*[\d.,]+)/gi,
];

const REVENUE_PATTERNS = [
    /faturamento\s+(?:de|é|é de|mensal de|anual de)\s+(€\s*[\d.,\s]+(?:mil|k|M|mi|bilh)?)/gi,
    /fatura\s+(€\s*[\d.,]+)/gi,
    /receita\s+(?:de|anual de|mensal de)\s+(€\s*[\d.,]+)/gi,
];

// ─────────────────────────────────────────────────────────────────────────────
// Extractor helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractMatches(text: string, patterns: RegExp[]): string[] {
    const found = new Set<string>();
    for (const pattern of patterns) {
        let match: RegExpExecArray | null;
        const re = new RegExp(pattern.source, pattern.flags);
        while ((match = re.exec(text)) !== null) {
            const captured = (match[1] ?? match[0]).trim().slice(0, 120);
            if (captured.length >= 5) found.add(captured);
        }
    }
    return [...found];
}

function parseMonetary(value: string): number | undefined {
    const cleaned = value.replace(/[€\s.]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return undefined;
    // If value looks like "5" but the original had "mil/k", multiply
    if (/mil|k\b/i.test(value)) return num * 1000;
    if (/\bM\b|mi\b|bilh/i.test(value)) return num * 1_000_000;
    return num;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: extract DNA from a message
// ─────────────────────────────────────────────────────────────────────────────

export function extractDnaFromMessage(text: string): Partial<LeadDna> {
    const timestamp = new Date().toISOString();
    const signals: DnaSignal[] = [];
    const pains: string[] = [];
    const objections: string[] = [];
    let avgTicket: number | undefined;
    let revenue: number | undefined;

    // Pains
    for (const pain of extractMatches(text, PAIN_PATTERNS)) {
        pains.push(pain);
        signals.push({ type: 'PAIN', value: pain, confidence: 0.75, extractedAt: timestamp });
    }

    // Objections
    for (const obj of extractMatches(text, OBJECTION_PATTERNS)) {
        objections.push(obj);
        signals.push({ type: 'OBJECTION', value: obj, confidence: 0.7, extractedAt: timestamp });
    }

    // Ticket
    const ticketMatches = extractMatches(text, TICKET_PATTERNS);
    if (ticketMatches.length > 0) {
        avgTicket = parseMonetary(ticketMatches[0]);
        if (avgTicket) {
            signals.push({
                type: 'TICKET',
                value: `€ ${avgTicket.toLocaleString('pt-PT')}`,
                confidence: 0.8,
                extractedAt: timestamp,
            });
        }
    }

    // Revenue
    const revenueMatches = extractMatches(text, REVENUE_PATTERNS);
    if (revenueMatches.length > 0) {
        revenue = parseMonetary(revenueMatches[0]);
        if (revenue) {
            signals.push({
                type: 'REVENUE',
                value: `€ ${revenue.toLocaleString('pt-PT')}`,
                confidence: 0.78,
                extractedAt: timestamp,
            });
        }
    }

    return { pains, objections, avgTicket, revenue, signals };
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist DNA to Upstash + Supabase
// ─────────────────────────────────────────────────────────────────────────────

export async function runLeadDnaAgent(params: {
    orgId: string;
    contactId: string;
    userMessage: string;
    existingDna?: LeadDna;
}): Promise<LeadDna> {
    const { orgId, contactId, userMessage, existingDna } = params;
    const now = new Date().toISOString();

    // Extract signals from this message
    const extracted = extractDnaFromMessage(userMessage);

    // Merge with existing DNA (deduplicate)
    const merged: LeadDna = {
        pains: [...new Set([...(existingDna?.pains ?? []), ...(extracted.pains ?? [])])],
        objections: [...new Set([...(existingDna?.objections ?? []), ...(extracted.objections ?? [])])],
        avgTicket: extracted.avgTicket ?? existingDna?.avgTicket,
        revenue: extracted.revenue ?? existingDna?.revenue,
        decisionMaker: existingDna?.decisionMaker,
        signals: [...(existingDna?.signals ?? []), ...(extracted.signals ?? [])].slice(-50),
        lastUpdated: now,
    };

    // Persist to Upstash (fast cache)
    try {
        await redis.set(leadDnaKey(orgId, contactId), merged, { ex: TTL.leadDna });
    } catch (err) {
        console.warn('[LeadDnaAgent] Upstash persist failed:', err);
    }

    // Persist to Supabase (durable store) — fire-and-forget
    persistDnaToSupabase({ orgId, contactId, dna: merged }).catch((err) => {
        console.error('[LeadDnaAgent] Supabase upsert failed:', err);
    });

    if (merged.pains.length > 0 || merged.objections.length > 0) {
        console.log('[LeadDnaAgent] 🧬 DNA extracted:', {
            pains: merged.pains.length,
            objections: merged.objections.length,
            hasTicket: !!merged.avgTicket,
            hasRevenue: !!merged.revenue,
        });
    }

    return merged;
}

async function persistDnaToSupabase(params: {
    orgId: string;
    contactId: string;
    dna: LeadDna;
}) {
    const supabase = createStaticAdminClient();
    const { orgId, contactId, dna } = params;

    await supabase.from('lead_dna').upsert(
        {
            organization_id: orgId,
            contact_id: contactId,
            pains: dna.pains,
            objections: dna.objections,
            avg_ticket: dna.avgTicket ?? null,
            revenue: dna.revenue ?? null,
            decision_maker: dna.decisionMaker ?? null,
            raw_signals: dna.signals,
            updated_at: dna.lastUpdated,
        },
        { onConflict: 'organization_id,contact_id' }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Load DNA from Upstash (for FrontendAgent context injection)
// ─────────────────────────────────────────────────────────────────────────────

export async function loadLeadDna(orgId: string, contactId: string): Promise<LeadDna | null> {
    try {
        return await redis.get<LeadDna>(leadDnaKey(orgId, contactId));
    } catch {
        return null;
    }
}
