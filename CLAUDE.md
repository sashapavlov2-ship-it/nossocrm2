# CLAUDE.md — NossoCRM

## Objectivo
CRM inteligente para equipas de vendas com pipeline Kanban, gestão de contactos e AI assistant.
Versão adaptada para Portugal: moeda em Euros (€), locale pt-PT.

## Stack Tecnológica
- **Frontend:** Next.js 15 + React + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes + Supabase (PostgreSQL)
- **AI:** Google Gemini / OpenAI GPT-4 / Anthropic Claude
- **Deploy:** Vercel
- **Auth:** Supabase Auth

## Estrutura de Ficheiros
```
app/              → Rotas Next.js (App Router)
features/         → Módulos principais (deals, contacts, inbox, boards, reports...)
components/       → Componentes reutilizáveis
lib/              → Utilitários, AI, Supabase client
hooks/            → Custom React hooks
types/            → TypeScript types
supabase/         → Migrations e config
```

## Funcionalidades
- [x] Pipeline Kanban de deals
- [x] Gestão de contactos
- [x] AI Assistant (James IA)
- [x] Inbox inteligente com briefing diário
- [x] Relatórios e métricas
- [x] Catálogo de produtos
- [x] Webhook integrations
- [x] Multi-tenant (isolamento por organização)
- [x] Moeda alterada de BRL (R$) para EUR (€)
- [x] Locale alterado de pt-BR para pt-PT

## Modelo de Multi-Tenant (isolamento por organização)
Verificado diretamente na BD de produção (`utnwchsyfmdxsgxbgurk`) em 2026-07-20.

- **Mecanismo real:** RLS em todas as tabelas relevantes, policy `org_isolation` com
  `organization_id = current_org_id()`. `current_org_id()` é `SECURITY DEFINER` mas só
  faz `SELECT organization_id FROM profiles WHERE id = auth.uid()` — deriva sempre do
  JWT da sessão, nunca de um parâmetro. Ver a função para o texto exato.
- **RPCs `SECURITY DEFINER` que fazem UPDATE (`mark_deal_won`, `mark_deal_lost`,
  `reopen_deal`):** o filtro de tenant tem de estar DENTRO da função
  (`where id = deal_id and organization_id = current_org_id()`), nunca só na API route
  do Next.js por cima — SECURITY DEFINER bypassa RLS, e o cliente Supabase pode chamar
  a RPC diretamente, saltando a API route. Qualquer RPC nova que mexa em `deals` (ou
  outra tabela com tenant) tem de seguir este padrão desde o commit inicial.
- **Exceções corretas (não mexer):** `lifecycle_stages` é enum global do sistema
  (Lead/MQL/Oportunidade/Cliente), sem `organization_id`, sem dados sensíveis — fica
  aberta. Tabelas `own_user` (`ai_conversations`, `ai_decisions`, `user_settings`, etc.)
  isolam por `user_id = auth.uid()`, não por organização — correto, são dados pessoais.
- **Histórico:** o `schema_init.sql` original (dez/2025) tinha `USING (true)` nestas
  tabelas (cross-tenant total). Foi corrigido em produção por migrations remotas
  (jun/jul 2026) que nunca desceram para o repo — o ficheiro base foi reescrito
  em 2026-07-20 para já nascer correto (função `current_org_id()` definida logo após
  `profiles`, todas as policies com `org_isolation` desde a origem); o
  `20260720193424_sync_tenant_isolation_from_prod.sql` fica só como registo histórico
  (já consta no histórico de migrations do Supabase, não se apaga). Mesmo assim, antes
  de confiar no repo sobre o estado de segurança, correr
  `SELECT tablename, policyname, qual FROM pg_policies WHERE schemaname='public'`
  contra o projeto real e comparar — código no disco pode voltar a divergir se alguém
  aplicar um fix direto no dashboard outra vez.
- **Rotas `/api/public/v1/**` (18/18 verificadas, 2026-07-20):** `organizationId` deriva
  só do RPC `validate_api_key(token)` via header `x-api-key` — sem vetor de manipulação.
  Todas as rotas de dados filtram `organization_id = auth.organizationId` antes de ler
  ou alterar recursos. Duas fragilidades menores, não exploráveis hoje:
  (1) `activities`/`deals` POST não verificam que FKs opcionais vindas do body
  (`deal_id`, `contact_id`, `board_id`, etc.) pertencem à mesma organização antes do
  insert — cria referência "pendurada", mas não há leitura cross-tenant depois porque
  todo GET já filtra por organização; (2) `contacts`/`companies` POST (branch de update)
  não repetem o filtro `organization_id` no update final, confiando que o `id` já veio
  de uma lookup filtrada — seguro enquanto essa dependência não for quebrada por uma
  refatoração futura.

## Decisões Técnicas
- Moeda: EUR com `Intl.NumberFormat('pt-PT', { currency: 'EUR' })`
- Speech recognition: `pt-PT`
- Datas: mantido `pt-PT` (mesmo formato dd/mm/yyyy)

## Comandos
```bash
npm run dev       # Desenvolvimento local (porta 3000)
npm run build     # Build de produção
npm run lint      # Lint
npm test          # Testes (Vitest)
```

## Deploy (Vercel)
1. Push para GitHub
2. Conectar repo no Vercel
3. Correr wizard em `/install` com credenciais Supabase

## Variáveis de Ambiente Necessárias
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
GOOGLE_GEMINI_API_KEY=   (opcional)
OPENAI_API_KEY=          (opcional)
ANTHROPIC_API_KEY=       (opcional)
```
