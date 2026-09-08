Create a minimal but production-realistic Nx monorepo demonstrating architectural standards and dependency boundaries.

The project should use:

- Nx
- React
- TypeScript
- pnpm
- ESLint

Do NOT build a sophisticated UI. The purpose of this repository is to demonstrate monorepo structure, import conventions and dependency enforcement for a technical interview.

## Repository structure

Create:

apps/  
web/  
admin/

libraries/  
ui/  
auth/  
internal-tools/

The two applications should be very small React applications.

The libraries should be:

- `ui` — shared UI components, considered a public/shared library
- `auth` — shared authentication utilities, considered a public/shared library
- `internal-tools` — internal-only utilities that should not be imported directly by applications

## Import aliases

Configure TypeScript path aliases following this convention:

- `@company/web`
- `@company/admin`
- `@company/ui`
- `@company/auth`
- `@company/internal-tools`

Use these aliases for cross-project imports.

Do not use relative imports to access another project.

For example, this should be the preferred form:

import { Button } from '@company/ui';

rather than:

import { Button } from '../../../libraries/ui/src';

## Architectural rules

Implement and enforce the following rules:

1. Applications may depend on shared libraries.
2. Shared libraries must not depend on applications.
3. `ui` must not import from `web` or `admin`.
4. `auth` must not import from `web` or `admin`.
5. Applications should not directly import `internal-tools`.
6. Cross-project imports must use the configured package aliases.
7. Demonstrate at least one intentionally invalid dependency/import which is rejected by linting or another static check.

Use Nx/ESLint mechanisms where appropriate to enforce these rules.

Do NOT invent Nx `depConstraints` if they are not necessary for implementing the requested rules. Prefer a simple, understandable configuration.

## Demonstration

Create a small component in `libraries/ui`, for example:

Button.tsx

The web application should import it using:

import { Button } from '@company/ui';

Create an intentionally invalid example, clearly marked as a demonstration, showing an attempt to import an application from a library, for example:

// INTENTIONALLY INVALID  
import { AppSomething } from '@company/web';

The repository should demonstrate that this violates the configured architecture and is rejected by the static tooling.

Do not leave the repository in a permanently broken state. The invalid example should be isolated in a way that allows the normal project build/lint to pass while providing a documented command or test that demonstrates the expected failure.

## README

Create a concise README explaining:

1. Why the monorepo exists.
2. Repository structure.
3. Import conventions.
4. Dependency rules.
5. How the rules are enforced.
6. How to run the applications.
7. How to run lint/typecheck/tests.
8. How to reproduce the intentionally invalid dependency and see it rejected.

Use a simple ASCII dependency diagram:

apps/web ───────→ libraries/ui  
│  
└──────────→ libraries/auth

apps/admin ─────→ libraries/ui  
│  
└─────────→ libraries/auth

libraries/ui ───→ apps/* NOT ALLOWED  
libraries/auth ─→ apps/* NOT ALLOWED

Keep the implementation intentionally small. Avoid unnecessary dependencies, complex abstractions, elaborate UI, Storybook, state management libraries, Docker, databases, authentication backends or deployment infrastructure.

The goal is a small technical demonstration that can be understood by reviewing the repository in a few minutes.
