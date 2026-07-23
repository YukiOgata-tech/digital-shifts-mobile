# Repository Guidelines

## Project Structure & Module Organization

This is an Expo SDK 57 React Native application using Expo Router and Supabase.

- `src/app/`: file-based routes, route groups, layouts, and modal entry points.
- `src/screens/`: screen-level presentation and interactions.
- `src/features/`: domain logic for auth, staff context, attendance, and notifications.
- `src/components/`: reusable UI, auth, and notification components.
- `src/lib/`: Supabase, environment, storage, and query-client infrastructure.
- `assets/images/brand/`: shared Dミセ brand assets.
- `supabase/migrations/`: timestamped database migrations and RLS/RPC changes.
- `docs/`: implementation status and architecture decisions.

Keep route files thin; place data access and business rules in `src/features/`.

## Build, Test, and Development Commands

- `npm install`: install locked dependencies.
- `npm start`: start the Expo development server.
- `npm run ios` / `npm run android`: launch the platform development target.
- `npm run web`: run the web target.
- `npm run lint`: run Expo ESLint checks.
- `npx tsc --noEmit`: perform strict TypeScript validation.
- `npx expo install --check`: verify Expo-compatible dependency versions.
- `npx expo config --type public`: validate resolved Expo configuration.

Before opening a PR, run lint, TypeScript, and `git diff --check`.

## Coding Style & Naming Conventions

Use TypeScript, two-space indentation, single quotes, and semicolons. Components and exported types use `PascalCase`; functions, hooks, and variables use `camelCase`; hooks begin with `use`. Use kebab-case filenames such as `staff-provider.tsx`. Prefer `@/` imports over deep relative paths.

Follow the existing native UI patterns and read the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before changing Expo APIs.

## Testing Guidelines

No automated test runner is configured yet. Treat `npm run lint` and `npx tsc --noEmit` as mandatory checks. For new business logic, add focused tests when introducing a test framework; use `*.test.ts` or `*.test.tsx`. Verify permission-dependent behavior on real iOS and Android devices without relying only on simulators.

## Commit & Pull Request Guidelines

History is currently minimal, so use short imperative commits, for example `Add staff shift submission flow`. Keep database, client, and documentation changes together when they form one feature. PRs should explain user impact, list verification commands, link relevant issues, include UI screenshots for visual changes, and call out migrations or environment-variable additions.

## Security & Configuration

Copy `.env.example` to `.env`. Never place service-role, email, SMTP, or Expo access tokens in `EXPO_PUBLIC_*`. Server-only examples belong in `supabase/.env.example`. Preserve RLS, require authenticated RPC access, and document every production schema change.
