import { MeridianController } from '../client/meridianController';
import { ClientPerkApplier } from '../client/clientPerkApplier';
import { PlayerRepository } from '../server/storage/playerRepository';
import { PartyHud } from '../client/partyHud';

test('client applies only class snapshots from the current Core session', () => {
  const controller = new MeridianController();
  const applier = ClientPerkApplier.getInstance();
  const perks = jest.spyOn(applier, 'syncPerks');
  const skills = jest.spyOn(applier, 'syncSkills');
  const attributes = jest.spyOn(applier, 'syncAttributes');
  const envelope = JSON.parse(JSON.stringify({ protocolVersion: 1, kind: 'response', messageId: 'message-1', correlationId: 'request-1', sessionId: 'session-1', moduleId: 'class', payload: { player: PlayerRepository.getInstance().getPlayerState(100) } }));
  controller.receive({ type: 'envelope', envelope }); expect(perks).not.toHaveBeenCalled();
  controller.receive({ type: 'session', sessionId: 'session-1' });
  controller.receive({ type: 'envelope', envelope: { ...envelope, sessionId: 'another-session' } }); expect(perks).not.toHaveBeenCalled();
  controller.receive({ type: 'envelope', envelope });
  expect(perks).toHaveBeenCalledTimes(1); expect(skills).toHaveBeenCalledTimes(1); expect(attributes).toHaveBeenCalledTimes(1);
  controller.receive({ type: 'disconnect' }); controller.receive({ type: 'envelope', envelope }); expect(perks).toHaveBeenCalledTimes(1);
  jest.restoreAllMocks();
});

test('party snapshots update only the HUD and honor the current session', () => {
  const controller = new MeridianController();
  const perks = jest.spyOn(ClientPerkApplier.getInstance(), 'syncPerks');
  const hud = jest.spyOn(PartyHud.getInstance(), 'updatePartyState');
  const envelope = { protocolVersion: 1, kind: 'response', messageId: 'party-message', correlationId: 'party-request', sessionId: 'session-1', moduleId: 'party', payload: { player: { playerId: 100 }, party: null } };
  controller.receive({ type: 'session', sessionId: 'session-1' });
  controller.receive({ type: 'envelope', envelope: { ...envelope, sessionId: 'stale' } });
  expect(hud).not.toHaveBeenCalled();
  controller.receive({ type: 'envelope', envelope });
  expect(hud).toHaveBeenCalledWith(null); expect(perks).not.toHaveBeenCalled();
  controller.receive({ type: 'envelope', envelope: { ...envelope, moduleId: 'class', payload: { party: null } } });
  expect(hud).toHaveBeenCalledTimes(1);
  jest.restoreAllMocks();
});
