# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Building terminal UIs with React Ink, useInput, useFocus, Box/Text, create-ink-app | react-ink | C:\Users\adgbr\.agents\skills\react-ink\SKILL.md |
| Creating or modifying Ink.js components, useInput/useApp/useFocus hooks, emoji width, testing CLI UI | inkjs-design | C:\Users\adgbr\.agents\skills\inkjs-design\SKILL.md |
| Bun runtime: JS/TS dev, bun test, bun build, Bun.file, Bun.serve, Bun.sqlite | bun-development | C:\Users\adgbr\.agents\skills\bun-development\SKILL.md |
| Transform code to clean: meaningful names, small functions, no comments for bad code, SRP, TDD laws | clean-code | C:\Users\adgbr\.agents\skills\clean-code\SKILL.md |
| "caveman mode", "talk like caveman", "less tokens", "be brief", /caveman | caveman | C:\Users\adgbr\.agents\skills\caveman\SKILL.md |
| Compress natural language memory files into caveman format | caveman-compress | C:\Users\adgbr\.agents\skills\caveman-compress\SKILL.md |
| Ultra-compressed commit messages, conventional commits format | caveman-commit | C:\Users\adgbr\.agents\skills\caveman-commit\SKILL.md |
| Ultra-compressed code review comments, one line per issue | caveman-review | C:\Users\adgbr\.agents\skills\caveman-review\SKILL.md |
| Quick-reference card for all caveman modes | caveman-help | C:\Users\adgbr\.agents\skills\caveman-help\SKILL.md |
| Compress memory files (alias for caveman-compress) | compress | C:\Users\adgbr\.agents\skills\compress\SKILL.md |
| PR creation workflow for Agent Teams Lite | branch-pr | C:\Users\adgbr\.config\opencode\skills\branch-pr\SKILL.md |
| Issue creation workflow for Agent Teams Lite | issue-creation | C:\Users\adgbr\.config\opencode\skills\issue-creation\SKILL.md |
| Review adversarial, dual review, "judgment day" | judgment-day | C:\Users\adgbr\.config\opencode\skills\judgment-day\SKILL.md |
| Create new AI skills, add agent instructions | skill-creator | C:\Users\adgbr\.config\opencode\skills\skill-creator\SKILL.md |
| Go tests, Bubbletea TUI testing | go-testing | C:\Users\adgbr\.config\opencode\skills\go-testing\SKILL.md |
| Azure OpenAI deploy, evaluate, manage Foundry agents | microsoft-foundry | C:\Users\adgbr\.agents\skills\microsoft-foundry\SKILL.md |
| Capacity discovery across Azure regions | capacity | C:\Users\adgbr\.agents\skills\microsoft-foundry\models\deploy-model\capacity\SKILL.md |
| Quick preset deploy Azure OpenAI models | preset | C:\Users\adgbr\.agents\skills\microsoft-foundry\models\deploy-model\preset\SKILL.md |
| Custom Azure OpenAI deployment with full control | customize | C:\Users\adgbr\.agents\skills\microsoft-foundry\models\deploy-model\customize\SKILL.md |
| Unified Azure OpenAI deploy with intent routing | deploy-model | C:\Users\adgbr\.agents\skills\microsoft-foundry\models\deploy-model\SKILL.md |
| Deploy to Cloudflare, Docker, GCP, Kubernetes | devops | C:\Users\adgbr\.agents\skills\devops\SKILL.md |
| Docker Compose orchestration, multi-container apps | docker-compose-orchestration | C:\Users\adgbr\.agents\skills\docker-compose-orchestration\SKILL.md |
| Docker containerization expert: optimization, security, multi-stage builds | docker-expert | C:\Users\adgbr\.agents\skills\docker-expert\SKILL.md |
| Optimized multi-stage Dockerfiles | multi-stage-dockerfile | C:\Users\adgbr\.agents\skills\multi-stage-dockerfile\SKILL.md |
| Dokploy PaaS: deploy, manage apps, databases, domains | dokploy-api-mcp | C:\Users\adgbr\.agents\skills\dokploy-api-mcp\SKILL.md |
| Terraform IaC: AWS, Azure, GCP modules, state management | terraform-engineer | C:\Users\adgbr\.agents\skills\terraform-engineer\SKILL.md |
| WebSockets/Socket.IO: real-time communication | websocket-engineer | C:\Users\adgbr\.agents\skills\websocket-engineer\SKILL.md |
| Review UI, check accessibility, audit design | web-design-guidelines | C:\Users\adgbr\.agents\skills\web-design-guidelines\SKILL.md |
| Angular 17+ standalone components, NgRx, RxJS | angular-architect | C:\Users\adgbr\.agents\skills\angular-architect\SKILL.md |
| Angular v20+ standalone components, signals, OnPush | angular-component | C:\Users\adgbr\.agents\skills\angular-component\SKILL.md |
| Angular v20+ DI with inject(), tokens, providers | angular-di | C:\Users\adgbr\.agents\skills\angular-di\SKILL.md |
| Angular v20+ custom directives, DOM manipulation | angular-directives | C:\Users\adgbr\.agents\skills\angular-directives\SKILL.md |
| Angular v21+ signal-based forms | angular-forms | C:\Users\adgbr\.agents\skills\angular-forms\SKILL.md |
| Angular v20+ resource(), httpResource(), HttpClient | angular-http | C:\Users\adgbr\.agents\skills\angular-http\SKILL.md |
| Angular v20+ routing, lazy loading, guards | angular-routing | C:\Users\adgbr\.agents\skills\angular-routing\SKILL.md |
| Angular v20+ signals: signal(), computed(), effect() | angular-signals | C:\Users\adgbr\.agents\skills\angular-signals\SKILL.md |
| Angular v20+ testing with Vitest/Jasmine, signals | angular-testing | C:\Users\adgbr\.agents\skills\angular-testing\SKILL.md |
| Angular CLI: setup, generate, build, test | angular-tooling | C:\Users\adgbr\.agents\skills\angular-tooling\SKILL.md |
| Spartan UI integration for Angular projects | spartan-ui | C:\Users\adgbr\.agents\skills\spartan-ui\SKILL.md |
| Diátaxis documentation framework | documentation-writer | C:\Users\adgbr\.agents\skills\documentation-writer\SKILL.md |
| Structured autonomy planning | structured-autonomy-plan | C:\Users\adgbr\.agents\skills\structured-autonomy-plan\SKILL.md |
| Update specification files for AI consumption | update-specification | C:\Users\adgbr\.agents\skills\update-specification\SKILL.md |
| Git Flow branch creator | git-flow-branch-creator | C:\Users\adgbr\.agents\skills\git-flow-branch-creator\SKILL.md |
| Create PR from spec file | create-github-pull-request-from-specification | C:\Users\adgbr\.agents\skills\create-github-pull-request-from-specification\SKILL.md |
| Create GitHub Actions workflow spec | create-github-action-workflow-specification | C:\Users\adgbr\.agents\skills\create-github-action-workflow-specification\SKILL.md |
| Create implementation plan | create-implementation-plan | C:\Users\adgbr\.agents\skills\create-implementation-plan\SKILL.md |
| Multi-file refactor plan | refactor-plan | C:\Users\adgbr\.agents\skills\refactor-plan\SKILL.md |
| Write coding standards from files/folders | write-coding-standards-from-file | C:\Users\adgbr\.agents\skills\write-coding-standards-from-file\SKILL.md |
| GitHub issues: create, update, manage | github-issues | C:\Users\adgbr\.agents\skills\github-issues\SKILL.md |
| Architecture blueprint generator | architecture-blueprint-generator | C:\Users\adgbr\.agents\skills\architecture-blueprint-generator\SKILL.md |
| Product Requirements Documents (PRDs) | prd | C:\Users\adgbr\.agents\skills\prd\SKILL.md |
| GitHub CLI (gh) comprehensive reference | gh-cli | C:\Users\adgbr\.agents\skills\gh-cli\SKILL.md |
| Git commit with conventional messages | git-commit | C:\Users\adgbr\.agents\skills\git-commit\SKILL.md |
| GitHub Actions CI/CD workflows | github-actions-workflow | C:\Users\adgbr\.agents\skills\github-actions-workflow\SKILL.md |
| GitHub Flow branching model | github-flow | C:\Users\adgbr\.agents\skills\github-flow\SKILL.md |
| NestJS testing with Jest | nestjs-testing-expert | C:\Users\adgbr\.agents\skills\nestjs-testing-expert\SKILL.md |
| Prisma database setup | prisma-database-setup | C:\Users\adgbr\.agents\skills\prisma-database-setup\SKILL.md |
| Find and install agent skills | find-skills | C:\Users\adgbr\.agents\skills\find-skills\SKILL.md |
| Gemini models API, multimodal, function calling | gemini-api-dev | C:\Users\adgbr\.agents\skills\gemini-api-dev\SKILL.md |
| NestJS best practices | nestjs-best-practices | C:\Users\adgbr\.agents\skills\nestjs-best-practices\SKILL.md |
| BullMQ Redis job queues | bullmq-specialist | C:\Users\adgbr\.agents\skills\bullmq-specialist\SKILL.md |
| CLI builder: Node.js Commander/Inquirer/Ora, Python Click/Typer | cli-builder | C:\Users\adgbr\.agents\skills\cli-builder\SKILL.md |
| Bun runtime for JS/TS apps | Bun | C:\Users\adgbr\.agents\skills\bun\SKILL.md |
| NotebookLM query for source-grounded answers | notebooklm | C:\Users\adgbr\.agents\skills\notebooklm\SKILL.md |
| Vercel React/Next.js performance optimization | vercel-react-best-practices | C:\Users\adgbr\.agents\skills\vercel-react-best-practices\SKILL.md |
| Refactor: extract functions, rename, design patterns | refactor | C:\Users\adgbr\.agents\skills\refactor\SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### react-ink
- `<Box>` is Flexbox container; only `<Text>` and string literals can contain text — never put raw text inside `<Box>`
- `useInput` captures keyboard events `(input, key)` — requires raw mode on stdin; check `isRawModeSupported` for CI/piped fallback
- `useFocus` marks components focusable; Tab/Shift+Tab cycles focus; `useFocusManager` for programmatic control
- `<Static>` renders items once above dynamic area — items need stable keys or they re-render
- `render()` returns `{rerender, unmount, waitUntilExit, clear, cleanup}` — app stays alive while pending timers/promises/stdin exist
- Ink v6+ is ESM-only — use `import` syntax and `"type": "module"`; requires Node >= 20, React >= 19
- Use `useWindowSize()` for responsive terminal layouts
- Handle exit via `useApp().exit()` or Ctrl+C with `exitOnCtrlC: false` in render options

