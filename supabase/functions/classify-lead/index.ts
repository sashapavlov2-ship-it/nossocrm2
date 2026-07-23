/**
 * ⚠️ STALE — confirmar projeto-alvo antes de deployar. A versão viva está no
 * projeto DS Auto (gfaanktelakrxbrlqpvq) v8 com verify_jwt=true no gateway.
 * NÃO está deployada no projeto nossocrm (utnwchsyfmdxsgxbgurk). Verificado 23/07.
 *
 * classify-lead — Edge Function de classificação de leads.
 *
 * Recebe contact_id + organization_id, lê dados do lead (contact,
 * lead_dna, atividades recentes), chama IA e persiste o resultado
 * (lead_temperature, lead_score) em contacts.
 *
 * Chamado por:
 *   - webhook-in (após criar deal, best-effort)
 *   - API route /api/ai/classify-lead (frontend / n8n on-demand)
 *   - James IA via tool classifyLead
 *
 * Auth: X-Webhook-Secret ou Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Webhook-Secret, Authorization",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type Temperature = "QUENTE" | "MORNO" | "FRIO" | "PERDIDO";

interface ClassificationResult {
  temperature: Temperature;
  score: number; // 0–100
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
  enrichmentData: Record<string, unknown> | null;
}): Promise<ClassificationResult> {
  const apiKey =
    Deno.env.get("GOOGLE_GEMINI_API_KEY") ??
    Deno.env.get("GOOGLE_AI_API_KEY") ??
    Deno.env.get("GEMINI_API_KEY");

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  const prompt = `Classifica este lead de CRM e devolve APENAS JSON válido.

LEAD:
- Nome: ${context.contactName}
- Email: ${context.email ?? "não fornecido"}
- Telefone: ${context.phone ?? "não fornecido"}
- Origem: ${context.source ?? "desconhecida"}
- Último contacto: ${context.lastInteraction ?? "nunca"}
- Valor total histórico: €${context.totalValue}
- Dores identificadas: ${context.pains.length > 0 ? context.pains.join(", ") : "nenhuma"}
- Objeções identificadas: ${context.objections.length > 0 ? context.objections.join(", ") : "nenhuma"}
- Atividades recentes (últimas 5): ${context.recentActivities.length > 0 ? context.recentActivities.join(" | ") : "nenhuma"}

CRITÉRIOS DE CLASSIFICAÇÃO:
- QUENTE (score 70-100): respondeu recentemente, pediu proposta/orçamento, sem objeções fortes, valor alto, interesse explícito
- MORNO (score 40-69): algum interesse mas hesitante, objeções menores, contacto esporádico
- FRIO (score 10-39): pouco engagement, muito tempo sem contacto, sem sinais de interesse
- PERDIDO (score 0-9): cancelou, escolheu concorrente, sem resposta prolongada, desinteresse explícito

Responde APENAS com este JSON (sem markdown, sem texto extra):
{
  "temperature": "QUENTE" | "MORNO" | "FRIO" | "PERDIDO",
  "score": number (0-100),
  "reasoning": "explicação curta em português (1-2 frases)",
  "signals": ["sinal positivo ou negativo identificado", ...]
}`;

  // Tenta Gemini primeiro, fallback para Anthropic
  if (apiKey) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned) as ClassificationResult;
    }
  }

  if (anthropicKey) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const text: string = data?.content?.[0]?.text ?? "";
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      return JSON.parse(cleaned) as ClassificationResult;
    }
  }

  // Fallback heurístico se não há chave de IA
  const daysSinceContact = context.lastInteraction
    ? Math.floor((Date.now() - new Date(context.lastInteraction).getTime()) / 86400000)
    : 999;

  const hasPains = context.pains.length > 0;
  const hasObjections = context.objections.length > 0;
  const hasActivities = context.recentActivities.length > 0;

  let score = 30; // base FRIO
  if (daysSinceContact < 3) score += 40;
  else if (daysSinceContact < 7) score += 25;
  else if (daysSinceContact < 30) score += 10;
  if (hasPains) score += 15;
  if (hasObjections) score -= 20;
  if (hasActivities) score += 10;
  if (context.totalValue > 0) score += 5;
  score = Math.max(0, Math.min(100, score));

  const temperature: Temperature =
    score >= 70 ? "QUENTE" : score >= 40 ? "MORNO" : score >= 10 ? "FRIO" : "PERDIDO";

  return {
    temperature,
    score,
    reasoning: "Classificação heurística (sem chave IA configurada).",
    signals: [
      `Último contacto há ${daysSinceContact} dias`,
      hasPains ? "Dores identificadas" : "Sem dores registadas",
      hasObjections ? "Objeções presentes" : "Sem objeções",
    ],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("CRM_SUPABASE_SECRET_KEY") ??
    Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Supabase não configurado" });
  }

  // Fail-closed: esta função usa service_role (bypassa RLS) e recebe a organização
  // no body — sem autenticação seria um IDOR (classificar leads de qualquer org).
  // O único chamador interno (webhook-in) envia Authorization: Bearer <serviceKey>.
  // Aceitar também X-Webhook-Secret para chamadas externas autorizadas (n8n).
  const authHeader = req.headers.get("Authorization") ?? "";
  const webhookSecret = Deno.env.get("CLASSIFY_LEAD_WEBHOOK_SECRET") ?? "";
  const xSecret = req.headers.get("X-Webhook-Secret") ?? "";
  const authOk =
    authHeader === `Bearer ${serviceKey}` ||
    (webhookSecret.length > 0 && xSecret === webhookSecret);
  if (!authOk) {
    return json(401, { error: "unauthorized" });
  }

  let body: { contact_id?: string; organization_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  const { contact_id, organization_id } = body;
  if (!contact_id || !organization_id) {
    return json(400, { error: "contact_id e organization_id são obrigatórios" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1) Buscar dados do contacto
  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id, name, email, phone, source, last_interaction, total_value, enrichment_data")
    .eq("id", contact_id)
    .eq("organization_id", organization_id)
    .maybeSingle();

  if (contactErr || !contact) {
    return json(404, { error: "Contacto não encontrado" });
  }

  // 2) Buscar lead_dna
  const { data: dna } = await supabase
    .from("lead_dna")
    .select("pains, objections, raw_signals")
    .eq("contact_id", contact_id)
    .eq("organization_id", organization_id)
    .maybeSingle();

  // 3) Buscar atividades recentes (últimas 5)
  const { data: activities } = await supabase
    .from("activities")
    .select("title, type, date, completed")
    .eq("contact_id", contact_id)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(5);

  const recentActivities = (activities ?? []).map(
    (a: { title: string; type: string; date: string; completed: boolean }) =>
      `[${a.type}] ${a.title} em ${new Date(a.date).toLocaleDateString("pt-PT")} (${a.completed ? "feita" : "pendente"})`
  );

  // 4) Classificar com IA
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
      enrichmentData: contact.enrichment_data ?? null,
    });
  } catch (err) {
    return json(500, { error: "Falha na classificação IA", details: String(err) });
  }

  // 5) Persistir no contacto
  const { error: updateErr } = await supabase
    .from("contacts")
    .update({
      lead_temperature: result.temperature,
      lead_score: result.score,
      lead_classified_at: new Date().toISOString(),
    })
    .eq("id", contact_id)
    .eq("organization_id", organization_id);

  if (updateErr) {
    return json(500, { error: "Falha ao guardar classificação", details: updateErr.message });
  }

  return json(200, {
    ok: true,
    contact_id,
    temperature: result.temperature,
    score: result.score,
    reasoning: result.reasoning,
    signals: result.signals,
  });
});
