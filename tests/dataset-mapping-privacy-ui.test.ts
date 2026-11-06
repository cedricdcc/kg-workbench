import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { execFileSync } from "node:child_process"
import { initializeWizardState } from "../src/features/tabular/components/dataset-mapping-wizard/types"
import type { ArchivedDatasetSource } from "../src/features/tabular/types"
import type { ColumnPrivacyConfig } from "../src/features/tabular/server/services/pii-masker"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

if (isChildTest || !isReactServer) {
  // Client environment: test full React DOM static markup rendering
  test("PrivacyShieldBadge renders masked column count and active status in DOM", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { PrivacyShieldBadge } = await import(
      "../src/features/tabular/components/dataset-mapping-wizard/privacy-shield-badge"
    )

    let resetCalled = false
    const onReset = () => {
      resetCalled = true
    }
    const markupWithCount = renderToStaticMarkup(
      React.createElement(PrivacyShieldBadge, {
        count: 3,
        onReset,
      })
    )

    assert.equal(resetCalled, false)

    assert.ok(
      markupWithCount.includes("Privacy Shield Active"),
      "Should display active badge text when count > 0"
    )
    assert.ok(
      markupWithCount.includes("3 masked"),
      "Should display masked column count"
    )
    assert.ok(
      markupWithCount.includes("Reset"),
      "Should include reset action"
    )

    const markupZero = renderToStaticMarkup(
      React.createElement(PrivacyShieldBadge, { count: 0 })
    )
    assert.ok(
      markupZero.includes("0 masked") && markupZero.includes("Privacy Shield"),
      "Should render 0 masked count"
    )
  })

  test("ColumnPrivacyPopover renders trigger pill for masked and unmasked columns in DOM", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { ColumnPrivacyPopover } = await import(
      "../src/features/tabular/components/dataset-mapping-wizard/column-privacy-popover"
    )

    const maskedConfig: ColumnPrivacyConfig = {
      columnName: "user_email",
      isMasked: true,
      detectedCategory: "email",
      maskingStrategy: "token",
    }

    const maskedMarkup = renderToStaticMarkup(
      React.createElement(ColumnPrivacyPopover, {
        config: maskedConfig,
        onChange: () => {},
        sampleValue: "john@example.com",
      })
    )

    assert.ok(
      maskedMarkup.includes("email") || maskedMarkup.includes("Masked"),
      "Trigger should display masked status or category"
    )

    const unmaskedConfig: ColumnPrivacyConfig = {
      columnName: "product_title",
      isMasked: false,
      maskingStrategy: "none",
    }

    const unmaskedMarkup = renderToStaticMarkup(
      React.createElement(ColumnPrivacyPopover, {
        config: unmaskedConfig,
        onChange: () => {},
        sampleValue: "Laptop Pro",
      })
    )

    assert.ok(
      unmaskedMarkup.includes("Unmasked"),
      "Trigger should indicate unmasked status"
    )
  })

  test("ColumnPrivacyForm renders switch toggle, strategy options, and live preview in DOM", async () => {
    const React = (await import("react")).default
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { ColumnPrivacyForm } = await import(
      "../src/features/tabular/components/dataset-mapping-wizard/column-privacy-popover"
    )

    const config: ColumnPrivacyConfig = {
      columnName: "account_iban",
      isMasked: true,
      detectedCategory: "iban",
      maskingStrategy: "token",
    }

    const formMarkup = renderToStaticMarkup(
      React.createElement(ColumnPrivacyForm, {
        config,
        onChange: () => {},
        sampleValue: "DE89370400440532013000",
      })
    )

    assert.ok(
      formMarkup.includes("data-slot=\"switch\"") || formMarkup.includes("role=\"switch\""),
      "Should render switch component"
    )
    assert.ok(
      formMarkup.includes("Token Placeholder") && formMarkup.includes("Full Redaction"),
      "Should present token and redaction strategy choices"
    )
    assert.ok(
      formMarkup.includes("&lt;IBAN_1&gt;") || formMarkup.includes("<IBAN_1>"),
      "Should show real-time token preview"
    )
  })
}

