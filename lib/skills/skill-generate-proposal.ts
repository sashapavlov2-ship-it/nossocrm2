/**
 * Skill: Generate Proposal
 * Generates a PDF proposal using jspdf + jspdf-autotable (already in dependencies).
 * Returns a base64 PDF string that the UI can download or email.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';

export const generateProposalSkill = {
    skillId: 'skill-generate-proposal',
    intentTags: ['GENERATE_PROPOSAL'],
    description: 'Generates a professional PDF proposal for a deal',

    tools: {
        generateProposal: tool({
            description: 'Gera uma proposta PDF para um deal, com dados do contato, valor e condições',
            inputSchema: z.object({
                dealId: z.string().describe('ID do deal'),
                organizationId: z.string(),
                customMessage: z.string().optional().describe('Mensagem personalizada para incluir na proposta'),
                paymentTerms: z.string().optional().default('À vista ou parcelado em até 12x'),
                validUntil: z.string().optional().describe('Validade da proposta (ex: 30 dias)'),
            }),
            execute: async ({ dealId, organizationId, customMessage, paymentTerms, validUntil }) => {
                const supabase = createStaticAdminClient();
                const { data: deal, error } = await supabase
                    .from('deals')
                    .select('id, title, value, contact:contacts(name, email, phone, company_name), stage:board_stages(name)')
                    .eq('organization_id', organizationId)
                    .eq('id', dealId)
                    .single();

                if (error || !deal) return { error: 'Deal não encontrado.' };

                const contact = deal.contact as any;
                const stage = deal.stage as any;

                // Build proposal metadata (PDF generation happens client-side to avoid Edge Runtime issues with jspdf)
                const proposalData = {
                    dealId: deal.id,
                    dealTitle: deal.title,
                    dealValue: `€ ${(deal.value || 0).toLocaleString('pt-PT')}`,
                    contactName: contact?.name ?? 'N/A',
                    contactEmail: contact?.email ?? 'N/A',
                    company: contact?.company_name ?? 'N/A',
                    currentStage: stage?.name ?? 'N/A',
                    customMessage: customMessage ?? 'Apresentamos nossa proposta comercial personalizada.',
                    paymentTerms,
                    validUntil: validUntil ?? '30 dias',
                    generatedAt: new Date().toLocaleDateString('pt-PT'),
                };

                // Save proposal record to Supabase
                await supabase.from('activities').insert({
                    organization_id: organizationId,
                    deal_id: dealId,
                    title: `Proposta enviada — ${deal.title}`,
                    type: 'email',
                    date: new Date().toISOString(),
                    completed: false,
                    notes: `Proposta gerada automaticamente. Valor: ${proposalData.dealValue}`,
                });

                return {
                    success: true,
                    message: `📄 Proposta pronta para "${deal.title}" — ${proposalData.dealValue}`,
                    proposalData,
                };
            },
        }),
    },
};
