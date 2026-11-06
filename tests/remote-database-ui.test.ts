import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import type { ArchivedDatasetSource } from "../src/features/tabular/types"
import type { TableDiscoveryItem } from "../src/features/tabular/server/actions/remote-database"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

if (isChildTest || !isReactServer) {
  test("RemoteDatabaseTab step 1 displays connection fields and Discover Tables button in DOM", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { RemoteDatabaseTab } = await import(
      "../src/features/tabular/components/tabular-profiler-modal/remote-database-tab"
    )

    const markup = renderToStaticMarkup(
      React.createElement(RemoteDatabaseTab, {
        ontologyId: "ont-123",
        onProfileComplete: () => {},
        initialStep: 1,
      })
    )

    // Form inputs and buttons
    assert.ok(
      markup.includes("PostgreSQL") || markup.includes("postgres"),
      "Should display engine selector option for PostgreSQL"
    )
    assert.ok(
      markup.includes("MySQL") || markup.includes("mysql"),
      "Should display engine selector option for MySQL"
    )
    assert.ok(markup.includes("Host") || markup.includes("host"), "Should render Host field")
    assert.ok(markup.includes("Port") || markup.includes("port"), "Should render Port field")
    assert.ok(
      markup.includes("Database") || markup.includes("database"),
      "Should render Database name field"
    )
    assert.ok(
      markup.includes("Username") || markup.includes("User"),
      "Should render Username field"
    )
    assert.ok(
      markup.includes("Password") || markup.includes("password"),
      "Should render Password field"
    )
    assert.ok(
      markup.includes("Connect &amp; Discover Tables") ||
        markup.includes("Connect & Discover Tables") ||
        markup.includes("Discover Tables"),
      "Should render 'Connect & Discover Tables' button"
    )
  })

  test("RemoteDatabaseTab step 2 renders searchable table combobox upon successful discovery in DOM", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { RemoteDatabaseTab } = await import(
      "../src/features/tabular/components/tabular-profiler-modal/remote-database-tab"
    )

    const mockTables: TableDiscoveryItem[] = [
      {
        schema: "public",
        name: "customers",
        type: "BASE TABLE",
        estimatedRows: 1250,
      },
      {
        schema: "public",
        name: "orders_view",
        type: "VIEW",
        estimatedRows: 4500,
      },
    ]

    const markup = renderToStaticMarkup(
      React.createElement(RemoteDatabaseTab, {
        ontologyId: "ont-123",
        onProfileComplete: () => {},
        initialStep: 2,
        initialTables: mockTables,
        initialConnection: {
          dbType: "postgres",
          host: "db.internal",
          port: 5432,
          database: "prod_db",
          user: "analyst",
        },
      })
    )

    assert.ok(
      markup.includes("customers"),
      "Should render discovered customer table name"
    )
    assert.ok(
      markup.includes("orders_view"),
      "Should render discovered orders view name"
    )
    assert.ok(
      markup.includes("BASE TABLE") || markup.includes("VIEW"),
      "Should display table type badge"
    )
    assert.ok(
      markup.includes("Profile Table"),
      "Should render 'Profile Table' button in Step 2"
    )
  })

  test("DatasetArchiveCard renders Re-sync button when connection_config is present and Database badge for SQL sources", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
    const { DatasetArchiveCard } = await import(
      "../src/features/tabular/components/dataset-archive-browser/dataset-archive-card"
    )

    const queryClient = new QueryClient()

    const sqlDataset: ArchivedDatasetSource = {
      id: "ds-sql-1",
      ontologyId: "ont-123",
      groupKey: "shared",
      sourceName: "remote_customers",
      fileFormat: "postgres",
      rowCount: 500,
      columnCount: 8,
      profileSummary: {
        rowCount: 500,
        columnCount: 8,
        candidateKeys: [["id"]],
        columns: [],
      },
      sampleRows: [],
      mappingSpec: null,
      connectionConfig: {
        dbType: "postgres",
        host: "localhost",
        port: 5432,
        database: "crm",
        user: "postgres",
        table: "remote_customers",
      },
      lastSyncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const sqlMarkup = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(DatasetArchiveCard, {
          dataset: sqlDataset,
          onInspectProfile: () => {},
          onOpenMappingWizard: () => {},
          onDeleteDataset: async () => {},
        })
      )
    )

    assert.ok(
      sqlMarkup.includes("Re-sync") || sqlMarkup.includes("resync"),
      "DatasetArchiveCard must render Re-sync button when connectionConfig is present"
    )
    assert.ok(
      sqlMarkup.includes("POSTGRES"),
      "DatasetArchiveCard must render POSTGRES format badge"
    )

    // Dataset without connection_config
    const fileDataset: ArchivedDatasetSource = {
      ...sqlDataset,
      id: "ds-file-1",
      fileFormat: "csv",
      connectionConfig: null,
    }

    const fileMarkup = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(DatasetArchiveCard, {
          dataset: fileDataset,
          onInspectProfile: () => {},
          onOpenMappingWizard: () => {},
          onDeleteDataset: async () => {},
        })
      )
    )

    assert.ok(
      !fileMarkup.includes("Re-sync"),
      "DatasetArchiveCard must NOT render Re-sync button when connectionConfig is missing"
    )
    assert.ok(
      fileMarkup.includes("CSV"),
      "DatasetArchiveCard must render CSV badge for file dataset"
    )
  })
}