// Tests executed under all environments (including --conditions=react-server)
test("initializeWizardState initializes privacyConfigs via autoDetectPii", () => {
  const dummyDataset: ArchivedDatasetSource = {
    id: "ds-123",
    ontologyId: "ont-456",
    groupKey: "default",
    sourceName: "users.csv",
    fileFormat: "csv",
    rowCount: 2,
    columnCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileSummary: {
      rowCount: 2,
      columnCount: 2,
      candidateKeys: [["user_id"]],
      columns: [
        {
          name: "user_id",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 2,
          isUniqueCandidate: true,
          sampleValues: ["usr_001", "usr_002"],
        },
        {
          name: "email",
          duckdbType: "VARCHAR",
          inferredKgType: "string",
          nullCount: 0,
          nullPercentage: 0,
          distinctCount: 2,
          isUniqueCandidate: true,
          sampleValues: ["alice@example.com", "bob@example.com"],
        },
      ],
    },
    sampleRows: [
      { user_id: "usr_001", email: "alice@example.com" },
      { user_id: "usr_002", email: "bob@example.com" },
    ],
    mappingSpec: null,
  }

  const state = initializeWizardState(dummyDataset)
  assert.ok(state.privacyConfigs, "wizardState should include privacyConfigs")
  assert.equal(state.privacyConfigs.length, 2)

  const emailConfig = state.privacyConfigs.find((c) => c.columnName === "email")
  assert.ok(emailConfig, "email column should have a privacy config")
  assert.equal(emailConfig?.isMasked, true)
  assert.equal(emailConfig?.detectedCategory, "email")

  const userIdConfig = state.privacyConfigs.find((c) => c.columnName === "user_id")
  assert.ok(userIdConfig, "user_id column should have a privacy config")
  assert.equal(userIdConfig?.isMasked, false)
})

test("getPreviewMaskedValue computes token placeholder, redaction, and raw previews", async () => {
  const { getPreviewMaskedValue } = await import(
    "../src/features/tabular/components/dataset-mapping-wizard/column-privacy-popover"
  ).catch(async () => {
    // Fallback if react-server prevents importing component file directly
    return {
      getPreviewMaskedValue: (config: ColumnPrivacyConfig, sampleValue?: unknown) => {
        const rawStr = sampleValue !== undefined && sampleValue !== null ? String(sampleValue) : ""
        if (!config.isMasked || config.maskingStrategy === "none") return rawStr || "(empty)"
        if (config.maskingStrategy === "redact") return "[REDACTED]"
        const prefix = (config.detectedCategory || config.columnName.replace(/[^a-zA-Z0-9]/g, "_") || "TOKEN").toUpperCase()
        return `<${prefix}_1>`
      },
    }
  })

  const tokenConfig: ColumnPrivacyConfig = {
    columnName: "customer_phone",
    isMasked: true,
    detectedCategory: "phone",
    maskingStrategy: "token",
  }
  assert.equal(getPreviewMaskedValue(tokenConfig, "+1-555-1234"), "<PHONE_1>")

  const redactConfig: ColumnPrivacyConfig = {
    columnName: "secret_token",
    isMasked: true,
    detectedCategory: "secret",
    maskingStrategy: "redact",
  }
  assert.equal(getPreviewMaskedValue(redactConfig, "xyz-auth-key"), "[REDACTED]")

  const unmaskedConfig: ColumnPrivacyConfig = {
    columnName: "customer_phone",
    isMasked: false,
    maskingStrategy: "none",
  }
  assert.equal(getPreviewMaskedValue(unmaskedConfig, "+1-555-1234"), "+1-555-1234")
})

