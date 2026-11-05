import assert from "node:assert/strict"
import { test } from "node:test"
import { config } from "dotenv"

config({ path: ".env.local" })

test("e2e tabular archive, mapping spec save, and commit lifecycle", async () => {
  const { archiveDatasetSourceAction } =
    await import("../src/features/tabular/server/actions/archive-dataset-source")
  const { getDatasetSourcesQuery } =
    await import("../src/features/tabular/server/queries/get-dataset-sources")
  const { deleteDatasetSourceAction } =
    await import("../src/features/tabular/server/actions/delete-dataset-source")
  const { commitDatasetMappingAction } =
    await import("../src/features/tabular/server/actions/commit-dataset-mapping")
  const { getDb } = await import("../src/server/database")
  const { ontologyDocuments } = await import("../src/server/db/schema")

  const db = getDb()
  const [doc] = await db
    .insert(ontologyDocuments)
    .values({ name: "E2E Tabular Mapping Test", group_key: "shared" })
    .returning()

  assert.ok(doc)

  try {
    // 1. Archive a dataset source
    const archived = await archiveDatasetSourceAction({
      ontologyId: doc.id,
      sourceName: "test-customers.csv",
      fileFormat: "csv",
      rowCount: 50,
      columnCount: 3,
      profileSummary: {
        rowCount: 50,
        columnCount: 3,
        candidateKeys: [["customer_id"]],
        columns: [
          {
            name: "customer_id",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 50,
            isUniqueCandidate: true,
            sampleValues: ["C1"],
          },
          {
            name: "name",
            duckdbType: "VARCHAR",
            inferredKgType: "string",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 45,
            isUniqueCandidate: false,
            sampleValues: ["Alice"],
          },
          {
            name: "active",
            duckdbType: "BOOLEAN",
            inferredKgType: "boolean",
            nullCount: 0,
            nullPercentage: 0,
            distinctCount: 2,
            isUniqueCandidate: false,
            sampleValues: [true],
          },
        ],
      },
      sampleRows: [{ customer_id: "C1", name: "Alice", active: true }],
    })

    assert.ok(archived.id)

    // 2. Query archive
    const sources = await getDatasetSourcesQuery(doc.id)
    assert.equal(sources.length, 1)
    assert.equal(sources[0].sourceName, "test-customers.csv")
    assert.equal(sources[0].rowCount, 50)

    // 3. Commit dataset mapping with synthesized elements
    const commitResult = await commitDatasetMappingAction({
      ontologyId: doc.id,
      datasetSourceId: archived.id,
      mappingSpec: {
        targetClassName: "E2ECustomer",
        primaryKeyColumn: "customer_id",
        columnMappings: [
          {
            columnName: "customer_id",
            inferredType: "string",
            targetKind: "attribute",
            targetAttributeName: "customerId",
            targetDataType: "xsd:string",
            isPrimaryKey: true,
          },
          {
            columnName: "name",
            inferredType: "string",
            targetKind: "attribute",
            targetAttributeName: "customerName",
            targetDataType: "xsd:string",
          },
        ],
        synthesizedElements: {
          classes: [{ name: "E2ECustomer", description: "Synthesized class" }],
          attributes: [
            {
              className: "E2ECustomer",
              name: "customerId",
              dataType: "xsd:string",
            },
            {
              className: "E2ECustomer",
              name: "customerName",
              dataType: "xsd:string",
            },
          ],
          relations: [],
        },
      },
    })

    assert.equal(commitResult.ok, true)
    assert.equal(commitResult.createdClassesCount, 1)
    assert.equal(commitResult.createdAttributesCount, 2)

    // Verify dataset source updated with mapping spec
    const sourcesAfterCommit = await getDatasetSourcesQuery(doc.id)
    assert.equal(
      sourcesAfterCommit[0].mappingSpec?.targetClassName,
      "E2ECustomer"
    )
    assert.equal(
      sourcesAfterCommit[0].mappingSpec?.primaryKeyColumn,
      "customer_id"
    )

    // 4. Delete dataset source
    const del = await deleteDatasetSourceAction(archived.id)
    assert.equal(del.success, true)
    const afterDelete = await getDatasetSourcesQuery(doc.id)
    assert.equal(afterDelete.length, 0)
  } finally {
    const { eq } = await import("drizzle-orm")
    await db.delete(ontologyDocuments).where(eq(ontologyDocuments.id, doc.id))
  }
})
