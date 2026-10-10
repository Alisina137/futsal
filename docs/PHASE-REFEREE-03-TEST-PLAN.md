# Referee Dashboard — Phase 3 acceptance and manual release checks
Date: 2026-10-10. Perform on Android Expo Go/preview build, a real API and migrated PostgreSQL. Use authorized referee account, an unrelated user, a competition organizer and two active futsal teams. Screens are **not** a substitute for a real offline/network reconnection test.

## Offline recovery and safety (tests 1–12)
1. Open an accepted scheduled match online and verify roster is cached only after a successful authorized load.
2. Complete all pre-match checks online; start match while authorized.
3. Disconnect Wi-Fi/cellular; reopen Match Center and confirm cached scoreboard, notes and roster remain visible.
4. Add a goal offline; verify provisional local score and unsynced badge.
5. Add second goal and caution offline; verify original sequence and player attribution are retained.
6. Force-close Expo, restart offline and return via saved referee dashboard; pending events must still exist.
7. Sign in as another user; verify first user's private queue and cache are not exposed.
8. Reconnect; verify events replay once, badges disappear, official source reflects each UUID once.
9. Simulate a timeout after server persisted an event; retry and verify no duplicate goal.
10. Simulate a server rejection (referee permission revoked or wrong roster). Queue must stay saved and show error.
11. Attempt to submit/finish/change match clock with unsynced events; action must be unavailable.
12. Reassign a match before kickoff; ensure old user's pending queue cannot alter the new referee's report.

## Reports, PDF and access (tests 13–20)
13. Submit the match report; organizer sees **SUBMITTED**, not public score.
14. Organizer returns the report with feedback; referee can correct and resubmit.
15. Organizer approves; official score, standings and verified player stats update.
16. As approved referee, export PDF; verify A4, multiple pages, chronology, final score, approval date.
17. Open full-report.txt embedded in PDF and verify Dari/Pashto text and raw event notes are preserved.
18. Try PDF export before approval; server must reject.
19. Try a different user's report PDF as referee/organizer; server must reject.
20. Reuse a consumed or expired download link; server must reject; downloads must send no-store.

## Career statistics and regression (tests 21–28)
21. Verify 7-, 30-, 90-day, year and all-time filters and correct Kabul-local inclusion.
22. Verify zero-data referee displays no invented chart data or 0/0 math errors.
23. Approve a report and verify total approved matches increments; pending reports must not count.
24. Verify 12-month chart includes zero-activity months.
25. Verify goals, disciplinary counts and fouls represent official events, not referee-quality ratings.
26. Confirm owner Dashboard, Team Manager Dashboard and Player Dashboard still work; no duplicate hamburger Dashboard item.
27. Switch Dari, Pashto and English; confirm proper direction, localized labels and nonmirrored icons.
28. Run `pnpm verify:referee-phase3`, `pnpm verify`, and release-readiness GitHub CI. Repeat on Android after app/API restart.

## Known deliberate constraints
- Offline **event capture and ordered replay only**: match clock controls, kickoff, corrections, submissions and approvals require the server. An offline event can be added only after a valid authorized match/roster snapshot has been cached.
- The PDF's visible font is portable Latin Helvetica. The original UTF-8 fields are preserved in the attached `full-report.txt` for Dari/Pashto fidelity; embedded-script glyph rendering in the visible PDF requires a dedicated Arabic/Pashto font and shaping layer in a future hardening task.
- Queue uses account-scoped application storage, not end-to-end encrypted storage. Protect the device and avoid deleting app storage until synchronization succeeds. Queued events cannot bypass server permissions and may need referee-organizer resolution after reassignments.
- Client clock is only an assisting display; referee/timekeeper enforces official laws. No automatic subjective performance scoring.
