import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authPublicApi } from '@/lib/public-api/auth';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { isValidUUID, sanitizeUUID } from '@/lib/supabase/utils';
import { normalizeText } from '@/lib/public-api/sanitize';

export const runtime = 'nodejs';

const DealPatchSchema = z.object({
  title: z.string().optional(),
  value: z.number().optional(),
  contact_id: z.string().uuid().optional(),
  client_company_id: z.string().uuid().nullable().optional(),
  loss_reason: z.string().nullable().optional(),
}).strict();

export async function GET(request: Request, ctx: { params: Promise<{ dealId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await ctx.params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();
  const { data, error } = await sb
    .from('deals')
    .select('id,title,value,board_id,stage_id,contact_id,client_company_id,is_won,is_lost,loss_reason,closed_at,created_at,updated_at')
    .eq('organization_id', auth.organizationId)
    .is('deleted_at', null)
    .eq('id', dealId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({ data });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ dealId: string }> }) {
  const auth = await authPublicApi(request);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const { dealId } = await ctx.params;
  if (!isValidUUID(dealId)) {
    return NextResponse.json({ error: 'Invalid deal id', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const body = await request.json().catch(() => null);
  const parsed = DealPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const sb = createStaticAdminClient();

  const updates: any = {};
  if (parsed.data.title !== undefined) updates.title = normalizeText(parsed.data.title);
  if (parsed.data.value !== undefined) updates.value = Number(parsed.data.value ?? 0);
  if (parsed.data.contact_id !== undefined) {
    const cid = sanitizeUUID(parsed.data.contact_id);
    if (cid) {
      const contactCheck = await sb
        .from('contacts')
        .select('id')
        .eq('organization_id', auth.organizationId)
        .eq('id', cid)
        .is('deleted_at', null)
        .maybeSingle();
      if (contactCheck.error) return NextResponse.json({ error: contactCheck.error.message, code: 'DB_ERROR' }, { status: 500 });
      if (!contactCheck.data) return NextResponse.json({ error: 'Contact not found', code: 'VALIDATION_ERROR' }, { status: 422 });
    }
    updates.contact_id = cid;
  }
  if (parsed.data.client_company_id !== undefined) {
    const cid = parsed.data.client_company_id === null ? null : (sanitizeUUID(parsed.data.client_company_id) || null);
    if (cid) {
      const companyCheck = await sb
        .from('crm_companies')
        .select('id')
        .eq('organization_id', auth.organizationId)
        .eq('id', cid)
        .is('deleted_at', null)
        .maybeSingle();
      if (companyCheck.error) return NextResponse.json({ error: companyCheck.error.message, code: 'DB_ERROR' }, { status: 500 });
      if (!companyCheck.data) return NextResponse.json({ error: 'Client company not found', code: 'VALIDATION_ERROR' }, { status: 422 });
    }
    updates.client_company_id = cid;
  }
  if (parsed.data.loss_reason !== undefined) updates.loss_reason = parsed.data.loss_reason === null ? null : normalizeText(parsed.data.loss_reason);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await sb
    .from('deals')
    .update(updates)
    .eq('organization_id', auth.organizationId)
    .eq('id', dealId)
    .select('id,title,value,board_id,stage_id,contact_id,client_company_id,is_won,is_lost,loss_reason,closed_at,created_at,updated_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message, code: 'DB_ERROR' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Deal not found', code: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({ data });
}

