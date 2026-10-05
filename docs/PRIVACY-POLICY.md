# Futsal Pilot Privacy Notice

**Status:** implementation-aligned pilot draft; review and publish through the operator's official channel before public store release.

## Data used by the pilot

The current product can process:

- account identity such as display name, username, phone number, preferred language and roles;
- venue profile, location text, opening hours, areas, prices and operational status;
- booking details, booking source, times, prices, cancellation state and related identifiers;
- team, roster, competition, fixture, result and player-stat data;
- venue posts, promotions, follows and notification preferences;
- push-device tokens when push registration is used;
- venue subscription/payment-record metadata used by platform operators;
- security/session records and privileged-action audit logs.

Passwords are not stored as readable passwords. Mobile refresh-session data is stored using the device secure-store facility.

## Why the data is used

The implementation uses data to provide authentication, venue discovery, availability, reservations, venue operations, teams, competitions, notifications, subscriptions, support, fraud/abuse controls, and auditability.

## Public and private information

Public venue, team, competition and content views intentionally expose product information meant for discovery. Private account/contact fields and privileged operational records must remain behind authenticated/authorized API boundaries. Team privacy rules and role/object-scoped authorization continue to apply.

## Operational logs

Release request logs contain a correlation ID, HTTP method, normalized route, status code and duration. They are designed not to contain Authorization headers, request bodies, passwords, refresh tokens or database connection strings.

## Service providers

The pilot currently relies on infrastructure/services configured by the operator, including PostgreSQL/Neon and Expo-related mobile services where enabled. Before public launch, the operator must review the privacy terms and regional availability of every deployed provider and accurately reflect them in the published policy and Play data-safety form.

## Retention and deletion

Retention periods are an operator policy decision and are not silently invented by the application. The operator should retain personal and operational data only for legitimate product, legal, security and support needs, and define deletion/export procedures before broad public launch.

## Security

Controls in the implementation include TLS-ready production configuration, hashed refresh-token storage, short-lived access tokens, refresh rotation/revocation, secure mobile session storage, rate limits, server-side authorization, audit logs, request correlation, no-store API responses and production environment validation.

No technical system can promise absolute security. Suspected incidents should follow `docs/OPERATIONS-RUNBOOK.md`.

## User questions and requests

The release build can show the operator-configured support email in Settings → Support & diagnostics. The operator must configure a monitored support contact before public release and use it for privacy/access/correction/deletion requests.

## Advertising/data sale

No advertising-data sale integration is implemented in the Phase 8 pilot codebase. If the deployed product later adds advertising, analytics, payments, or other data-sharing integrations, this notice and store disclosures must be updated before those integrations are enabled.
