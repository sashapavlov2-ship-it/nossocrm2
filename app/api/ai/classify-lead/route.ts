/**
 * POST /api/ai/classify-lead
 *
 * Classifica um lead (QUENTE / MORNO / FRIO / PERDIDO) com score 0–100.
 * Lê dados do contacto + lead_dna + atividades recentes e persiste em contacts.
 *
 * Chamado por:
 *   - n8n (webhook após lead entrar)
 *   - Frontend (botão "Classificar" no detalhe do contacto)
 *   - James IA via tool classifyLead
 *
 * Auth: Supabase session (cookie) OU API key no header X-Api-Key.
 *
 * Body: { contact_id: string, organization_id?: string }
 * Response: { temperature, score, reasoning, signals }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { authPublicApi } from '@/lib/public-api/auth';

export const maxDuration = 30;

type Temperature = 'QUENTE' | 'MORNO' | 'FRIO' | 'PERDIDO';

interface ClassificationResult {
    temperature: Temperature;
    score: number;
    reasoning: string;
    signals: string[];
}

async function classifyWithAI(context: {
    contactName: string;
    email: string | null;
    phone: string | null;
    source: string | null;
    lastInteraction: string | null;
    totalValue: number;
    pains: string[];
    objections: string[];
    recentActivities: string[];
}): Promise<ClassificationResult> {
    const prompt = `Classifica este lead de CRM e devolve APENAS JSON válido (sem markdown).

LEAD:
- Nome: ${context.contactName}
- Email: ${context.email ?? 'não fornecido'}
- Telefone: ${context.phone ?? 'não fornecido'}
- Origem: ${context.source ?? 'desconhecida'}
- Último contacto: ${context.lastInteraction ? new Date(context.lastInteraction).toLocaleDateString('pt-PT') : 'nunca'}
- Valor total histórico: €${context.totalValue}
- Dores identificadas: ${context.pains.length > 0 ? context.pains.join(', ') : 'nenhuma'}
- Objeções identificadas: ${context.objections.length > 0 ? context.objections.join(', ') : 'nenhuma'}
- Atividades recentes: ${context.recentActivities.length > 0 ? context.recentActivities.join(' | ') : 'nenhuma'}

CRITÉRIOS:
- QUENTE (70-100): respondeu recentemente, pediu proposta, interesse explícito, sem objeções fortes
- MORNO (40-69): algum interesse mas hesitante, objeções menores, contacto esporádico
- FRIO (10-39): pouco engagement, muito tempo sem contacto, sem sinais claros
- PERDIDO (0-9): cancelou, escolheu concorrente, sem resposta há muito tempo

JSON esperado:
{"temperature":"QUENTE"|"MORNO"|"FRIO"|"PERDIDO","score":0-100,"reasoning":"1-2 frases em português","signals":["sinal1","sinal2"]}`;

    // Tenta Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                messages: [{ role: 'user', content: prompt }],
            }),
        });
        if (resp.ok) {
            const data = await resp.json();
            const text: string = data?.content?.[0]?.text ?? '';
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned) as ClassificationResult;
        }
    }

    // Tenta Gemini
    const geminiKey = process.env.GOOGLE_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (geminiKey) {
        const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
                }),
            }
        );
        if (resp.ok) {
            const data = await resp.json();
            const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleaned) as ClassificationResult;
        }
    }

    // Fallback heurístico
    const daysSince = context.lastInteraction
        ? Math.floor((Date.now() - new Date(context.lastInteraction).getTime()) / 86400000)
        : 999;

    let score = 30;
    if (daysSince < 3) score += 40;
    else if (daysSince < 7) score += 25;
    else if (daysSince < 30) score += 10;
    if (context.pains.length > 0) score += 15;
    if (context.objections.length > 0) score -= 20;
    if (context.recentActivities.length > 0) score += 10;
    if (context.totalValue > 0) score += 5;
    score = Math.max(0, Math.min(100, score));

    const temperature: Temperature =
        score >= 70 ? 'QUENTE' : score >= 40 ? 'MORNO' : score >= 10 ? 'FRIO' : 'PERDIDO';

    return {
        temperature,
        score,
        reasoning: 'Classificação heurística (sem chave IA configurada).',
        signals: [`Último contacto há ${daysSince} dias`, ...context.pains.slice(0, 2)],
    };
}

export async function POST(req: NextRequest) {
    let body: { contact_id?: string; organization_id?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const { contact_id } = body;
    if (!contact_id) {
        return NextResponse.json({ error: 'contact_id é obrigatório' }, { status: 400 });
    }

    // Auth (fail-closed): sessão de utilizador OU x-api-key válida. A organização
    // deriva SEMPRE do principal autenticado, nunca do body — caso contrário
    // qualquer request escolhia a org e ganhava service role (IDOR).
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    let supabase;
    let organizationId: string | undefined;

    // Chamada interna confiável (James IA via tool classifyLead corre server-side,
    // sem cookie): Authorization: Bearer <INTERNAL_API_SECRET>. O secret é server-only
    // (nunca chega ao browser) e a org vem do body, que aqui é confiável porque foi
    // resolvida a partir da sessão autenticada no contexto que invocou a tool.
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const authHeader = req.headers.get('authorization') ?? '';
    const isInternalCall =
        !!internalSecret && authHeader === `Bearer ${internalSecret}`;

    if (isInternalCall) {
        supabase = createStaticAdminClient();
        organizationId = body.organization_id;
    } else if (user) {
        supabase = supabaseSession;
        const { data: member } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();
        organizationId = member?.organization_id;
    } else {
        // Sem sessão nem secret interno: exigir API key válida (n8n / integrações).
        // A org vem da key, nunca do body.
        const auth = await authPublicApi(req);
        if (!auth.ok) {
            return NextResponse.json(auth.body, { status: auth.status });
        }
        supabase = createStaticAdminClient();
        organizationId = auth.organizationId;
    }

    if (!organizationId) {
        return NextResponse.json({ error: 'organization_id não encontrado' }, { status: 400 });
    }

    // 1) Dados do contacto
    const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .select('id, name, email, phone, source, last_interaction, total_value')
        .eq('id', contact_id)
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (contactErr || !contact) {
        return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 });
    }

    // 2) Lead DNA
    const { data: dna } = await supabase
        .from('lead_dna')
        .select('pains, objections')
        .eq('contact_id', contact_id)
        .eq('organization_id', organizationId)
        .maybeSingle();

    // 3) Atividades recentes
    const { data: activities } = await supabase
        .from('activities')
        .select('title, type, date, completed')
        .eq('contact_id', contact_id)
        .is('deleted_at', null)
        .order('date', { ascending: false })
        .limit(5);

    const recentActivities = (activities ?? []).map(
        (a: { title: string; type: string; date: string; completed: boolean }) =>
            `[${a.type}] ${a.title} (${a.completed ? 'feita' : 'pendente'})`
    );

    // 4) Classificar
    let result: ClassificationResult;
    try {
        result = await classifyWithAI({
            contactName: contact.name,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            source: contact.source ?? null,
            lastInteraction: contact.last_interaction ?? null,
            totalValue: Number(contact.total_value ?? 0),
            pains: dna?.pains ?? [],
            objections: dna?.objections ?? [],
            recentActivities,
        });
    } catch (err) {
        return NextResponse.json({ error: 'Falha na classificação', details: String(err) }, { status: 500 });
    }

    // 5) Persistir
    const { error: updateErr } = await supabase
        .from('contacts')
        .update({
            lead_temperature: result.temperature,
            lead_score: result.score,
            lead_classified_at: new Date().toISOString(),
        })
        .eq('id', contact_id)
        .eq('organization_id', organizationId);

    if (updateErr) {
        return NextResponse.json({ error: 'Falha ao guardar classificação' }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        contact_id,
        temperature: result.temperature,
        score: result.score,
        reasoning: result.reasoning,
        signals: result.signals,
    });
}
