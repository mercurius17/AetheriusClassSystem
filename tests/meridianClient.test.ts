import { MeridianController } from '../client/meridianController';
import { ClientPerkApplier } from '../client/clientPerkApplier';
import { PlayerRepository } from '../server/storage/playerRepository';

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
