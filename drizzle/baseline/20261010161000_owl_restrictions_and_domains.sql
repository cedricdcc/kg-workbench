-- Add property kind and domain/range IRIs to reference ontology terms
ALTER TABLE reference_ontology_terms
  ADD COLUMN IF NOT EXISTS property_kind text,
  ADD COLUMN IF NOT EXISTS domain_iris text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS range_iris text[] DEFAULT '{}'::text[];

-- Class disjointness axioms (owl:disjointWith)
CREATE TABLE IF NOT EXISTS ontology_class_disjointness (
  ontology_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES ontology_classes(id) ON DELETE CASCADE,
  disjoint_class_id uuid NOT NULL REFERENCES ontology_classes(id) ON DELETE CASCADE,
  PRIMARY KEY (class_id, disjoint_class_id)
);

-- Class cardinality restrictions (owl:Restriction on relations or attributes)
CREATE TABLE IF NOT EXISTS ontology_class_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ontology_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES ontology_classes(id) ON DELETE CASCADE,
  relation_id uuid REFERENCES ontology_relations(id) ON DELETE CASCADE,
  attribute_id uuid REFERENCES ontology_attributes(id) ON DELETE CASCADE,
  restriction_type text NOT NULL,
  cardinality_value integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);
