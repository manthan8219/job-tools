# AGENT.MD — Engineering Playbook & Agent Guidelines

> **Target Audience**: AI coding agents, pair programmers, and engineers working on `job-applier-mcp`.  
> **Philosophy**: Clean Architecture · Strict Type Safety · Test-Driven Development · Zero Architectural Regression.  
> **Last Reviewed**: 2026-09-11

---

## 1. Project Identity

**`job-applier-mcp`** is an agentic Model Context Protocol (MCP) server built with **Mastra AI** (`@mastra/core` + `@mastra/mcp`) to automate job searching, resume/skill matching, application drafting, and application tracking.

**Runtime**: Node.js 23+ · TypeScript 5.8+ · ESM (`"type": "module"`)

---

## 2. Layered Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    MCP CLIENT LAYER                          │
│         (Cursor, Claude Desktop, Antigravity, etc.)          │
└────────────────────────────▲─────────────────────────────────┘
                             │ Stdio / SSE transport
┌────────────────────────────▼─────────────────────────────────┐
│                      MCP LAYER (src/tools/, src/workflows/)  │
│  • Mastra createTool / createWorkflow definitions            │
│  • Zod input/output schemas                                  │
│  • Delegates ALL logic to the Service layer                  │
│  • NEVER contains raw SQL, Mongo queries, or business logic  │
└────────────────────────────▲─────────────────────────────────┘
                             │ function calls
┌────────────────────────────▼─────────────────────────────────┐
│               SERVICE LAYER (src/services/)                  │
│  • Pure business logic (matching, scoring, tailoring)        │
│  • Orchestrates DB reads/writes via the Data layer           │
│  • Stateless, easily unit-testable with mocked dependencies  │
└────────────────────────────▲─────────────────────────────────┘
                             │ queries & mutations
