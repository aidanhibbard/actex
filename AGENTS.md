## Design

Always refer to .agents/skills/api-design/SKILL.md

## Rules

prefer OOP

Prefer classes not implementing methods, they expose a implementation as a surface

Always use public private static final readonly etc no method or declaration goes un-noted

Never expose classes

```ts
const defineWorkflow = () => Workflow.create()
```

Prefer const over function to avoid hoisting

Never use `eslint-disable`, `eslint-disable-next-line`, or comments to suppress lint rules. Fix the code or adjust eslint.config.ts with explicit project conventions.

## Directory structure

Classes is what it is, and uses a barrel export

Services are the methods classes expose and implement, one service per file, use barrel exports

```ts
export const service = () => {}
```

### Interfaces are all interfaces

Service code does not include types or interfaces

One interface per file

### Types

Service code does not implement types or interfaces

One type per file

### utils

utils are dried services that get re-used

Think formatting a date, or money

One util per file

### Spec

Spec is a directory of unit tests, test coverage always maintains 100% with coverage no violations

Code must be written in a testable way, no ignoring coverage

Spec is designed afer lib

IE

spec/lib/classes/step.spec.ts

And so forth

