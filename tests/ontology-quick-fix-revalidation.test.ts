import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("OntologyShell wires useRouter and invokes router.refresh in handleQuickFix", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/features/ontology/components/ontology-shell/ontology-shell.tsx"
  )
  const content = fs.readFileSync(filePath, "utf-8")

  assert.ok(
    content.includes('import { useRouter } from "next/navigation"'),
    "OntologyShell must import useRouter from next/navigation"
  )
  assert.ok(
    content.includes("const router = useRouter()"),
    "OntologyShell must instantiate useRouter"
  )
  assert.ok(
    content.includes("router.refresh()"),
    "OntologyShell must invoke router.refresh() when executing quick fixes"
  )
})
