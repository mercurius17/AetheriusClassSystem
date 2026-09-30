(function () {
  'use strict';
  const ui = window.AetheriusUI;
  if (!ui) throw new Error('ClassSystem requires Aetherius UI Core 1.x');
  const classes = Object.values(window.AETHERIUS_CLASSES);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const button = (text, action, extra = '') => `<button type="button" data-action="${action}" ${extra}>${esc(text)}</button>`;
  const icon = id => `<img src="./modules/class/assets/icons/${esc(id)}.svg" alt="" class="class-icon">`;

  window.unregisterAetheriusClass = ui.registerModule({
    id: 'class', label: 'CLASSE', version: '2.0.0', sdkMin: '1.0.0', sdkMaxExclusive: '2.0.0',
    rootRoute: '/class', radialSlot: 1, assets: ['modules/class/class-module.css', 'modules/class/data.js'],
    capabilities: ['class.read', 'class.select', 'class.attributes', 'class.reset', 'party.manage'],
    mount(container, context) {
      const shell = document.getElementById('aetherius-shell');
      shell.classList.add('is-class-workspace');
      container.classList.add('aetherius-class');
      let player = null, party = null, invites = [], selected = null, tab = 'progression', busy = false, message = '';
      let allocation = { health: 0, magicka: 0, stamina: 0 };
      let disposed = false;
      const sum = () => Object.values(allocation).reduce((a, b) => a + b, 0);
      function apply(data) {
        if (!data || !data.player) throw new Error('Estado de classe indisponível.');
        player = data.player; party = data.party; invites = data.invites || [];
        if (player.classId) selected = player.classId;
      }
      function render() {
        if (disposed) return;
        if (!player) {
          container.innerHTML = `<div class="class-empty"><h2>${busy ? 'CARREGANDO CLASSE' : 'CLASSE INDISPONÍVEL'}</h2><p role="status">${esc(message || 'Aguardando dados do servidor.')}</p>${busy ? '' : button('TENTAR NOVAMENTE', 'refresh')}</div>`;
          return;
        }
        const cls = classes.find(c => c.id === selected);
        const choosing = !player.classId;
        container.innerHTML = `<div class="class-toolbar"><p>${choosing ? 'Escolha o seu caminho. Conheça cada classe antes de confirmar.' : `${esc(player.playerName)} · NÍVEL ${player.level} · ${esc(player.className)}`}</p>${button('ATUALIZAR', 'refresh')}</div>
          <div class="class-layout ${choosing ? 'is-selection' : ''}">
          ${choosing ? `<aside class="class-catalog">${['CONJURADORES', 'GUERREIROS', 'ESPECIALISTAS'].map(group => `<section><h3>${group}</h3>${classes.filter(c => c.archetype === group).map(c => `<button type="button" class="class-choice ${c.id === selected ? 'is-selected' : ''}" data-select="${esc(c.id)}" aria-pressed="${c.id === selected}">${icon(c.id)}<span>${esc(c.name)}${c.requiresWinterholdStudent && !player.hasWinterholdKeyword ? '<small>Vínculo com Winterhold necessário</small>' : ''}</span><span aria-hidden="true">›</span></button>`).join('')}</section>`).join('')}</aside>` : ''}
          <main class="class-detail">${cls ? `<header class="class-identity">${icon(cls.id)}<div><span class="class-kicker">${esc(cls.archetype)}</span><h2>${esc(cls.name)}</h2></div>${choosing ? button('CONFIRMAR CLASSE', 'select', `class="class-primary" ${busy || (cls.requiresWinterholdStudent && !player.hasWinterholdKeyword) ? 'disabled' : ''}`) : ''}</header><p class="class-description">${esc(cls.description)}</p>
          <nav class="class-tabs" aria-label="Detalhes da classe">${[['progression','PROGRESSÃO'],['spells','GRIMÓRIO'], ...(!choosing ? [['attributes','ATRIBUTOS'],['party','GRUPO & RAID']] : [])].map(([id,label]) => button(label, 'tab', `data-tab="${id}" aria-pressed="${tab === id}"`)).join('')}</nav>
          ${tab === 'progression' ? progression(cls, choosing) : tab === 'spells' ? spells(cls) : tab === 'attributes' ? attributes() : groups()}
          ${!choosing ? `<footer class="class-management">${button('REDEFINIR CLASSE', 'reset')}<span>${player.level <= 15 ? 'Redefinição gratuita até o nível 15.' : 'Requer Ticket de Troca de Classe.'}</span>${player.level >= 15 ? '<a href="https://aetherius.net.br/" target="_blank" rel="noopener noreferrer">OBTER TICKET ↗</a>' : ''}</footer>` : ''}` : '<div class="class-empty"><h2>18 CLASSES. UM CAMINHO.</h2><p>Selecione uma classe para explorar sua progressão e seu grimório.</p></div>'}</main></div><p class="class-feedback" role="status" aria-live="polite">${esc(message)}</p>`;
        if (busy) container.querySelectorAll('button, input, select').forEach(el => { el.disabled = true; });
      }
      function progression(cls, choosing) {
        const pct = player.level >= 40 ? 100 : Math.max(0, Math.min(100, 100 * player.currentXp / (player.nextLevelXp || 1)));
        return `${!choosing ? `<div class="class-xp"><span>NÍVEL ${player.level} / 40</span><span>${player.currentXp.toLocaleString('pt-BR')} / ${player.nextLevelXp.toLocaleString('pt-BR')} XP</span><progress max="100" value="${pct}" aria-label="Experiência"></progress></div>${player.level >= 15 ? `<p class="class-note">CANSAÇO DIÁRIO · ${player.dailyXpGained || 0} / ${player.dailyXpCap || 0} XP · ${player.isFatigued ? 'Limite atingido' : 'Disponível'} · Renova às 06:00 BRT</p>` : ''}` : ''}
          <div class="class-stages">${cls.stages.map(stage => `<article class="class-stage ${!choosing && stage.level <= player.level ? 'is-unlocked' : ''}"><div class="class-stage-level">NÍVEL ${stage.level}${!choosing && stage.level <= player.level ? '<small>DESBLOQUEADO</small>' : ''}</div><div><p class="class-skills">${esc(stage.skills || 'Continuidade da progressão')}</p>${stage.perks.map(name => { const perk = window.AETHERIUS_PERKS[name]; return `<details><summary>${esc(perk?.namePt || name)}</summary><p>${esc(perk?.descriptionPt || 'Descrição indisponível.')}</p></details>`; }).join('')}</div></article>`).join('')}</div>`;
      }
      function spells(cls) {
        const entries = Object.entries(cls.authorizedSpells || {});
        return entries.length ? `<p class="class-note">${esc(cls.spellsRPNotice || 'Os feitiços devem ser aprendidos através de Roleplay no Colégio de Winterhold; não são concedidos automaticamente.')}</p>${entries.map(([tier,names]) => `<section class="class-spells"><h3>${esc(tier)}</h3>${names.map(name => { const s = window.AETHERIUS_SPELLS[name]; return `<details><summary>${esc(s?.namePt || name)}</summary><p>${esc(s?.descriptionPt || 'Descrição indisponível.')}</p></details>`; }).join('')}</section>`).join('')}` : '<div class="class-empty"><h3>SEM FEITIÇOS AUTORIZADOS</h3><p>Esta classe concentra sua progressão nas habilidades de combate.</p></div>';
      }
      function attributes() {
        return `<p class="class-note">${player.unspentAttributePoints - sum()} PONTOS DISPONÍVEIS · +15 por nível · Distribua em passos de 5.</p><div class="class-attributes">${[['health','Vida'],['magicka','Mágicka'],['stamina','Vigor']].map(([key,label]) => `<div class="class-attribute"><div><h3>${label}</h3><p>${(player.baseAttributes?.[key] || 100) + player['allocated' + key[0].toUpperCase() + key.slice(1)]} pontos atuais</p></div>${button('−5','step',`data-key="${key}" data-delta="-5" ${allocation[key] < 5 ? 'disabled' : ''}`)}<output>${allocation[key]}</output>${button('+5','step',`data-key="${key}" data-delta="5" ${player.unspentAttributePoints - sum() < 5 ? 'disabled' : ''}`)}</div>`).join('')}</div>${button('APLICAR ATRIBUTOS', 'allocate', `class="class-primary" ${sum() <= 0 ? 'disabled' : ''}`)}`;
      }
      function groups() {
        const leader = party?.leaderId === player.playerId;
        return `${invites.map(invite => `<div class="class-note">Convite para grupo ${esc(invite.partyId)} ${button('ACEITAR','acceptPartyInvite',`data-invite="${esc(invite.inviteId)}"`)} ${button('RECUSAR','declinePartyInvite',`data-invite="${esc(invite.inviteId)}"`)}</div>`).join('')}${party ? `<div class="class-toolbar"><h3>${party.isRaid ? 'RAID' : 'GRUPO'} · ${party.members.length} / ${party.maxMembers}</h3>${button('SAIR DO GRUPO','leaveParty')}</div><div class="class-members">${party.members.map(m => `<article><div><strong>${esc(m.name)} ${m.isLeader ? '· LÍDER' : ''}</strong><p>${esc(m.className)} · Nível ${m.level} · ${m.health} / ${m.maxHealth} Vida</p></div>${leader && m.id !== player.playerId ? button('PROMOVER','promotePartyLeader',`data-target="${m.id}"`) + button('REMOVER','kickPartyMember',`data-target="${m.id}"`) : ''}${leader && party.isRaid ? `<label>Subgrupo <select data-subgroup="${m.id}">${[1,2,3,4].map(n => `<option ${m.subgroupId === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}</article>`).join('')}</div><form data-invite-form><label>ID do jogador <input name="targetId" type="number" min="1" required></label><button type="submit">CONVIDAR</button></form>${leader && !party.isRaid ? button('CONVERTER PARA RAID','convertToRaid') : ''}` : button('CRIAR GRUPO','createParty')}`;
      }
      async function request(action, payload = {}) {
        if (busy || disposed) return;
        busy = true; message = ''; render();
        try {
          const data = await context.request('class', action, payload);
          if (disposed) return;
          apply(data);
          if (action !== 'snapshot' || sum() > player.unspentAttributePoints) allocation = { health: 0, magicka: 0, stamina: 0 };
          message = data.result?.message || '';
        } catch (error) { message = error.message; }
        finally { busy = false; render(); }
      }
      function click(event) {
        const el = event.target.closest('button');
        if (!el || busy) return;
        if (el.dataset.select) { selected = el.dataset.select; tab = 'progression'; render(); return; }
        const action = el.dataset.action;
        if (action === 'tab') { tab = el.dataset.tab; render(); }
        else if (action === 'refresh') request('snapshot');
        else if (action === 'select') request('selectClass', { classId: selected });
        else if (action === 'step') { allocation[el.dataset.key] += Number(el.dataset.delta); render(); }
        else if (action === 'allocate') request('allocateAttributes', { ...allocation });
        else if (action === 'reset') {
          if (container.querySelector('.class-confirm')) return;
          const confirm = document.createElement('div'); confirm.className = 'class-confirm';
          confirm.setAttribute('role','alert');
          confirm.innerHTML = `<p>Redefinir sua classe remove sua progressão e restaura seus atributos raciais. Confirmar?</p>${button('CONFIRMAR REDEFINIÇÃO','confirmReset')} ${button('CANCELAR','cancelReset')}`;
          container.appendChild(confirm); confirm.querySelector('button').focus();
        } else if (action === 'confirmReset') { tab = 'progression'; selected = null; request('resetClass'); }
        else if (action === 'cancelReset') render();
        else if (action === 'promotePartyLeader') request(action, { newLeaderId: Number(el.dataset.target) });
        else if (action === 'kickPartyMember') request(action, { targetId: Number(el.dataset.target) });
        else if (['acceptPartyInvite','declinePartyInvite'].includes(action)) request(action, { inviteId: el.dataset.invite });
        else if (['createParty','leaveParty','convertToRaid'].includes(action)) request(action);
      }
      function submit(event) { if (!event.target.matches('[data-invite-form]')) return; event.preventDefault(); request('inviteParty', { targetId: Number(new FormData(event.target).get('targetId')) }); }
      function change(event) { if (event.target.dataset.subgroup) request('assignRaidSubgroup', { targetMemberId: Number(event.target.dataset.subgroup), subgroupId: Number(event.target.value) }); }
      function keydown(event) {
        // The Core treats Backspace as navigation; editing a player ID must keep it local.
        if (event.key === 'Backspace' && event.target.matches('input')) event.stopPropagation();
      }
      container.addEventListener('click', click); container.addEventListener('submit', submit); container.addEventListener('change', change);
      container.addEventListener('keydown', keydown);
      context.subscribe(envelope => { if (!busy && ['snapshot','event'].includes(envelope.kind) && envelope.payload?.player) { apply(envelope.payload); render(); } });
      request('snapshot');
      // Party invites and progression remain current without a second transport.
      let polling = false;
      const timer = setInterval(async () => {
        if (busy || polling || disposed || container.querySelector('.class-confirm') || document.activeElement?.matches('input,select')) return;
        polling = true;
        try {
          const data = await context.request('class', 'snapshot', {});
          if (disposed || busy) return;
          if (JSON.stringify([player,party,invites]) !== JSON.stringify([data.player,data.party,data.invites || []])) {
            apply(data); if (sum() > player.unspentAttributePoints) allocation = { health: 0, magicka: 0, stamina: 0 }; render();
          }
        } catch (_) { /* Manual refresh exposes transport errors without discarding the last snapshot. */ }
        finally { polling = false; }
      }, 5000);
      return { unmount() { disposed = true; clearInterval(timer); shell.classList.remove('is-class-workspace'); container.removeEventListener('click', click); container.removeEventListener('submit', submit); container.removeEventListener('change', change); container.removeEventListener('keydown', keydown); container.replaceChildren(); } };
    }
  });
}());