┌────────────────────────────▼─────────────────────────────────┐
│                  DATA LAYER (src/db/)                         │
│  • PostgreSQL pool manager (pg)                              │
│  • MongoDB client manager (mongodb driver)                   │
│  • Connection lifecycle, health checks, graceful shutdown    │
│  • ZERO awareness of MCP, Mastra, or business rules          │
└──────────────────────────────────────────────────────────────┘
```

### Dependency Flow (Strict — No Upward References)

```
src/tools/  →  imports from  →  src/services/
src/services/  →  imports from  →  src/db/, src/models/, src/types/
src/db/  →  imports from  →  src/config.ts  (and nothing else in src/)
```

> [!IMPORTANT]  
> **The Data layer (`src/db/`) MUST NEVER import from `src/tools/`, `src/services/`, or `@mastra/*`.**  
> This is the extraction boundary — when scale demands it, `src/db/` and `src/services/` can be moved into an independent backend microservice with zero refactoring.

---

## 3. Technology Stack — What to Use When

| Need | Tool | When & Why |
| :--- | :--- | :--- |
| **MCP Tool (single action)** | `createTool` from `@mastra/core/tools` | Wrap any discrete capability: search, match, save, fetch. Always define `id`, `description`, `inputSchema` (Zod), and `execute`. |
| **MCP Workflow (multi-step)** | `createWorkflow` from `@mastra/core/workflows` | Chain steps with branching, state, retries. Use for pipelines like: scrape → match → tailor → submit. Always include a `description` (required by MCPServer). |
| **MCP Agent (LLM reasoning)** | `Agent` from `@mastra/core/agent` | When a tool needs LLM intelligence (e.g., generating cover letters with an actual model). Always include a `description`. |
| **Schema validation** | `zod` | Every external boundary: tool inputs, API responses, environment config. Derive TypeScript types with `z.infer<typeof schema>` — never duplicate types manually. |
| **Structured/relational data** | PostgreSQL (`pg`) | Applicant profiles, application status tracking (state machines), companies, audit logs, analytics. Use parameterized queries (`$1`, `$2`) — never string interpolation. |
| **Unstructured/polymorphic data** | MongoDB (`mongodb`) | Scraped job listings (varied schemas per source), parsed resume documents, cover letter drafts, skill taxonomy caches. |
| **Configuration** | `dotenv` + `src/config.ts` | All env vars read once in `config.ts` and exported as a typed `AppConfig` object. **No raw `process.env` access anywhere else in the codebase.** |
| **Testing** | `vitest` | Unit and integration tests. `npm run build` = `vitest run && tsc` — build fails if any test fails. |
| **Dev runner** | `tsx` | Fast TypeScript execution without pre-compilation. Use `npm run dev` for local development. |

---

## 4. Database Decision Guide

### PostgreSQL (structured, relational, transactional)

| Data | Reason |
| :--- | :--- |
| Job Applications | Status state machine (`saved → applied → interviewing → offered → rejected`), foreign keys, timestamps |
| Applicant Profiles | Structured contact info, preferences, employment authorization |
| Companies | Deduplicated company records linked to applications |
| Metrics & Analytics | Counters, conversion rates, response time tracking |

### MongoDB (flexible, document-oriented, schema-diverse)

| Data | Reason |
| :--- | :--- |
| Job Postings | Every job board (LinkedIn, Indeed, Greenhouse, Lever) returns different JSON shapes — schema-less storage avoids constant migrations |
| Resume Documents | Deeply nested, arbitrarily structured work experience blocks, education, certifications |
| Tailored Outputs | Versioned cover letter markdown, customized bullet points, multiple drafts per application |

> [!TIP]  
> **Rule of thumb**: If the data has foreign key relationships or needs transactions → PostgreSQL. If the schema varies per source or is deeply nested → MongoDB.

---

## 5. Directory & File Naming Conventions

### Project Layout

```
job-applier-mcp/
├── src/
│   ├── config.ts                # Typed environment configuration
│   ├── index.ts                 # Entry point: boots DB connections → starts MCPServer
│   ├── types/                   # Cross-domain interfaces and DTOs
│   ├── db/                      # Database connection managers
│   ├── utils/                   # Shared cross-domain utilities (logger, errors)
│   ├── user/                    # Core Business Domain (User)
│   │   ├── models/              # Zod schemas & types
│   │   ├── repositories/        # DB queries & data access
│   │   └── services/            # Pure business logic
│   ├── tools/                   # External MCP Tools (Interface Layer)
│   │   └── user/                # User-related MCP tools
│   │       └── userTools.ts
│   └── workflows/               # Cross-domain Mastra workflows
├── tests/
│   ├── db.test.ts
│   ├── server.test.ts
│   ├── tools/
│   │   └── user/
│   │       └── userTools.test.ts
│   └── user/
│       ├── userRepository.test.ts
│       └── userService.test.ts
├── data/                        # Local data files (gitignored if sensitive)
├── AGENT.MD                     # This file
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── .env.example                 # Template for environment variables
├── .env                         # Actual env vars (gitignored)
└── .gitignore
```

### Naming Rules

| Element | Convention | Examples |
| :--- | :--- | :--- |
| **Directories** | lowercase, single word | `db`, `tools`, `services`, `models`, `types`, `workflows` |
| **Source files** | camelCase.ts | `postgres.ts`, `searchJobs.ts`, `matchSkills.ts` |
| **Test files** | camelCase.test.ts in `tests/` | `db.test.ts`, `searchJobs.test.ts` |
| **Types & Interfaces** | PascalCase | `JobListing`, `ApplicationStatus`, `AppConfig` |
| **Enums & Zod schemas** | PascalCase (schemas suffixed with `Schema`) | `ApplicationStatusSchema`, `JobListingSchema` |
| **Functions & variables** | camelCase | `getPostgresPool()`, `matchCandidateSkills()` |
| **Constants** | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT_MS`, `MAX_POOL_SIZE` |
| **Barrel exports** | Every directory with 2+ files gets an `index.ts` | Re-exports public API of that module |

---

## 6. Coding Standards

### 6.1 ESM Import Rules (Critical)

TypeScript with `"module": "NodeNext"` requires `.js` extensions on all relative imports:

```typescript
// ✅ CORRECT
import { config } from "./config.js";
import { getPostgresPool } from "../db/postgres.js";

// ❌ WRONG — will fail at runtime
import { config } from "./config";
```

Package imports do NOT use extensions:
```typescript
// ✅ CORRECT
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
```

### 6.2 Error Handling

**Data layer**: Return result objects, never throw to callers:
```typescript
// ✅ Health checks and connection tests
async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query("SELECT 1");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
```

**MCP tools**: Return user-friendly error content to the calling LLM, never crash the process:
```typescript
// ✅ Inside a tool's execute function
execute: async (input) => {
  try {
    const result = await someService(input);
    return result;
  } catch (err: any) {
    return { error: true, message: `Failed to process: ${err.message}` };
  }
}
```

### 6.3 Database Safety

- **Parameterized queries only** — never interpolate user input into SQL:
  ```typescript
  // ✅ CORRECT
  await pool.query("SELECT * FROM applications WHERE id = $1", [id]);
  
  // ❌ NEVER
  await pool.query(`SELECT * FROM applications WHERE id = '${id}'`);
  ```
- **Always set connection timeouts** to prevent hanging tests/boot on offline databases.
- **Close connections in test teardown** using `afterEach` or `afterAll`.

### 6.4 Zod as Single Source of Truth

Define Zod schemas first, derive TypeScript types from them:

```typescript
// ✅ CORRECT — Zod schema is the source
import { z } from "zod";

export const JobListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
});

export type JobListing = z.infer<typeof JobListingSchema>;

// ❌ WRONG — manually duplicating the type
interface JobListing {
  id: string;
  title: string;
  company: string;
}
```

### 6.5 Tool Definition Pattern

Every Mastra tool follows this exact structure:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { someService } from "../services/someService.js";

export const myTool = createTool({
  id: "my-tool",                    // kebab-case
  description: "Clear, concise description for the LLM to understand when to use this tool.",
  inputSchema: z.object({ /* ... */ }),
  execute: async (input) => {
    // Delegate to service layer — no business logic here
    return await someService(input);
  },
});
```

### 6.6 Service Function Pattern

Services are pure logic, receive typed inputs, return typed outputs:

```typescript
// src/services/matchSkills.ts
import { queryPostgres } from "../db/postgres.js";
import type { SkillMatchResult } from "../types/index.js";

