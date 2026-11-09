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
    purpose: Main server route and shell for the Graph Analyst workbench.
server_entry_points:
  - path: src/features/analyst/server/actions/create-conversation.ts
    purpose: Server action to initialize an analyst conversation.
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
