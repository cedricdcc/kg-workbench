-- User API Keys Table
CREATE TABLE IF NOT EXISTS user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  provider text NOT NULL,
  encrypted_key text NOT NULL,
  iv text NOT NULL,
  tag text NOT NULL,
  key_hint text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_user_provider_idx ON user_api_keys (user_id, provider);
