---
feature: analyst
status: in_progress
purpose: Natural language knowledge graph analyst and cross-source contradiction resolution workbench.
scope:
  - Natural language querying over accepted facts and mapped tabular datasets
  - Multi-hop reasoning traces with collapsible step explanations
  - Interactive React Flow subgraph visualizer for queried paths
  - Verifiable citation inspector for source document paragraphs and table records
  - Cross-source knowledge contradiction and semantic drift detector
entry_points:
  - path: src/app/(app)/analyst/page.tsx
    purpose: Main server route and shell loader for the Graph Analyst workbench.
  - path: src/features/analyst/components/analyst-shell/analyst-shell.tsx
    purpose: Main client shell layout coordinating conversation sidebar, chat and contradiction tabs, citation drawer, and subgraph modal.
  - path: src/features/analyst/components/conversation-sidebar/conversation-sidebar.tsx
    purpose: Left sidebar listing analyst conversations with search filter, new analysis creation, and deletion.
  - path: src/features/analyst/components/chat-view/chat-message-list.tsx
    purpose: Chronological message list view with empty state, auto-scrolling, and thinking indicators.
  - path: src/features/analyst/components/chat-view/chat-message-item.tsx
    purpose: Message item renderer for user questions and assistant answers with parsed citation badges, reasoning trace card, and subgraph launcher.
  - path: src/features/analyst/components/chat-view/chat-input-bar.tsx
    purpose: Query input bar with suggested question chips, Enter-to-submit keyboard handlers, and loading states.
  - path: src/features/analyst/components/chat-view/reasoning-trace-card.tsx
    purpose: Collapsible step-by-step reasoning trace card with execution stage badges and explanations.
  - path: src/features/analyst/components/citation-drawer/citation-inspector.tsx
    purpose: Slide-over drawer and card displaying document paragraphs or tabular records with full quote evidence.
  - path: src/features/analyst/components/subgraph-preview/analyst-subgraph-modal.tsx
    purpose: Dialog displaying reasoning subgraph overview with node/edge counts, entity kind legend, and interactive canvas.
  - path: src/features/analyst/components/subgraph-preview/subgraph-flow-view.tsx
    purpose: Interactive React Flow graph canvas computing Dagre rankdir layout, directional handle routing, and styled kind badges.
server_entry_points:
  - path: src/features/analyst/server/actions/create-conversation.ts
    purpose: Server action to initialize an analyst conversation.
  - path: src/features/analyst/server/actions/delete-conversation.ts
    purpose: Server action to delete an analyst conversation and its associated messages.
  - path: src/features/analyst/server/actions/send-query.ts
    purpose: Server action persisting user queries and enqueuing analyst.query_requested domain events.
  - path: src/features/analyst/server/actions/resolve-contradiction.ts
    purpose: Server action updating contradiction status and resolution actions.
  - path: src/features/analyst/server/queries/get-conversations.ts
    purpose: Queries conversations scoped to ontology and group key.
  - path: src/features/analyst/server/queries/get-messages.ts
    purpose: Queries messages in an analyst conversation ordered chronologically.
  - path: src/features/analyst/server/queries/get-contradictions.ts
    purpose: Queries knowledge contradictions scoped to ontology and group key.
update_this_readme_when:
  - New analyst UI views or server actions are added
  - Subgraph visualizer or contradiction resolution flows evolve
---

# Analyst Feature

Graph Intelligence & Natural Language Analyst subsystem integrating with the NetworkX Python analyst microservice and transactional domain events.

## Architecture

1. **Server Route (`src/app/(app)/analyst/page.tsx`)**: Resolves current ontology documents, initial conversations, and system service health statuses via server-side queries.
2. **Client Shell (`AnalystShell`)**: Top-level client layout managing conversation state, tab switching between "Chat & QA" and "Contradictions & Drift", citation drawer slide-over, and reasoning subgraph visualization modal.
3. **Conversation Management (`ConversationSidebar`)**: Enables creating new analyses, searching existing conversations, selecting active threads, and deleting conversation history with cascade deletion.
4. **Natural Language Query Engine**: Dispatches user queries through transactional outbox domain events (`analyst.query_requested`), picked up by the Python NetworkX analyst daemon for multi-hop path extraction.
5. **Verifiable Citations**: Traces answers back to specific document paragraphs and tabular dataset rows with inline citation chips and slide-over inspector.
6. **Reasoning Subgraph Visualizer (`subgraph-preview/`)**: Interactive Dagre-directed React Flow graph canvas visualizing the entities, kinds, and relations traversed to answer multi-hop analyst queries with pan/zoom controls, background grid, and entity-kind legends.
7. **Contradiction Resolution**: Surfaces conflicting assertions across documents and datasets, categorizing them by conflict type (`value_mismatch`, `temporal_drift`, `negation`) with user resolution options.
