(function () {
  'use strict';
  const ui = window.AetheriusUI;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const button = (text, action, extra = '') => `<button type="button" data-action="${action}" ${extra}>${esc(text)}</button>`;
  window.unregisterAetheriusParty = ui.registerModule({
    id: 'party', label: 'GRUPO', version: '2.0.0', sdkMin: '1.0.0', sdkMaxExclusive: '2.0.0',
    rootRoute: '/party', radialSlot: 3, assets: ['modules/party/party-module.css'],
    capabilities: ['party.read', 'party.manage'],
    mount(container, context) {
      const shell = document.getElementById('aetherius-shell');
      shell.classList.add('is-party-workspace'); container.classList.add('aetherius-party');
      let player = null, party = null, invites = [], busy = false, disposed = false, polling = false, message = '';
      function apply(data) { if (!data?.player) throw new Error('Estado de grupo indisponível.'); player = data.player; party = data.party; invites = data.invites || []; }
      function render() {
        if (disposed) return;
        container.innerHTML = `<header class="party-introduction"><span>COMPANHEIROS DE JORNADA</span><h2>${party?.isRaid ? 'SUA RAID' : 'SEU GRUPO'}</h2><p>Reúna seus aliados, gerencie os convites e organize sua equipe.</p></header>${player ? groups() : `<p>${busy ? 'Carregando grupo…' : 'Aguardando dados do servidor.'}</p>`}<p role="status" aria-live="polite">${esc(message)}</p>${button('ATUALIZAR GRUPO', 'refresh')}`;
        if (busy) container.querySelectorAll('button,input,select').forEach(el => { el.disabled = true; });
      }
      function groups() {
        const leader = party?.leaderId === player.playerId;
        return `${invites.map(invite => `<div class="party-note">Convite para grupo ${esc(invite.partyId)} ${button('ACEITAR','acceptPartyInvite',`data-invite="${esc(invite.inviteId)}"`)} ${button('RECUSAR','declinePartyInvite',`data-invite="${esc(invite.inviteId)}"`)}</div>`).join('')}${party ? `<div class="party-toolbar"><h3>${party.isRaid ? 'RAID' : 'GRUPO'} · ${party.members.length} / ${party.maxMembers}</h3>${button('SAIR DO GRUPO','leaveParty')}</div><div class="party-members">${party.members.map(m => `<article><div><strong>${esc(m.name)} ${m.isLeader ? '· LÍDER' : ''}</strong><p>${esc(m.className)} · Nível ${m.level} · ${m.health} / ${m.maxHealth} Vida</p></div>${leader && m.id !== player.playerId ? button('PROMOVER','promotePartyLeader',`data-target="${m.id}"`) + button('REMOVER','kickPartyMember',`data-target="${m.id}"`) : ''}${leader && party.isRaid ? `<label>Subgrupo <select data-subgroup="${m.id}">${[1,2,3,4].map(n => `<option ${m.subgroupId === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}</article>`).join('')}</div>${leader ? `<form data-invite-form><label>ID do jogador <input name="targetId" type="number" min="1" required></label><button type="submit">CONVIDAR</button></form>` : ''}${leader && !party.isRaid ? button('CONVERTER PARA RAID','convertToRaid') : ''}` : button('CRIAR GRUPO','createParty')}`;
      }
      async function request(action, payload = {}) {
        if (busy || disposed) return;
        busy = true; message = ''; render();
        try { const data = await context.request('party', action, payload); if (!disposed) { apply(data); message = data.result?.message || ''; } }
        catch (error) { message = error.message; }
        finally { busy = false; render(); }
      }
      function click(event) {
        const el = event.target.closest('button'); if (!el || busy) return;
        const action = el.dataset.action;
        if (action === 'refresh') request('snapshot');
        else if (action === 'promotePartyLeader') request(action, { newLeaderId: Number(el.dataset.target) });
        else if (action === 'kickPartyMember') request(action, { targetId: Number(el.dataset.target) });
        else if (['acceptPartyInvite','declinePartyInvite'].includes(action)) request(action, { inviteId: el.dataset.invite });
        else if (['createParty','leaveParty','convertToRaid'].includes(action)) request(action);
      }
      function submit(event) { if (!event.target.matches('[data-invite-form]')) return; event.preventDefault(); request('inviteParty', { targetId: Number(new FormData(event.target).get('targetId')) }); }
      function change(event) { if (event.target.dataset.subgroup) request('assignRaidSubgroup', { targetMemberId: Number(event.target.dataset.subgroup), subgroupId: Number(event.target.value) }); }
      container.addEventListener('click', click); container.addEventListener('submit', submit); container.addEventListener('change', change);
      context.subscribe(envelope => { if (!busy && ['snapshot','event'].includes(envelope.kind) && envelope.payload?.player) { apply(envelope.payload); render(); } });
      request('snapshot');
      const timer = setInterval(async () => {
        if (busy || polling || disposed || container.contains(document.activeElement) && document.activeElement.matches('input,select')) return;
        polling = true;
        try { const data = await context.request('party', 'snapshot', {}); if (!disposed && !busy && JSON.stringify([player,party,invites]) !== JSON.stringify([data.player,data.party,data.invites || []])) { apply(data); render(); } }
        catch (_) { /* Keep the last valid state; manual refresh exposes errors. */ }
        finally { polling = false; }
      }, 5000);
      return { unmount() { disposed = true; clearInterval(timer); shell.classList.remove('is-party-workspace'); container.removeEventListener('click', click); container.removeEventListener('submit', submit); container.removeEventListener('change', change); container.replaceChildren(); } };
    }
  });
}());