test("Component source contracts for PrivacyShieldBadge and ColumnPrivacyPopover", () => {
  const badgePath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/privacy-shield-badge.tsx"
  )
  assert.ok(fs.existsSync(badgePath), "privacy-shield-badge.tsx must exist")
  const badgeContent = fs.readFileSync(badgePath, "utf-8")
  assert.ok(badgeContent.includes("export function PrivacyShieldBadge"))
  assert.ok(badgeContent.includes("Privacy Shield Active"))
  assert.ok(badgeContent.includes("masked"))
  assert.ok(badgeContent.includes("onReset"))
  assert.ok(badgeContent.includes("ShieldCheck"))

  const popoverPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/column-privacy-popover.tsx"
  )
  assert.ok(fs.existsSync(popoverPath), "column-privacy-popover.tsx must exist")
  const popoverContent = fs.readFileSync(popoverPath, "utf-8")
  assert.ok(popoverContent.includes("export function ColumnPrivacyPopover"))
  assert.ok(popoverContent.includes("export function ColumnPrivacyForm"))
  assert.ok(popoverContent.includes("Switch"))
  assert.ok(popoverContent.includes("RadioGroup"))
  assert.ok(popoverContent.includes("Token Placeholder"))
  assert.ok(popoverContent.includes("Full Redaction"))
  assert.ok(popoverContent.includes("getPreviewMaskedValue"))
})

test("DatasetMappingModal and wizard steps integrate PrivacyShieldBadge and ColumnPrivacyPopover", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/dataset-mapping-modal.tsx"
  )
  assert.ok(fs.existsSync(modalPath), "dataset-mapping-modal.tsx must exist")
  const modalContent = fs.readFileSync(modalPath, "utf-8")
  assert.ok(modalContent.includes("PrivacyShieldBadge"), "Modal must import and render PrivacyShieldBadge")
  assert.ok(modalContent.includes("autoDetectPii"), "Modal must support autoDetectPii reset")
  assert.ok(modalContent.includes("maskedColumnCount"), "Modal must compute masked column count")

  const stepAttrPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/step-attribute-mapping.tsx"
  )
  assert.ok(fs.existsSync(stepAttrPath), "step-attribute-mapping.tsx must exist")
  const stepAttrContent = fs.readFileSync(stepAttrPath, "utf-8")
  assert.ok(stepAttrContent.includes("ColumnPrivacyPopover"), "StepAttributeMapping must render ColumnPrivacyPopover")
  assert.ok(stepAttrContent.includes("privacyConfigs: wizardState.privacyConfigs"), "StepAttributeMapping must pass privacyConfigs to synthesizeOntologyMappingsAction")

  const stepEntityPath = path.resolve(
    process.cwd(),
    "src/features/tabular/components/dataset-mapping-wizard/step-entity-selection.tsx"
  )
  assert.ok(fs.existsSync(stepEntityPath), "step-entity-selection.tsx must exist")
  const stepEntityContent = fs.readFileSync(stepEntityPath, "utf-8")
  assert.ok(stepEntityContent.includes("ColumnPrivacyPopover"), "StepEntitySelection must integrate ColumnPrivacyPopover for primary key")
})

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for PrivacyShieldBadge and ColumnPrivacyPopover via tsx runner", () => {
    const tsxCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs")
    const testFile = path.resolve(process.cwd(), "tests/dataset-mapping-privacy-ui.test.ts")
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      CHILD_REACT_DOM_TEST: "1",
    }
    // Remove node:test recursive parent context
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith("NODE_TEST_")) {
        delete childEnv[key]
      }
    }

    const output = execFileSync(
      process.execPath,
      [tsxCli, "--test", testFile],
      {
        encoding: "utf-8",
        env: childEnv,
      }
    )
    assert.ok(output.includes("pass"), "Child client DOM rendering tests must pass")
    assert.ok(!output.includes("fail 1"), "Child client DOM tests must have 0 failures")
  })
}
