-- Allow deleting ontology documents even when referenced by extraction runs
ALTER TABLE extraction_runs
  DROP CONSTRAINT IF EXISTS extraction_runs_ontology_id_fkey;

ALTER TABLE extraction_runs
  ADD CONSTRAINT extraction_runs_ontology_id_fkey
  FOREIGN KEY (ontology_id)
  REFERENCES ontology_documents(id)
  ON DELETE SET NULL;
