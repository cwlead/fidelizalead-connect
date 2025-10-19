-- CreateTable: org_settings
CREATE TABLE IF NOT EXISTS org_settings (
  org_id UUID PRIMARY KEY REFERENCES core_orgs(id) ON DELETE CASCADE,
  primary_identifier TEXT CHECK (primary_identifier IN ('email', 'phone', 'cpf')),
  erp_slug TEXT,
  erp_base_url TEXT,
  botconversa_api_key TEXT,
  evolution_instance_name TEXT,
  evolution_webhook_url TEXT,
  evolution_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_settings_org_id ON org_settings(org_id);
