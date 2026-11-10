import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { test } from "node:test"
import React from "react"

const isReactServer = process.execArgv.some((a) => a.includes("react-server"))
const isChildTest = process.env.CHILD_REACT_DOM_TEST === "1"

type DialogElement = React.ReactElement<{
  "data-slot"?: string
  "data-viewport"?: string
  className?: string
  children?: React.ReactNode
}>

if (isChildTest || !isReactServer) {
  const { Dialog, DialogContent, dialogViewportVariants } =
    await import("../src/components/ui/dialog")
  const { renderToStaticMarkup } = await import("react-dom/server")

  test("dialogViewportVariants defines classes for default, wide, and fullscreen tiers", () => {
    assert.ok(dialogViewportVariants, "dialogViewportVariants must be exported")
    assert.ok(
      dialogViewportVariants.fullscreen.includes(
        "fixed top-3 left-3 md:top-6 md:left-6"
      ),
      "fullscreen must include top-3 left-3 responsive positioning"
    )
    assert.ok(
      dialogViewportVariants.fullscreen.includes(
        "w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)]"
      ),
      "fullscreen must include responsive width"
    )
    assert.ok(
      dialogViewportVariants.fullscreen.includes(
        "h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)]"
      ),
      "fullscreen must include responsive height"
    )
    assert.ok(
      dialogViewportVariants.fullscreen.includes(
        "max-w-none max-h-none -translate-x-0 -translate-y-0"
      ),
      "fullscreen must reset max constraints and translations"
    )
    assert.ok(
      dialogViewportVariants.wide.includes("max-w-5xl"),
      "wide must include max-w-5xl"
    )
    assert.ok(
      dialogViewportVariants.wide.includes("w-[calc(100vw-2rem)]"),
      "wide must include calc width"
    )
    assert.ok(
      dialogViewportVariants.wide.includes("max-h-[88vh]"),
      "wide must include max-h-[88vh]"
    )
    assert.ok(
      dialogViewportVariants.default.includes("sm:max-w-md"),
      "default must include sm:max-w-md"
    )
  })

  test("DialogContent renders fullscreen viewport variant with Option B near-full viewport classes", () => {
    const tree = DialogContent({
      viewport: "fullscreen",
      className: "extra-test-class",
      children: React.createElement("div", null, "Fullscreen Content"),
    })

    // tree is DialogPortal whose children are [DialogOverlay, DialogPrimitive.Content]
    const children = React.Children.toArray(
      tree.props.children
    ) as DialogElement[]
    const contentElement = children.find(
      (child) => child.props?.["data-slot"] === "dialog-content"
    )

    assert.ok(
      contentElement,
      "DialogContent must produce dialog-content element"
    )
    assert.equal(contentElement.props["data-viewport"], "fullscreen")
    assert.ok(
      contentElement.props.className?.includes(
        "fixed top-3 left-3 md:top-6 md:left-6"
      ),
      "Must include fullscreen position classes"
    )
    assert.ok(
      contentElement.props.className?.includes(
        "w-[calc(100vw-1.5rem)] md:w-[calc(100vw-3rem)]"
      ),
      "Must include fullscreen width classes"
    )
    assert.ok(
      contentElement.props.className?.includes(
        "h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)]"
      ),
      "Must include fullscreen height classes"
    )
    assert.ok(
      contentElement.props.className?.includes(
        "max-w-none max-h-none -translate-x-0 -translate-y-0"
      ),
      "Must include reset constraints"
    )
    assert.ok(
      contentElement.props.className?.includes("extra-test-class"),
      "Must include additional custom className"
    )

    const markup = renderToStaticMarkup(
      React.createElement(Dialog, { open: true }, contentElement)
    )
    assert.ok(
      markup.includes("Fullscreen Content"),
      "Must render modal children"
    )
    assert.ok(
      markup.includes('data-slot="dialog-content"'),
      "Must have data-slot dialog-content"
    )
    assert.ok(
      markup.includes("fixed top-3 left-3"),
      "Rendered markup must have top-3 left-3"
    )
  })

  test("DialogContent renders wide viewport variant with bounded multi-column classes", () => {
    const tree = DialogContent({
      viewport: "wide",
      children: React.createElement("div", null, "Wide Content"),
    })

    const children = React.Children.toArray(
      tree.props.children
    ) as DialogElement[]
    const contentElement = children.find(
      (child) => child.props?.["data-slot"] === "dialog-content"
    )

    assert.ok(
      contentElement,
      "DialogContent must produce dialog-content element"
    )
    assert.equal(contentElement.props["data-viewport"], "wide")
    assert.ok(
      contentElement.props.className?.includes("max-w-5xl"),
      "Must include wide max-width"
    )
    assert.ok(
      contentElement.props.className?.includes("w-[calc(100vw-2rem)]"),
      "Must include wide calc width"
    )
    assert.ok(
      contentElement.props.className?.includes("max-h-[88vh]"),
      "Must include wide calc max-height"
    )
    assert.ok(
      contentElement.props.className?.includes(
        "-translate-x-1/2 -translate-y-1/2"
      ),
      "Must include centered transform"
    )

    const markup = renderToStaticMarkup(
      React.createElement(Dialog, { open: true }, contentElement)
    )
    assert.ok(markup.includes("Wide Content"), "Must render modal children")
    assert.ok(
      markup.includes("max-w-5xl"),
      "Rendered markup must have max-w-5xl"
    )
  })

  test("DialogContent defaults to viewport='default' when prop is omitted", () => {
    const tree = DialogContent({
      children: React.createElement("div", null, "Default Content"),
    })

    const children = React.Children.toArray(
      tree.props.children
    ) as DialogElement[]
    const contentElement = children.find(
      (child) => child.props?.["data-slot"] === "dialog-content"
    )

    assert.ok(
      contentElement,
      "DialogContent must produce dialog-content element"
    )
    assert.equal(contentElement.props["data-viewport"], "default")
    assert.ok(
      contentElement.props.className?.includes("sm:max-w-md"),
      "Default must include sm:max-w-md"
    )
    assert.ok(
      contentElement.props.className?.includes(
        "-translate-x-1/2 -translate-y-1/2"
      ),
      "Default must include centered translate"
    )
    assert.ok(
      contentElement.props.className?.includes("rounded-xl"),
      "Default must include rounded-xl"
    )

    const markup = renderToStaticMarkup(
      React.createElement(Dialog, { open: true }, contentElement)
    )
    assert.ok(markup.includes("Default Content"), "Must render modal children")
    assert.ok(
      markup.includes("sm:max-w-md"),
      "Rendered markup must have sm:max-w-md"
    )
  })
}

if (isReactServer && !isChildTest) {
  test("Client DOM rendering tests for DialogContent viewport variants via tsx runner", () => {
    const tsxCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs")
    const testFile = path.resolve(
      process.cwd(),
      "tests/dialog-viewport-variants.test.ts"
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
      [tsxCli, "--test", testFile],
      {
        encoding: "utf-8",
        env: childEnv,
      }
    )
    assert.ok(
      output.includes("pass"),
      "Child client DOM rendering tests must pass"
    )
    assert.ok(
      !output.includes("fail 1"),
      "Child client DOM tests must have 0 failures"
    )
  })
}
