---
name: flutter-guidelines
description: Invoke BEFORE writing any Flutter/Dart mobile code (widgets, screens, providers, routes, platform config) targeting Android. Encodes the project's Flutter + Riverpod + feature-first architecture, Android build/signing rules, and tooling commands.
---

# Flutter Guidelines (Android)

Follow these before writing any Flutter/Dart code.

## Stack
- Language: Dart (null-safe, latest stable SDK). Framework: Flutter stable channel.
- Target: **Android** (phones first). iOS config untouched unless asked.
- State: **Riverpod 3** (`flutter_riverpod` + `riverpod_annotation` codegen).
- Routing: `go_router`. HTTP: `dio`. Models: `freezed` + `json_serializable`.
- Lints: `flutter_lints` via `analysis_options.yaml`.
- Load the `frontend-design` skill and design against it. Gather the design brief first: reference image, nav placement (bottom nav vs drawer), default screen, logo, app idea, brand colors / theme / target device — unless the interviewer already handed it over.
- Use **Context7 MCP** for current, version-accurate docs of Flutter, Riverpod, go_router, dio, freezed — never rely on training data for API syntax, config, or migrations.

## Architecture — feature-first
```
lib/
  main.dart              # runApp(ProviderScope(child: App()))
  app.dart               # MaterialApp.router, theme, router wiring
  core/                  # cross-feature only: theme/, router/, network/, errors/, extensions/
  features/<feature>/
    data/                # dtos, api clients, repositories impl
    domain/              # entities, repository interfaces (only if the feature earns it)
    presentation/        # screens/, widgets/, providers (feature-scoped)
```
- Nothing in `core/` that only one feature uses. Nothing in `features/` imported across features except through its public providers.
- Files ≤ ~500 lines; split when they grow past that. One public widget per file.
- Files/dirs `snake_case.dart`; classes `PascalCase`; members/vars `camelCase`; private `_leadingUnderscore`.
- No barrel files unless they remove real friction.
- Comments minimal — explain *why*, never *what*.

## Widget rules
- Prefer `StatelessWidget` / `ConsumerWidget`. `StatefulWidget` only for controllers, animations, focus nodes — dispose them.
- **`const` everywhere it compiles.** Constructors take `{super.key}`.
- Compose with small private widget classes, **not** `Widget _buildX()` methods — extracted classes rebuild independently.
- No business logic, no I/O, no `async` work in `build()`. Never call `setState` from `build`.
- Layout: `SafeArea` at screen roots, `Expanded`/`Flexible` inside `Row`/`Column`, `ListView.builder` for any list that can grow. No fixed pixel sizes for text containers — respect text scaling.
- Theme via `ThemeData` + `ColorScheme.fromSeed`, read through `Theme.of(context)`. No hardcoded colors, no magic spacing constants scattered inline.
- Guard `BuildContext` use after `await` with `if (!context.mounted) return;`.
- Every async screen state handles loading + error + empty. No spinner-forever paths.
- Accessibility basics: tap targets ≥ 48dp, `Semantics`/labels on icon-only buttons, contrast from the theme.

## State — Riverpod 3
- Wrap the app once in `ProviderScope`. Consume via `ConsumerWidget` / `ConsumerStatefulWidget`, or `Consumer` for narrow rebuild scopes.
- Declare providers with the `@riverpod` annotation + codegen. Async state = `AsyncNotifier`/`FutureProvider` — never hand-rolled loading booleans.
- `ref.watch` in `build`; `ref.read(provider.notifier)` inside callbacks only. Never `ref.watch` in a callback.
- Render `AsyncValue` with a `switch` on `AsyncData`/`AsyncError`/loading — no `.value!`.
- Notifier state is immutable: reassign `state = ...`, never mutate in place.
- Keep providers small and single-purpose; feature providers live in that feature, shared ones in `core/`.
- Riverpod 3: unified `Notifier` (no `FamilyNotifier`, no `StateNotifierProvider`, no `ChangeNotifierProvider`) — verify against Context7 before using older APIs.

## Data & models
- `freezed` for entities/DTOs, `json_serializable` for parsing. No hand-written `fromJson` boilerplate.
- Parse at the boundary: DTO in `data/`, mapped to a domain model. Widgets never touch raw JSON.
- One `Dio` instance provided via Riverpod, base URL + interceptors configured in `core/network/`. No `http` calls scattered in widgets.
- Repositories return typed results and throw typed failures; UI maps failures to messages. Never surface raw exception strings to users.
- Secrets/keys never in Dart source or git — pass via `--dart-define` / `--dart-define-from-file`.

## Routing (go_router)
- One router config in `core/router/`. Named routes with typed params; no ad-hoc `Navigator.push(MaterialPageRoute(...))` for top-level navigation.
- Auth/onboarding gating via `redirect`, not per-screen checks.
- Handle Android back behavior deliberately (`PopScope`) where a screen has unsaved state.

## Android specifics
- `minSdk`/`targetSdk`/`compileSdk` set explicitly in `android/app/build.gradle.kts` — no defaults left implicit.
- Permissions: only what the feature needs, declared in `AndroidManifest.xml`, requested at runtime with a denial path that still works.
- Release signing from `android/key.properties` — **never commit** the keystore or that file; add both to `.gitignore`.
- Release build = App Bundle: `flutter build appbundle --release`. Use `--split-per-abi` only for APK distribution.
- Keep `applicationId` stable. Version via `pubspec.yaml` `version: x.y.z+build`.
- Test on a real device or emulator before calling it done — a screen that only renders in the widget tree isn't verified.

## Tooling — run before done
- Codegen (when annotations changed): `dart run build_runner build --delete-conflicting-outputs`
- Format: `dart format .`
- Analyze (type + lint gate): `flutter analyze`
- Tests: `flutter test`
- All must pass clean before handing off.

## Laziness
- Framework first: built-in widgets, `Theme`, `Intl`, `shared_preferences` before any new package. No dependency for what a few lines already do.
- Check `pubspec.yaml` before adding anything — reuse what's installed.
- No speculative abstractions, no `domain/` layer for a feature that just reads one endpoint, no scaffolding "for later".

## Conditional rules
- When the feature needs **local persistence**, use `shared_preferences` for flat key/value; reach for `drift` (SQL) or `hive`/`isar` only when relations or bulk queries actually exist. Wrap it behind a repository.
- When the feature needs **native APIs**, prefer an existing pub.dev plugin; write a `MethodChannel` only if none fits, and keep the Kotlin side thin.
- When the feature needs **background work**, use `workmanager`/`android_alarm_manager_plus` — never a long-lived isolate loop for scheduling.
- When **flavors/environments** are requested, configure Gradle product flavors + `--dart-define-from-file` per env; don't fork code paths with `if (isProd)`.
- When the app is **offline-capable**, cache at the repository layer and expose a single freshness state; don't scatter connectivity checks in widgets.
- When a screen has **heavy lists or images**, use `ListView.builder` + `cacheExtent` and `cached_network_image`; profile with DevTools before optimizing further.
