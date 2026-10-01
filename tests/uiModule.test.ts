import { UiServerRouter } from '../vendor/ui-core/sdk/server/router';
import { registerClassUi } from '../server/uiModule';
import { SkyMPClassServer } from '../server/index';
import { PlayerRepository } from '../server/storage/playerRepository';

function envelope(action: string, payload: unknown, id = 'request-1', moduleId = 'class') {
  return { protocolVersion: 1, kind: 'request', messageId: id, correlationId: id, sessionId: 'session-1', moduleId, action, payload };
}
const context = { userId: 17, actorId: 100, expectedSessionId: 'session-1' };
beforeEach(() => { PlayerRepository.getInstance().clearMemory(); SkyMPClassServer.getInstance().partySystem.clearAll(); });

test('UI uses authenticated actor and rejects injected identity and combat reports', async () => {
  const router = new UiServerRouter(); registerClassUi(router);
  const snapshot = await router.dispatch(envelope('snapshot', {}), context);
  expect((snapshot.payload as any).player.playerId).toBe(100);
  expect((await router.dispatch(envelope('selectClass', { classId: 'guardiao', playerId: 200 }, 'request-2'), context)).kind).toBe('error');
  expect((await router.dispatch(envelope('reportCombatKill', {}, 'request-3'), context)).error?.code).toBe('ACTION_UNAVAILABLE');
  expect((await router.dispatch(envelope('demoGrantXp', {}, 'request-4'), context)).error?.code).toBe('ACTION_UNAVAILABLE');
  expect((await router.dispatch(envelope('demoResetClass', {}, 'request-5'), context)).error?.code).toBe('ACTION_UNAVAILABLE');
  expect(PlayerRepository.getInstance().getPlayerState(100).classId).toBeNull();
});

test('Core dedupe returns the same mutation, unload removes handlers', async () => {
  const router = new UiServerRouter(); const dispose = registerClassUi(router);
  const request = envelope('createParty', {}, 'request-1', 'party');
  const first = await router.dispatch(request, context);
  expect(first.kind).toBe('response');
  expect(await router.dispatch(request, context)).toBe(first);
  dispose(); dispose();
  expect((await router.dispatch(envelope('snapshot', {}, 'request-2'), context)).error?.code).toBe('ACTION_UNAVAILABLE');
  expect((await router.dispatch(envelope('snapshot', {}, 'request-3', 'party'), context)).error?.code).toBe('ACTION_UNAVAILABLE');
});

test('party invite snapshots expose only invites belonging to the actor', async () => {
  const router = new UiServerRouter(); registerClassUi(router);
  const party = SkyMPClassServer.getInstance().partySystem;
  party.createParty(100); const invite = party.invitePlayer(100, 200);
  const target = await router.dispatch(envelope('snapshot', {}, 'request-1', 'party'), { ...context, actorId: 200 });
  expect((target.payload as any).invites[0].inviteId).toBe(invite.inviteId);
  const own = await router.dispatch(envelope('snapshot', {}, 'request-2', 'party'), context);
  expect((own.payload as any).invites).toEqual([]);
});

test('group routes are isolated from classes and retain authenticated identities', async () => {
  const router = new UiServerRouter(); registerClassUi(router);
  expect((await router.dispatch(envelope('createParty', {}), context)).error?.code).toBe('ACTION_UNAVAILABLE');
  expect((await router.dispatch(envelope('selectClass', { classId: 'guardiao' }, 'request-2', 'party'), context)).error?.code).toBe('ACTION_UNAVAILABLE');
  expect((await router.dispatch(envelope('inviteParty', { targetId: 200, playerId: 300 }, 'request-3', 'party'), context)).kind).toBe('error');
  const snapshot = (await router.dispatch(envelope('snapshot', {}, 'request-4'), context)).payload as any;
  expect(snapshot).not.toHaveProperty('party'); expect(snapshot).not.toHaveProperty('invites');
  expect(snapshot.player).not.toHaveProperty('partyId'); expect(snapshot.player).not.toHaveProperty('isRaid');
  const party = (await router.dispatch(envelope('snapshot', {}, 'request-5', 'party'), context)).payload as any;
  expect(party.player).toEqual({ playerId: 100, playerName: snapshot.player.playerName });
  expect(party.player).not.toHaveProperty('unlockedPerks');
});

test('rejected combat profile does not mutate cached class progression', () => {
  const repo = PlayerRepository.getInstance();
  const saved = repo.getPlayerState(100); saved.classId = 'guardiao'; saved.level = 20; repo.savePlayerState(saved);
  const draft = repo.getPlayerState(100); draft.unlockedPerks = ['Unaudited perk']; draft.level = 30;
  const previous = (global as any).mp;
  (global as any).mp = { getServerSettings: () => ({ aetheriusCombatSettings: { enabled: true, mode: 'aetherius' } }), getActorCombatProfile: () => '{"revision":0}', applyActorCombatProfile: jest.fn() };
  try { expect(() => repo.savePlayerState(draft)).toThrow(/audited/); }
  finally { (global as any).mp = previous; }
  expect(repo.getPlayerState(100).level).toBe(20);
});
