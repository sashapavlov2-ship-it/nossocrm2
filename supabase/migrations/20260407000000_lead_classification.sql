-- ============================================================
-- Lead Classification Migration
-- Adds lead_temperature + lead_score to contacts
-- ============================================================

ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS lead_temperature TEXT DEFAULT 'FRIO'
        CHECK (lead_temperature IN ('QUENTE', 'MORNO', 'FRIO', 'PERDIDO')),
    ADD COLUMN IF NOT EXISTS lead_score NUMERIC(5,2) DEFAULT 0
        CHECK (lead_score >= 0 AND lead_score <= 100),
    ADD COLUMN IF NOT EXISTS lead_classified_at TIMESTAMPTZ;

-- Indexes for filtering/sorting
CREATE INDEX IF NOT EXISTS contacts_lead_temperature_idx
    ON public.contacts (organization_id, lead_temperature)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_lead_score_idx
    ON public.contacts (organization_id, lead_score DESC)
    WHERE deleted_at IS NULL;
