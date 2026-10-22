import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"

test("FactTable wraps with TooltipProvider at table level", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/features/documents/components/fact-table/fact-table.tsx"
  )
  const content = fs.readFileSync(filePath, "utf-8")
  assert.ok(
    content.includes("<TooltipProvider"),
    "FactTable must wrap with TooltipProvider"
  )
})

test("FactTableRow does not wrap tr in TooltipProvider or render dialog as direct tbody child", () => {
  const filePath = path.resolve(
    process.cwd(),
    "src/features/documents/components/fact-table/fact-table-row.tsx"
  )
  const content = fs.readFileSync(filePath, "utf-8")
  assert.ok(
    !content.includes("<TooltipProvider>"),
    "FactTableRow must not wrap tr in TooltipProvider"
  )
  // Ensure return statement does not have PendingEntityClassDialog directly before tr
  const returnMatch =
    /return\s*\(\s*<>[\s\S]*?<PendingEntityClassDialog[\s\S]*?<tr/.test(content)
  assert.equal(
    returnMatch,
    false,
    "PendingEntityClassDialog must not be placed directly between tbody and tr"
  )
})
