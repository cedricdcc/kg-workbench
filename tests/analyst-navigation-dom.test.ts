import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { routes } from "../src/lib/routes"

test("routes.analyst provides correct paths", () => {
  assert.equal(routes.analyst.root, "/analyst")
  assert.equal(routes.analyst.conversation("c-123"), "/analyst?c=c-123")
  assert.equal(
    routes.analyst.conversation("test with spaces"),
    "/analyst?c=test%20with%20spaces"
  )
})

test("AppSidebar includes Graph Analyst route and Sparkles icon", () => {
  const sidebarPath = path.resolve(
    process.cwd(),
    "src/components/app-sidebar.tsx"
  )
  const content = fs.readFileSync(sidebarPath, "utf-8")
  assert.ok(
    content.includes("routes.analyst.root"),
    "AppSidebar must reference routes.analyst.root"
  )
  assert.ok(
    content.includes("Graph Analyst"),
    "AppSidebar must have Graph Analyst label"
  )
  assert.ok(
    content.includes("Sparkles"),
    "AppSidebar must import Sparkles icon from lucide-react"
  )
})

test("Analyst Page server component file exists and imports AnalystShell and queries", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/(app)/analyst/page.tsx")
  assert.ok(
    fs.existsSync(pagePath),
    "src/app/(app)/analyst/page.tsx must exist"
  )
  const content = fs.readFileSync(pagePath, "utf-8")
  assert.ok(
    content.includes("AnalystShell"),
    "page.tsx must import AnalystShell"
  )
  assert.ok(
    content.includes("getConversationsQuery"),
    "page.tsx must call getConversationsQuery"
  )
  assert.ok(
    content.includes("getSystemServices"),
    "page.tsx must call getSystemServices"
  )
  assert.ok(
    content.includes("getOntologyDocuments"),
    "page.tsx must call getOntologyDocuments"
  )
})

test("AnalystShell component exists and exposes required layout slots", () => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/analyst-shell/analyst-shell.tsx"
  )
  assert.ok(fs.existsSync(shellPath), "analyst-shell.tsx must exist")
  const content = fs.readFileSync(shellPath, "utf-8")
  assert.ok(
    content.includes("export function AnalystShell"),
    "Must export AnalystShell"
  )
  assert.ok(
    content.includes("ConversationSidebar"),
    "Must embed ConversationSidebar"
  )
  assert.ok(content.includes("chat"), "Must support chat tab")
  assert.ok(
    content.includes("contradictions"),
    "Must support contradictions tab"
  )
  assert.ok(
    content.includes("analyst-citation-drawer"),
    "Must expose citation drawer slot"
  )
  assert.ok(
    content.includes("analyst-subgraph-modal"),
    "Must expose subgraph visualizer modal slot"
  )
  assert.ok(
    content.includes("analyst-chat-view"),
    "Must render chat view container"
  )
  assert.ok(
    content.includes("analyst-contradictions-view"),
    "Must render contradictions view container"
  )
})

test("ConversationSidebar component exists and implements search filter, new analysis, and delete", () => {
  const sidebarPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/conversation-sidebar/conversation-sidebar.tsx"
  )
  assert.ok(fs.existsSync(sidebarPath), "conversation-sidebar.tsx must exist")
  const content = fs.readFileSync(sidebarPath, "utf-8")
  assert.ok(
    content.includes("export function ConversationSidebar"),
    "Must export ConversationSidebar"
  )
  assert.ok(
    content.includes("createConversationAction"),
    "Must integrate createConversationAction"
  )
  assert.ok(
    content.includes("deleteConversationAction"),
    "Must integrate deleteConversationAction"
  )
  assert.ok(content.includes("New Analysis"), "Must have New Analysis button")
  assert.ok(content.includes("searchQuery"), "Must support search filter state")
  assert.ok(
    content.includes("data-active"),
    "Must provide active highlight attribute"
  )
})

test("deleteConversationAction is exported and validates conversationId", () => {
  const actionPath = path.resolve(
    process.cwd(),
    "src/features/analyst/server/actions/delete-conversation.ts"
  )
  assert.ok(fs.existsSync(actionPath), "delete-conversation.ts must exist")
  const content = fs.readFileSync(actionPath, "utf-8")
  assert.ok(
    content.includes("export async function deleteConversationAction"),
    "Must export deleteConversationAction"
  )
  assert.ok(
    content.includes("conversationId is required."),
    "Must validate non-empty conversationId"
  )
  assert.ok(
    content.includes("analystConversations"),
    "Must delete from analystConversations table"
  )
})
