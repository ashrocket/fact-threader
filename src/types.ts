export type Environment = Omit<CloudflareBindings, 'APP_ORIGIN' | 'THREADS_APP_ID' | 'OAUTH_ENABLED' | 'PUBLISHING_ENABLED' | 'APP_REVIEW_APPROVED' | 'PLATFORM_POLICY_APPROVED' | 'CORPUS_APPROVED'> & {
  APP_ORIGIN: string; THREADS_APP_ID: string;
  OAUTH_ENABLED: string; PUBLISHING_ENABLED: string;
  APP_REVIEW_APPROVED: string; PLATFORM_POLICY_APPROVED: string; CORPUS_APPROVED: string;
  THREADS_APP_SECRET?: string; TOKEN_ENCRYPTION_KEY?: string;
};
export type Account = {
  id: string; threads_id: string; username: string; token_cipher: string; token_expires_at: number;
  status: 'paused'|'active'|'exhausted'|'attention'; cadence_hours: number;
  approval_id: string|null; next_due_at: number|null; cursor: number; created_at: number;
};
export type ApprovalEntry = { factId: string; version: string; text: string };
export type Approval = { id: string; account_id: string; library_version: string; entries_json: string; cadence_hours: number; approved_at: number };
export type Job = { id: string; account_id: string; approval_id: string; position: number; post_text: string; status: string; attempt: number; available_at: number; lease_until: number; remote_id: string|null; created_at: number };
