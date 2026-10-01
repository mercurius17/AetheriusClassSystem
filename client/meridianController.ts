import { PlayerClassState, PartyState } from '../shared/types';
import { ClientPerkApplier } from './clientPerkApplier';
import { PartyHud } from './partyHud';
import { validateEnvelope } from '../vendor/ui-core/shared/protocol';

/** Consumes the authenticated Core transport. Owns no view or focus. */
export class MeridianController {
  private sessionId: string | null = null;
  receive(packet: unknown): void {
    if (!packet || typeof packet !== 'object') return;
    const data = packet as Record<string, unknown>;
    if (data.type === 'disconnect') { this.sessionId = null; PartyHud.getInstance().updatePartyState(null); return; }
    if (data.type === 'session') {
      this.sessionId = typeof data.sessionId === 'string' ? data.sessionId : null;
      return;
    }
    if (data.type !== 'envelope' || !this.sessionId) return;
    let envelope;
    try { envelope = validateEnvelope(data.envelope, { requireSession: true }); } catch { return; }
    if (envelope.sessionId !== this.sessionId || !['class', 'party'].includes(envelope.moduleId) || !['response', 'snapshot', 'event'].includes(envelope.kind)) return;
    const state = envelope.payload as { player?: PlayerClassState; party?: PartyState | null } | undefined;
    if (envelope.moduleId === 'class' && state?.player) {
      const applier = ClientPerkApplier.getInstance();
      applier.syncPerks(state.player);
      applier.syncSkills(state.player);
      applier.syncAttributes(state.player);
    }
    if (envelope.moduleId === 'party' && state && 'party' in state) PartyHud.getInstance().updatePartyState(state.party ?? null);
  }
}
