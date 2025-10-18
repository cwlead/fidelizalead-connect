export interface Organization {
  id: string;
  name: string;
  segmento?: string;
  features?: Record<string, any>;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  name?: string;
  role: string;
  created_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  phone_e164?: string;
  email?: string;
  name?: string;
  tags?: string;
  consent_at?: string;
  optout_at?: string;
  origin?: string;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  segment?: Record<string, any>;
  status: string;
  channel?: string;
  created_by?: string;
  created_at: string;
}

export interface Sequence {
  id: string;
  org_id: string;
  name: string;
  schedule?: Record<string, any>;
  active: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  org_id: string;
  contact_id?: string;
  campaign_id?: string;
  sequence_id?: string;
  template?: string;
  direction: string;
  status: string;
  provider_msg_id?: string;
  payload?: Record<string, any>;
  ts: string;
}

export interface Integration {
  id: string;
  org_id: string;
  kind: string;
  config?: Record<string, any>;
  active: boolean;
  created_at: string;
}

export interface LoyaltyPoints {
  org_id: string;
  contact_id: string;
  balance: number;
  tier: string;
  updated_at: string;
}

export interface Voucher {
  id: string;
  org_id: string;
  contact_id?: string;
  campaign_id?: string;
  code: string;
  kind: string;
  value: number;
  currency_code: string;
  expires_at?: string;
  redeemed_at?: string;
  redeemed_channel?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface RankTier {
  org_id: string;
  code: string;
  min_purchases: number;
  max_purchases?: number;
}

export interface ContactRank {
  org_id: string;
  contact_id: string;
  purchases_count: number;
  rank_code?: string;
  computed_at: string;
}

export interface WhatsAppGroup {
  id: string;
  org_id: string;
  integration_id?: string;
  wa_group_id: string;
  name?: string;
  subject?: string;
  invite_link?: string;
  is_active: boolean;
  last_sync_at?: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  org_id: string;
  group_id: string;
  contact_id?: string;
  wa_user_id?: string;
  role?: string;
  is_member: boolean;
  first_join_at?: string;
  last_join_at?: string;
  left_at?: string;
  last_seen_at?: string;
  source?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  organization: Organization;
}