export async function matchCandidateSkills(
  candidateSkills: string[],
  jobRequirements: string[]
): Promise<SkillMatchResult> {
  // Pure business logic + DB queries
  // No MCP/Mastra imports
}
```

---

## 7. Testing Standards

### 7.1 Test-Driven Discipline (Non-Negotiable)

- Every new function, service, or tool **must** have corresponding tests.
- Never remove or `skip` an existing test to make code pass — fix the implementation.
- Tests must be deterministic — no reliance on real database state, network, or timing.

### 7.2 Test File Organization

Tests mirror the source structure:

| Source File | Test File |
| :--- | :--- |
| `src/db/postgres.ts` | `tests/db.test.ts` |
| `src/tools/searchJobs.ts` | `tests/searchJobs.test.ts` |
| `src/services/matchSkills.ts` | `tests/matchSkills.test.ts` |
| `src/index.ts` | `tests/server.test.ts` |

### 7.3 Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Feature or Module Name", () => {
  afterEach(() => {
    vi.restoreAllMocks();  // Clean up mocks between tests
  });

  it("should [expected behavior] when [condition]", () => {
    // Arrange → Act → Assert
  });
});
```

### 7.4 Mocking Database Calls in Service/Tool Tests

Use `vi.mock()` to isolate service tests from real database connections:

```typescript
import { vi } from "vitest";

vi.mock("../src/db/postgres.js", () => ({
  queryPostgres: vi.fn().mockResolvedValue({ rows: [{ id: "1" }], rowCount: 1 }),
}));
```

### 7.5 Available Commands

| Command | Purpose |
| :--- | :--- |
| `npm test` | Run full test suite once |
| `npm run test:watch` | Run tests in watch mode (re-runs on file change) |
| `npm run build` | **`vitest run && tsc`** — tests must pass before TypeScript compiles |
| `npm run dev` | Start server locally with hot-reload via `tsx` |

---

## 8. Git & Collaboration Hygiene

- **Never commit** `.env`, `node_modules/`, `dist/`, or `data/` with secrets.
- **Commit messages**: Use imperative present tense: `Add job search tool`, `Fix MongoDB timeout in tests`.
- **One logical change per commit** — don't mix refactors with new features.

---

## 9. Verification Checklist

Before marking **any** task as complete, verify:

- [ ] All new functions/modules have corresponding unit tests in `tests/`.
- [ ] `npm test` passes with **0 failures**.
- [ ] `npm run build` passes (test gate + TypeScript type-check).
- [ ] No extraneous dependencies, dead imports, or orphaned files.
- [ ] File and folder naming matches the conventions in Section 5.
- [ ] Dependency flow follows Section 2 (no upward imports).
- [ ] No raw `process.env` outside `src/config.ts`.
- [ ] No raw SQL string interpolation — parameterized queries only.
- [ ] All relative imports include the `.js` extension.
