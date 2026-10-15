-- Ontology Defect Suppressions Table
CREATE TABLE IF NOT EXISTS ontology_defect_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id uuid NOT NULL REFERENCES ontology_documents(id) ON DELETE CASCADE,
  defect_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);
