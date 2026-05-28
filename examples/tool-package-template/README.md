# ToolBridge Tool Package Template

This is a minimal template for building a ToolBridge-compatible npm tool package.

## Build

```bash
npm install
npm run build
```

## Validate with ToolBridge

Run from this template directory after build:

```bash
npx toolbridge validate .
```

## Add to a ToolBridge project

Run from your project root:

```bash
npx toolbridge add ./examples/tool-package-template
npx toolbridge inspect --project .
```

The template declares one tool: `echo`.
