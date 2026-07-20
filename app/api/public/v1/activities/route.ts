import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { decodeOffsetCursor, encodeOffsetCursor, parseLimit } from '@/lib/public-api/cursor';
import { sanitizeUUID } from '@/lib/supabase/utils';
import { normalizeText } from '@/lib/public-api/sanitize';

export const runtime = 'nodejs';

const ActivityCreateSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string().optional(), // ISO
  deal_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  client_company_id: z.string().uuid().optional(),
}).strict();

export async function GET(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const url = new URL(request.url);
  const dealId = sanitizeUUID(url.searchParams.get('deal_id'));
  const contactId = sanitizeUUID(url.searchParams.get('contact_id'));
  const clientCompanyId = sanitizeUUID(url.searchParams.get('client_company_id'));
  const type = (url.searchParams.get('type') || '').trim();
  const limit = parseLimit(url.searchParams.get('limit'));
  const offset = decodeOffsetCursor(url.searchParams.get('cursor'));

  const sb = createStaticAdminClient();
  let query = sb
    .from('activities')
    .select('id,title,description,type,date,completed,deal_id,contact_id,client_company_id,created_at', { count: 'exact' })
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  if (dealId) query = query.eq('deal_id', dealId);
  if (contactId) query = query.eq('contact_id', contactId);
  if (clientCompanyId) query = query.eq('client_company_id', clientCompanyId);
  if (type) query = query.eq('type', type);

  const from = offset;
  const to = offset + limit - 1;
  const { data, count, error } = await query.range(from, to);
  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });

  const total = count ?? 0;
  const nextOffset = to + 1;
  const nextCursor = nextOffset < total ? encodeOffsetCursor(nextOffset) : null;

  return NextResponse.json({
    data: (data || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description ?? null,
      type: a.type,
      date: a.date,
      completed: !!a.completed,
      deal_id: a.deal_id ?? null,
      contact_id: a.contact_id ?? null,
      client_company_id: a.client_company_id ?? null,
      created_at: a.created_at,
    })),
    nextCursor,
  });
}

export async function POST(request: Request) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = ActivityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const now = new Date();
  const date = parsed.data.date ? new Date(parsed.data.date) : now;
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();

  // FKs opcionais vêm do body — confirmar que cada uma pertence a esta organização
  const dealId = sanitizeUUID(parsed.data.deal_id) || null;
  if (dealId) {
    const { data: dealCheck, error: dealCheckError } = await sb
      .from('deals')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('id', dealId)
      .is('deleted_at', null)
      .maybeSingle();
    if (dealCheckError) return NextResponse.json({ error: dealCheckError.message, code: 'DB_ERROR' }, { status: 500 });
    if (!dealCheck) return NextResponse.json({ error: 'Deal not found', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const contactId = sanitizeUUID(parsed.data.contact_id) || null;
  if (contactId) {
    const { data: contactCheck, error: contactCheckError } = await sb
      .from('contacts')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('id', contactId)
      .is('deleted_at', null)
      .maybeSingle();
    if (contactCheckError) return NextResponse.json({ error: contactCheckError.message, code: 'DB_ERROR' }, { status: 500 });
    if (!contactCheck) return NextResponse.json({ error: 'Contact not found', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const clientCompanyId = sanitizeUUID(parsed.data.client_company_id) || null;
  if (clientCompanyId) {
    const { data: companyCheck, error: companyCheckError } = await sb
      .from('crm_companies')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .eq('id', clientCompanyId)
      .is('deleted_at', null)
      .maybeSingle();
    if (companyCheckError) return NextResponse.json({ error: companyCheckError.message, code: 'DB_ERROR' }, { status: 500 });
    if (!companyCheck) return NextResponse.json({ error: 'Client company not found', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const insertPayload: any = {
    organization_id: auth.organizationId,
    title: normalizeText(parsed.data.title) || parsed.data.title,
    description: normalizeText(parsed.data.description),
    type: normalizeText(parsed.data.type) || parsed.data.type,
    date: date.toISOString(),
    completed: false,
    deal_id: dealId,
    contact_id: contactId,
    client_company_id: clientCompanyId,
    created_at: now.toISOString(),
  };

  const { data, error } = await sb
    .from('activities')
    .insert(insertPayload)
    .select('id,title,description,type,date,completed,deal_id,contact_id,client_company_id,created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  return NextResponse.json({ data, action: 'created' }, { status: 201 });
}

