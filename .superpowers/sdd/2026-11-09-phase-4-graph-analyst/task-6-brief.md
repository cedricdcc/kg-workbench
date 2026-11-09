# Task 6: Analyst Navigation & Shell Layout

**Files:**

- Modify: `src/lib/routes.ts`
- Modify: `src/components/app-sidebar.tsx`
- Create: `src/app/(app)/analyst/page.tsx`
- Create: `src/features/analyst/components/analyst-shell/analyst-shell.tsx`
- Create: `src/features/analyst/components/conversation-sidebar/conversation-sidebar.tsx`
- Create: `src/features/analyst/README.md`
- Create: `tests/analyst-navigation-dom.test.ts`

## Instructions

1. **`src/lib/routes.ts`**:
   Add `analyst`:

   ```ts
   analyst: {
     root: "/analyst",
     conversation: (id: string) => `/analyst?c=${encodeURIComponent(id)}`,
   },
   ```

2. **`src/components/app-sidebar.tsx`**:
   Add Graph Analyst item:

   ```ts
   import { BookOpen, Network, Sparkles, Settings } from "lucide-react"

   const navItems = [
     { href: routes.ontology.root, label: "Ontology", icon: Network },
     {
       href: routes.knowledgeGraph.root,
       label: "Knowledge Graph",
       icon: BookOpen,
     },
     { href: routes.analyst.root, label: "Graph Analyst", icon: Sparkles },
   ]
   ```

3. **`src/app/(app)/analyst/page.tsx`**:
   Server component:
   - Fetches current ontology document (default or query param `doc`).
   - Fetches list of conversations for this ontology via `getConversationsQuery(ontologyId)`.
   - Fetches services status via `getSystemServices()`.
   - Renders `<AnalystShell initialConversations={conversations} services={services} ... />`.

4. **`src/features/analyst/components/analyst-shell/analyst-shell.tsx`**:
   Client component:
   - Manages selected conversation ID, active tab ("chat" | "contradictions"), active citation drawer, and subgraph modal.
   - Hosts `ConversationSidebar` on the left.
   - Hosts the main content area in the center (Chat view or Contradictions view).

5. **`src/features/analyst/components/conversation-sidebar/conversation-sidebar.tsx`**:
   - Lists conversations with search filter.
   - "New Analysis" button calling `createConversationAction`.
   - Active conversation highlight and delete action.

6. **`src/features/analyst/README.md`**:
   Documents feature purpose, entry points, domain concepts, and subcomponents.

7. **`tests/analyst-navigation-dom.test.ts`**:
   - Test `routes.analyst.root` and `routes.analyst.conversation("c-123")`.
   - Test `AppSidebar` renders Graph Analyst item.

8. Commit:
   `git add src/lib/routes.ts src/components/app-sidebar.tsx src/app/(app)/analyst/ src/features/analyst/ tests/analyst-navigation-dom.test.ts`
   `git commit -m "feat(analyst): create analyst shell and navigation route"`