### inkjs-design
- Component classification: Screen (full-page, useInput, Header/Content/Footer), Part (reusable, React.memo, stateless), Common (input, controlled/uncontrolled, focus)
- Emoji width: use `string-width` overrides for icons — v8 miscalculates emoji widths
- useInput conflicts: multiple hooks all fire — use early return or `isActive` flag to gate
- Ctrl+C: set `exitOnCtrlC: false` in render, handle manually with `useApp().exit()`
- Dynamic height: `rows - HEADER_LINES - FOOTER_LINES` for visible content calculation
- React.memo with custom comparator for list items to avoid unnecessary re-renders
- Multi-screen navigation: stack-based `useState<ScreenType[]>` with navigateTo/goBack

### bun-development
- `bun test` is built-in test runner — no external framework needed; supports `--watch`, `--coverage`, `--grep`
- `bun build` for bundling — `--target node`, `--minify`, `--compile` for standalone executables
- Native TypeScript/JSX execution — no transpiler needed
- `Bun.file()` for fast file I/O; `Bun.serve()` for HTTP; `bun:sqlite` for SQLite
- Use `bun:sqlite` instead of external SQLite drivers for better performance
- `bun install` is 10-100x faster than npm; `bun.lock` is binary lockfile
- Environment: `.env` loaded automatically; access via `Bun.env` or `process.env`
- Watch mode: `bun --watch run file.ts` for auto-restart on changes

### clean-code
- Functions: small (<20 lines), do ONE thing, one level of abstraction, 0-2 args ideal
- Names: intention-revealing, pronounceable, searchable; classes=nouns, methods=verbs
- Comments: don't comment bad code — rewrite it; good comments = legal, informative, clarification, TODOs
- Error handling: use exceptions over return codes; don't return/pass null
- Classes: single responsibility (SRP), stepdown rule (top-down narrative)
- TDD laws: (1) no production code without failing test, (2) no more test than sufficient to fail, (3) no more code than sufficient to pass
- F.I.R.S.T. tests: Fast, Independent, Repeatable, Self-Validating, Timely
- Law of Demeter: avoid `a.getB().getC().doSomething()`

### caveman
- Drop articles, filler, pleasantries, hedging; fragments OK; technical terms exact
- Pattern: `[thing] [action] [reason]. [next step].`
- Code/commits/PRs: write normal — caveman only applies to prose
- Auto-clarity: drop caveman for security warnings, irreversible actions, multi-step sequences
- Off: "stop caveman" or "normal mode"

## Project Conventions

No convention files found (no AGENTS.md, CLAUDE.md, .cursorrules, GEMINI.md, or copilot-instructions.md in project root).
