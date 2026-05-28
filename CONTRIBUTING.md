# Contributing to ToolBridge

Thanks for your interest in contributing.

Core principle:

Install many. Declare many. Expose few.

## What We Welcome

- Bug fixes
- Test improvements
- Documentation improvements
- Small, focused architecture improvements aligned with current scope

## What We Do Not Want in This Repo

- Marketplace features
- Desktop app features
- Remote server or daemon architecture
- Docker-first workflow requirements
- npm install/uninstall management features
- Automatic scanning of `node_modules` and exposing all tools by default

## Development Commands

```bash
npm install
npm run typecheck
npm run test
npm run build
npm pack --dry-run
```

## Pull Request Checklist

Please include:

- What changed
- Why it is needed
- How it was tested
