export type SequenceStatus = 'draft' | 'published' | 'archived';
export type StepKind = 'text' | 'image' | 'audio' | 'video' | 'document';

export type StepCfg =
  | { text: string; delayNextSeconds?: number }
  | { fileId: string; caption?: string; filename?: string; delayNextSeconds?: number };

export interface Sequence {
  id: string;
  org_id: string;
  name: string;
  channel: 'whatsapp';
  status: SequenceStatus;
  version: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  steps_count?: number;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  idx: number;
  kind: StepKind;
  cfg: StepCfg;
}

export interface SequenceWithSteps {
  sequence: Sequence;
  steps: SequenceStep[];
}
