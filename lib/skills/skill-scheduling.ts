/**
 * Skill: Scheduling
 * Handles meeting/appointment scheduling intentions.
 * Currently uses CRM activities as the scheduling backend.
 * Swap the `execute` body to connect a real calendar API (Google Calendar, Cal.com).
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';

export const schedulingSkill = {
    skillId: 'skill-scheduling',
    intentTags: ['SCHEDULING'],
    description: 'Creates and queries scheduled meetings/calls within the CRM',

    tools: {
        scheduleActivity: tool({
            description: 'Agenda uma atividade (reunião, call, follow-up) para um deal ou contato',
            inputSchema: z.object({
                dealId: z.string().optional().describe('ID do deal'),
                contactId: z.string().optional().describe('ID do contato'),
                organizationId: z.string(),
                title: z.string().min(1).describe('Título da atividade'),
                type: z.enum(['meeting', 'call', 'email', 'task', 'follow_up']).default('meeting'),
                scheduledFor: z.string().describe('Data/hora ISO 8601 da atividade'),
                notes: z.string().optional(),
            }),
            execute: async (params) => {
                const supabase = createStaticAdminClient();
                const { data, error } = await supabase
                    .from('activities')
                    .insert({
                        organization_id: params.organizationId,
                        deal_id: params.dealId ?? null,
                        contact_id: params.contactId ?? null,
                        title: params.title,
                        type: params.type,
                        date: params.scheduledFor,
                        notes: params.notes ?? null,
                        completed: false,
                    })
                    .select('id, title, date')
                    .single();

                if (error) return { success: false, error: error.message };
                return {
                    success: true,
                    message: `✅ Atividade "${data.title}" agendada para ${new Date(data.date).toLocaleString('pt-PT')}`,
                    activityId: data.id,
                };
            },
        }),

        listUpcomingActivities: tool({
            description: 'Lista atividades futuras para um deal ou organização',
            inputSchema: z.object({
                organizationId: z.string(),
                dealId: z.string().optional(),
                limit: z.number().int().positive().default(5),
            }),
            execute: async ({ organizationId, dealId, limit }) => {
                const supabase = createStaticAdminClient();
                let q = supabase
                    .from('activities')
                    .select('id, title, type, date, completed, deal:deals(title)')
                    .eq('organization_id', organizationId)
                    .eq('completed', false)
                    .gte('date', new Date().toISOString())
                    .order('date', { ascending: true })
                    .limit(limit);

                if (dealId) q = q.eq('deal_id', dealId);

                const { data, error } = await q;
                if (error) return { error: error.message };
                return {
                    count: data.length,
                    activities: data.map((a) => ({
                        id: a.id,
                        title: a.title,
                        type: a.type,
                        date: new Date(a.date).toLocaleString('pt-PT'),
                        deal: (a.deal as any)?.title ?? 'N/A',
                    })),
                };
            },
        }),
    },
};
