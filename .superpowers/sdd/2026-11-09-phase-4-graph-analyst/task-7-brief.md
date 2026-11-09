# Task 7: Chat View, Reasoning Trace, and Citation Inspector

**Files:**

- Create: `src/features/analyst/components/chat-view/chat-message-list.tsx`
- Create: `src/features/analyst/components/chat-view/chat-message-item.tsx`
- Create: `src/features/analyst/components/chat-view/chat-input-bar.tsx`
- Create: `src/features/analyst/components/chat-view/reasoning-trace-card.tsx`
- Create: `src/features/analyst/components/citation-drawer/citation-inspector.tsx`
- Create: `tests/analyst-chat-dom.test.ts`

## Instructions

1. **`src/features/analyst/components/chat-view/chat-input-bar.tsx`**:
   - Query textarea with Submit button (Enter submits, Shift+Enter new line).
   - Suggested question chips (e.g., "Find all organizations located in Finland", "What relationships connect marine ecology research?").
   - Loading state indicator while query is being processed.

2. **`src/features/analyst/components/chat-view/reasoning-trace-card.tsx`**:
   - Collapsible card showing step-by-step reasoning trace `[{ step: string; detail: string }]`.
   - Badges showing execution steps (e.g. "Step 1: Identified anchor entities", "Step 2: Expanded 2-hop graph neighborhood", "Step 3: Verified 4 paragraph citations").

3. **`src/features/analyst/components/chat-view/chat-message-item.tsx`**:
   - Renders user and assistant messages.
   - For assistant messages:
     - Formatted text content.
     - Parses citations like `[Doc: filename.pdf §3]` or `[Table: SourceName #1]` and displays clickable badges.
     - Embeds `ReasoningTraceCard`.
     - Button "View Reasoning Subgraph" triggering the subgraph modal callback.
     - Clicking a citation pill triggers `onSelectCitation(citation)`.

4. **`src/features/analyst/components/citation-drawer/citation-inspector.tsx`**:
   - Slide-over drawer / sheet or panel displaying the selected citation:
     - Document title / Table name.
     - Paragraph index, page numbers (if available).
     - Full quote text and context preview.

5. **`tests/analyst-chat-dom.test.ts`**:
   - Test rendering of message item with reasoning trace and citation pills.
   - Test expanding reasoning trace card.
   - Test citation drawer rendering quote text.

6. Commit:
   `git add src/features/analyst/components/chat-view/ src/features/analyst/components/citation-drawer/ tests/analyst-chat-dom.test.ts`
   `git commit -m "feat(analyst): implement conversational chat view with citations and reasoning trace"`
