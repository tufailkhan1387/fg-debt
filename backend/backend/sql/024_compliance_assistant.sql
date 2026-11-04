-- FG Compliance: the AI Compliance Assistant (spec section 13). Each conversation belongs to the person who asked;
-- answers keep the records they cite so the evidence can be opened later.

CREATE TABLE IF NOT EXISTS compliance_assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_assistant_conversations_user_idx ON compliance_assistant_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS compliance_assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES compliance_assistant_conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- Assistant answers: the records cited ([P3] …) with where to open them, and any references that did not match.
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  unknown_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  usage JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_assistant_messages_conversation_idx ON compliance_assistant_messages (conversation_id, created_at);
