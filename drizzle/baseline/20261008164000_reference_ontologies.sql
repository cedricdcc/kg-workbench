-- Reference ontologies catalog
CREATE TABLE IF NOT EXISTS reference_ontologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix text NOT NULL,
  name text NOT NULL,
  base_iri text NOT NULL,
  source_registry text NOT NULL,
  source_id text NOT NULL,
  version text DEFAULT '',
  synced_at timestamptz DEFAULT now(),
  group_key text NOT NULL DEFAULT 'shared',
  created_at timestamptz DEFAULT now()
);

-- Reference ontology terms and embeddings
CREATE TABLE IF NOT EXISTS reference_ontology_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_ontology_id uuid NOT NULL REFERENCES reference_ontologies(id) ON DELETE CASCADE,
  curie text NOT NULL,
  iri text NOT NULL,
  label text NOT NULL,
  type text NOT NULL,
  description text NOT NULL DEFAULT '',
  synonyms text[] DEFAULT '{}'::text[],
  parent_iris text[] DEFAULT '{}'::text[],
  related_property_iris text[] DEFAULT '{}'::text[],
  embedding real[],
  group_key text NOT NULL DEFAULT 'shared'
);
