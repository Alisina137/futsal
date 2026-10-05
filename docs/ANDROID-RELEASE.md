# Android Pilot Release

## Build profiles

Phase 8 defines three EAS profiles in `apps/mobile/eas.json`:

- `development`: development-client build.
- `preview`: internal-distribution APK for pilot testers.
- `production`: Android App Bundle (AAB) for Google Play.

The canonical Android package remains `com.leaguekick.app`. Do not change it after distribution without treating that as a separate application.

## Before the first EAS build

From the repository root:

```powershell
pnpm install
pnpm verify
pnpm dlx eas-cli@latest login
cd apps\mobile
pnpm dlx eas-cli@latest project:init
```

The EAS account/project association is external configuration and must not be guessed or committed as another person's project ID.

Configure the preview/production `EXPO_PUBLIC_API_URL` as an HTTPS endpoint reachable by the device. Never place API secrets, database credentials, JWT secrets, or admin credentials in `EXPO_PUBLIC_*` values.

## Internal APK

```powershell
cd C:\projects\futsal\apps\mobile
pnpm dlx eas-cli@latest build --platform android --profile preview
```

Install that APK on at least one small Android phone and one representative larger Android device before pilot expansion.

## Play AAB

After all Phase 8 go/no-go checks are signed off:

```powershell
cd C:\projects\futsal\apps\mobile
pnpm dlx eas-cli@latest build --platform android --profile production
```

The production profile uses remote auto-incremented build numbers. Keep the user-facing semantic version in `app.json` deliberate.

## Store assets

Committed assets:

- `apps/mobile/assets/icon.png`
- `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/assets/store/feature-graphic.png`
- listing copy in `docs/store/PLAY-STORE-LISTING.md`

Store screenshots must be captured from the real verified pilot build. Do not use fabricated screenshots as evidence of the shipping UI. Capture Dari and/or Pashto RTL screens plus the most important booking/owner/competition flows.

Before public Play submission, the operator must supply and publish:

- final support email;
- publicly reachable privacy-policy URL;
- real store screenshots;
- Play Console data-safety answers based on the deployed services;
- signing/Play Console account configuration.

## Pilot update rule

An APK/AAB is releasable only from a commit where `pnpm verify` is green and the live-device items in `docs/PHASE-08-TEST-PLAN.md` have been recorded. A successful build alone is not release signoff.
