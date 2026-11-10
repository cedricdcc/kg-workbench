import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import React from "react"

import type {
  AnalystCitation,
  AnalystMessage,
  AnalystReasoningStep,
  AnalystSubgraph,
} from "../src/features/analyst/types"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

if (isChildTest || !isReactServer) {
  const { renderToStaticMarkup } = await import("react-dom/server")

  // Test 1: ChatMessageItem DOM rendering for User and Assistant
  test("ChatMessageItem renders user message content", async () => {
    const { ChatMessageItem } =
      await import("../src/features/analyst/components/chat-view/chat-message-item")

    const userMsg: AnalystMessage = {
      id: "msg-user-1",
      conversationId: "conv-1",
      sender: "user",
      content: "Which marine institutes study Baltic salinity?",
      createdAt: "2026-11-09T10:00:00.000Z",
    }

    const html = renderToStaticMarkup(
      React.createElement(ChatMessageItem, { message: userMsg })
    )

    assert.ok(
      html.includes("Which marine institutes study Baltic salinity?"),
      "Must display user question text"
    )
    assert.ok(
      html.includes('data-sender="user"'),
      "Must have user sender attribute"
    )
  })

  test("ChatMessageItem renders assistant message with parsed citation pills and subgraph button", async () => {
    const { ChatMessageItem } =
      await import("../src/features/analyst/components/chat-view/chat-message-item")

    const citations: AnalystCitation[] = [
      {
        sourceType: "document",
        sourceId: "doc-1",
        sourceName: "baltic_marine_2026.pdf",
        paragraphIndex: 14,
        pageFrom: 3,
        pageTo: 4,
        quoteText:
          "Baltic Institute monitors salinity gradients across the Gulf of Finland.",
      },
      {
        sourceType: "table",
        sourceId: "table-1",
        sourceName: "institutions.csv",
        tableRowKey: "row-42",
        quoteText: "Finnish Marine Hub | Helsinki | Est. 1982",
      },
    ]

    const subgraph: AnalystSubgraph = {
      nodes: [
        { id: "n1", label: "Baltic Institute", kind: "Organization" },
        { id: "n2", label: "Gulf of Finland", kind: "Location" },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2", label: "monitors" }],
    }

    const reasoningTrace: AnalystReasoningStep[] = [
      {
        step: "Anchor entity identification",
        detail:
          "Identified Baltic Institute and Finnish Marine Hub as focus nodes.",
      },
      {
        step: "2-hop path expansion",
        detail:
          "Traversed monitors relation to Gulf of Finland salinity sensors.",
      },
    ]

    const assistantMsg: AnalystMessage = {
      id: "msg-asst-1",
      conversationId: "conv-1",
      sender: "assistant",
      content:
        "Two organizations study Baltic salinity: the Baltic Institute according to [Doc: baltic_marine_2026.pdf §14] and Finnish Marine Hub from [Table: institutions.csv #row-42].",
      reasoningTrace,
      subgraph,
      citations,
      createdAt: "2026-11-09T10:00:05.000Z",
    }

    const html = renderToStaticMarkup(
      React.createElement(ChatMessageItem, {
        message: assistantMsg,
        defaultTraceOpen: true,
      })
    )

    assert.ok(
      html.includes('data-sender="assistant"'),
      "Must have assistant sender attribute"
    )
    assert.ok(
      html.includes("max-w-6xl") && html.includes("w-full"),
      "Must expand assistant container to max-w-6xl w-full"
    )
    assert.ok(
      html.includes("grid-cols-1") &&
        html.includes("md:grid-cols-2") &&
        html.includes("gap-3"),
      "Must place ReasoningTraceCard and Citations in a responsive 2-column sub-grid"
    )
    assert.ok(
      html.includes("baltic_marine_2026.pdf"),
      "Must render parsed document citation pill"
    )
    assert.ok(
      html.includes("institutions.csv"),
      "Must render parsed table citation pill"
    )
    assert.ok(
      html.includes("View Reasoning Subgraph"),
      "Must render View Reasoning Subgraph button when subgraph is present"
    )
    assert.ok(
      html.includes("Anchor entity identification"),
      "Must embed ReasoningTraceCard with step details"
    )
  })

  test("ChatMessageItem renders full width for reasoning trace when no citations exist", async () => {
    const { ChatMessageItem } =
      await import("../src/features/analyst/components/chat-view/chat-message-item")

    const assistantMsgOnlyTrace: AnalystMessage = {
      id: "msg-asst-2",
      conversationId: "conv-1",
      sender: "assistant",
      content: "Simple answer without external citations.",
      reasoningTrace: [
        { step: "Graph lookup", detail: "Scanned nodes directly" },
      ],
      createdAt: "2026-11-09T10:00:05.000Z",
    }

    const html = renderToStaticMarkup(
      React.createElement(ChatMessageItem, {
        message: assistantMsgOnlyTrace,
      })
    )

    assert.ok(
      html.includes("col-span-full"),
      "Must span full width when only reasoning trace exists"
    )
    assert.ok(
      html.includes("max-w-6xl") && html.includes("w-full"),
      "Must retain max-w-6xl w-full container"
    )
  })

  // Test 2: ReasoningTraceCard collapsible rendering
  test("ReasoningTraceCard renders step badges and collapsible details", async () => {
    const { ReasoningTraceCard } =
      await import("../src/features/analyst/components/chat-view/reasoning-trace-card")

    const steps: AnalystReasoningStep[] = [
      {
        step: "Identified anchor entities",
        detail: "Found 2 matching organizations in accepted KG facts.",
      },
      {
        step: "Expanded 2-hop neighborhood",
        detail: "Connected organizations to salinity measurement stations.",
      },
      {
        step: "Verified paragraph citations",
        detail: "Validated evidence anchors across source document paragraphs.",
      },
    ]

    // Test collapsed state
    const collapsedHtml = renderToStaticMarkup(
      React.createElement(ReasoningTraceCard, { steps, defaultOpen: false })
    )
    assert.ok(
      collapsedHtml.includes("Reasoning Trace"),
      "Must render card title"
    )
    assert.ok(
      collapsedHtml.includes("3 steps"),
      "Must display step count badge in collapsed header"
    )

    // Test expanded state
    const expandedHtml = renderToStaticMarkup(
      React.createElement(ReasoningTraceCard, { steps, defaultOpen: true })
    )
    assert.ok(
      expandedHtml.includes("Step 1"),
      "Must render execution badge for step 1"
    )
    assert.ok(
      expandedHtml.includes("Identified anchor entities"),
      "Must render step title"
    )
    assert.ok(
      expandedHtml.includes("Expanded 2-hop neighborhood"),
      "Must render step 2 title"
    )
    assert.ok(
      expandedHtml.includes(
        "Validated evidence anchors across source document paragraphs."
      ),
      "Must render step 3 detail text"
    )
  })

  // Test 3: CitationInspector slide-over drawer content rendering
  test("CitationInspector renders document citation with quote text and page numbers", async () => {
    const { CitationInspector } =
      await import("../src/features/analyst/components/citation-drawer/citation-inspector")

    const citation: AnalystCitation = {
      sourceType: "document",
      sourceId: "doc-99",
      sourceName: "gulf_salinity_report.pdf",
      paragraphIndex: 7,
      pageFrom: 12,
      pageTo: 13,
      quoteText:
        "Salinity concentration in western Gulf reached 6.2 PSU during summer measurements.",
    }

    const html = renderToStaticMarkup(
      React.createElement(CitationInspector, {
        citation,
        open: true,
        inline: true,
        onOpenChange: () => {},
      })
    )

    assert.ok(
      html.includes("gulf_salinity_report.pdf"),
      "Must display document title"
    )
    assert.ok(html.includes("§7"), "Must display paragraph index")
    assert.ok(
      html.includes("12") && html.includes("13"),
      "Must display page numbers"
    )
    assert.ok(
      html.includes("Salinity concentration in western Gulf reached 6.2 PSU"),
      "Must display full quote text"
    )
    assert.ok(html.includes("Document"), "Must display source type badge")
  })

  test("CitationInspector renders table citation with row key and tabular details", async () => {
    const { CitationInspector } =
      await import("../src/features/analyst/components/citation-drawer/citation-inspector")

    const citation: AnalystCitation = {
      sourceType: "table",
      sourceId: "tbl-5",
      sourceName: "environmental_monitoring_stations.csv",
      tableRowKey: "station-401",
      quoteText: "ST-401 | Helsinki Archipelago | 59.9° N, 24.8° E | Active",
    }

    const html = renderToStaticMarkup(
      React.createElement(CitationInspector, {
        citation,
        open: true,
        inline: true,
        onOpenChange: () => {},
      })
    )

    assert.ok(
      html.includes("environmental_monitoring_stations.csv"),
      "Must display table source name"
    )
    assert.ok(html.includes("station-401"), "Must display table row key")
    assert.ok(
      html.includes("ST-401 | Helsinki Archipelago"),
      "Must display quote text preview"
    )
    assert.ok(
      html.includes("Table") || html.includes("Tabular"),
      "Must display table source type badge"
    )
  })

  // Test 4: ChatInputBar renders textarea, submit button, and suggested question chips
  test("ChatInputBar renders input textarea and suggested chips", async () => {
    const { ChatInputBar } =
      await import("../src/features/analyst/components/chat-view/chat-input-bar")

    const html = renderToStaticMarkup(
      React.createElement(ChatInputBar, {
        onSubmit: () => {},
        suggestedQuestions: [
          "Find all organizations located in Finland",
          "What relationships connect marine ecology research?",
        ],
      })
    )

    assert.ok(
      html.includes("Find all organizations located in Finland"),
      "Must render suggested question chip 1"
    )
    assert.ok(
      html.includes("What relationships connect marine ecology research?"),
      "Must render suggested question chip 2"
    )
    assert.ok(
      html.includes("Ask a question about your knowledge graph"),
      "Must render textarea placeholder"
    )
  })

  test("ChatInputBar indicates loading state when in flight", async () => {
    const { ChatInputBar } =
      await import("../src/features/analyst/components/chat-view/chat-input-bar")

    const html = renderToStaticMarkup(
      React.createElement(ChatInputBar, {
        onSubmit: () => {},
        isLoading: true,
      })
    )

    assert.ok(
      html.includes("disabled") || html.includes("aria-disabled"),
      "Submit button must be disabled when loading"
    )
  })

  // Test 5: ChatMessageList renders message thread and loading indicator
  test("ChatMessageList renders empty state when no messages", async () => {
    const { ChatMessageList } =
      await import("../src/features/analyst/components/chat-view/chat-message-list")

    const html = renderToStaticMarkup(
      React.createElement(ChatMessageList, {
        messages: [],
        isLoading: false,
      })
    )

    assert.ok(
      html.includes("Start Knowledge Graph Query") ||
        html.includes("Ask natural language questions"),
      "Must render informative empty state"
    )
  })

  test("ChatMessageList renders messages and active reasoning indicator", async () => {
    const { ChatMessageList } =
      await import("../src/features/analyst/components/chat-view/chat-message-list")

    const messages: AnalystMessage[] = [
      {
        id: "m1",
        conversationId: "c1",
        sender: "user",
        content: "List research centers in the Baltic.",
        createdAt: "2026-11-09T10:00:00.000Z",
      },
    ]

    const html = renderToStaticMarkup(
      React.createElement(ChatMessageList, {
        messages,
        isLoading: true,
      })
    )

    assert.ok(
      html.includes("List research centers in the Baltic."),
      "Must render user message in list"
    )
    assert.ok(
      html.includes("Analyst is reasoning") || html.includes("Analyzing"),
      "Must render in-progress reasoning state indicator when query is loading"
    )
  })
}

// Test 6: AnalystShell layout wires ChatView, CitationInspector, and Subgraph modal
test("AnalystShell references ChatMessageList, ChatInputBar, and CitationInspector", () => {
  const shellPath = path.resolve(
    process.cwd(),
    "src/features/analyst/components/analyst-shell/analyst-shell.tsx"
  )
  const content = fs.readFileSync(shellPath, "utf-8")

  assert.ok(
    content.includes("ChatMessageList"),
    "AnalystShell must import and embed ChatMessageList"
  )
  assert.ok(
    content.includes("ChatInputBar"),
    "AnalystShell must import and embed ChatInputBar"
  )
  assert.ok(
    content.includes("CitationInspector"),
    "AnalystShell must import and embed CitationInspector"
  )
  assert.ok(
    content.includes("sendQueryAction"),
    "AnalystShell must connect sendQueryAction for queries"
  )
  assert.ok(
    content.includes("getMessagesQuery"),
    "AnalystShell must call getMessagesQuery for message fetching"
  )
})

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for ChatMessageItem, ReasoningTraceCard, ChatInputBar, and ChatMessageList via tsx runner", () => {
    const tsxCli = path.resolve(
      process.cwd(),
      "node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs"
    )
    const fallbackCli = path.resolve(
      process.cwd(),
      "node_modules/tsx/dist/cli.mjs"
    )
    const cliToUse = fs.existsSync(fallbackCli) ? fallbackCli : tsxCli

    const testFile = path.resolve(
      process.cwd(),
      "tests/analyst-chat-dom.test.ts"
    )
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CHILD_REACT_DOM_TEST: "1",
    }
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith("NODE_TEST_")) {
        delete childEnv[key]
      }
    }

    const output = execFileSync(
      process.execPath,
      [cliToUse, "--test", testFile],
      {
        encoding: "utf-8",
        env: childEnv,
      }
    )
    assert.ok(
      output.includes("pass") || output.includes("ok"),
      "Child client DOM rendering tests must pass"
    )
    assert.ok(
      !output.includes("fail 1"),
      "Child client DOM tests must have 0 failures"
    )
  })
}
