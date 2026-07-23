/**
 * telegram-callback — recebe callback_query dos botões inline do Telegram.
 * Quando o utilizador carrega em "Contactado", actualiza contacted_at no Supabase
 * e responde ao Telegram para remover o ícone de loading.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
// Secret partilhado com o Telegram: definido ao registar o webhook via setWebhook
// (parâmetro secret_token) e reenviado pelo Telegram no header abaixo. Sem isto,
// qualquer POST forjado consegue marcar leads como contactados.
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function answerCallback(callbackQueryId: string, text: string, showAlert = false) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert }),
  });
}

async function editMessage(chatId: string, messageId: number, newText: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      reply_markup: JSON.stringify({ inline_keyboard: [] }), // remove botões
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Fail-closed: sem secret configurado, ninguém entra (evita callbacks forjados).
  if (!TELEGRAM_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
    return json(500, { error: "not configured" });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== TELEGRAM_WEBHOOK_SECRET) {
    return json(401, { error: "unauthorized" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(200, { ok: true }); // Telegram exige sempre 200
  }

  const cb = (body as any).callback_query;
  if (!cb) return json(200, { ok: true });

  const data: string = cb.data || "";
  const underscoreIdx = data.indexOf("_");
  const action = data.substring(0, underscoreIdx);
  const lead_id = data.substring(underscoreIdx + 1);
  const callbackQueryId: string = cb.id;
  const chatId: string = String(cb.message?.chat?.id || "");
  const messageId: number = cb.message?.message_id;
  const originalText: string = cb.message?.text || "";

  if (action === "contactado" && lead_id && !lead_id.startsWith("demo")) {
    const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
    const serviceKey =
      Deno.env.get("CRM_SUPABASE_SECRET_KEY") ??
      Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      await supabase
        .from("qualified_leads")
        .update({ contacted_at: new Date().toISOString() })
        .eq("id", lead_id);
    }
    await answerCallback(callbackQueryId, "Marcado como contactado!", true);
    await editMessage(chatId, messageId, "CONTACTADO - " + new Date().toLocaleString("pt-PT") + "\n\n" + originalText);
  } else if (action === "ignorar") {
    await answerCallback(callbackQueryId, "OK, ignorado.", false);
    await editMessage(chatId, messageId, "IGNORADO\n\n" + originalText);
  } else if (action === "contactado" && lead_id.startsWith("demo")) {
    // mensagem de teste
    await answerCallback(callbackQueryId, "Teste OK! Nos leads reais marca como contactado.", true);
    await editMessage(chatId, messageId, "TESTE - funcionou!\n\n" + originalText);
  } else {
    await answerCallback(callbackQueryId, "OK", false);
  }

  return json(200, { ok: true });
});