// Contract and code integration tests (runs in all test environments)
test("Remote database UI contract and file integrity", () => {
  const remoteTabPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/tabular-profiler-modal/remote-database-tab.tsx"
  )
  assert.ok(fs.existsSync(remoteTabPath), "remote-database-tab.tsx must exist")

  const modalPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/tabular-profiler-modal/tabular-profiler-modal.tsx"
  )
  assert.ok(fs.existsSync(modalPath), "tabular-profiler-modal.tsx must exist")
  const modalContent = fs.readFileSync(modalPath, "utf-8")
  assert.ok(
    modalContent.includes("RemoteDatabaseTab"),
    "TabularProfilerModal must import and render RemoteDatabaseTab"
  )
  assert.ok(
    modalContent.includes("Upload File") && modalContent.includes("Remote Database"),
    "TabularProfilerModal must contain 'Upload File' and 'Remote Database' source tabs"
  )

  const cardPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-archive-browser/dataset-archive-card.tsx"
  )
  assert.ok(fs.existsSync(cardPath), "dataset-archive-card.tsx must exist")
  const cardContent = fs.readFileSync(cardPath, "utf-8")
  assert.ok(
    cardContent.includes("resyncDatabaseSourceAction"),
    "DatasetArchiveCard must invoke resyncDatabaseSourceAction"
  )

  const readmePath = path.resolve(process.cwd(), "src/features/tabular/README.md")
  assert.ok(fs.existsSync(readmePath), "src/features/tabular/README.md must exist")
  const readmeContent = fs.readFileSync(readmePath, "utf-8")
  assert.ok(
    readmeContent.toLowerCase().includes("database") ||
      readmeContent.toLowerCase().includes("postgres") ||
      readmeContent.toLowerCase().includes("re-sync"),
    "README.md must document remote database connectors and re-sync"
  )
})

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for RemoteDatabaseTab and DatasetArchiveCard via tsx runner", () => {
    const tsxCli = path.resolve(
      process.cwd(),
      "node_modules/.pnpm/tsx@4.23.15/node_modules/tsx/dist/cli.mjs"
    )
    const fallbackCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs")
    const cliToUse = fs.existsSync(fallbackCli) ? fallbackCli : tsxCli

    const testFile = path.resolve(process.cwd(), "tests/remote-database-ui.test.ts")
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
    assert.ok(output.includes("pass"), "Child client DOM rendering tests must pass")
    assert.ok(!output.includes("fail 1"), "Child client DOM tests must have 0 failures")
  })
}
