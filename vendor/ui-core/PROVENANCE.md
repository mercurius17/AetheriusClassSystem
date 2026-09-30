These SDK files are copied with trailing blank lines normalized from AetheriusUI_Core commit
470526a24a003d5452802f90933c323c3bc4e300:
sdk/server/router.ts, shared/protocol.ts, shared/revisionStore.ts.
Source: https://github.com/mercurius17/AetheriusUI_Core
They allow standalone compilation and integration tests. Production registers
handlers on the existing Core router; it does not create a competing router/view.

Combat adapter, verified-perks.json and integration changes originate from
AetheriusDamageSystem commit f21faf5c4a1264f787545e20a1e4dbadc6362e80.
Source: https://github.com/mercurius17/AetheriusDamageSystem

