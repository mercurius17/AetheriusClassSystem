(function () {
  'use strict';
  const ui = window.AetheriusUI;
  if (!ui) throw new Error('ClassSystem requires Aetherius UI Core 1.x');
  const classes = Object.values(window.AETHERIUS_CLASSES);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const button = (text, action, extra = '') => `<button type="button" data-action="${action}" ${extra}>${esc(text)}</button>`;
  const icon = id => `<img src="./modules/class/assets/icons/${esc(id)}.svg" alt="" class="class-icon">`;
  const identities = {
    elementalista: ['As forças primordiais', 'Fogo · Gelo · Trovão'], criomante: ['O silêncio do inverno', 'Gelo · Controle · Destruição'],
    eletromante: ['A voz da tempestade', 'Raios · Destruição · Magia'], piromante: ['A chama que consome', 'Fogo · Destruição · Magia'],
    invocador: ['Entre mundos e véus', 'Conjuração · Criaturas · Armas'], curandeiro: ['O dom de restaurar', 'Restauração · Cura · Suporte'],
    guardiao: ['A última linha de defesa', 'Escudo · Bloqueio · Armadura pesada'], berserker: ['A força sem correntes', 'Duas mãos · Fúria · Armadura leve'],
    cavaleiro_negro: ['A lâmina e a escuridão', 'Duas mãos · Armadura pesada · Destruição'], paladino: ['Sob o signo da luz', 'Uma mão · Escudo · Restauração'],
    mestre_espadachim: ['A arte de cada golpe', 'Uma mão · Lâminas · Evasão'], druida: ['O pacto com a natureza', 'Conjuração · Restauração · Combate'],
    arqueiro: ['A precisão do caçador', 'Arco · Distância · Emboscada'], ranger: ['O caminho da caça', 'Arco · Mobilidade · Combate próximo'],
    viper: ['A marca da serpente', 'Venenos · Adagas · Armadura leve'], assassino: ['Um passo nas sombras', 'Furtividade · Adagas · Ilusão'],
    anti_mago: ['O algoz do arcano', 'Dissipação · Combate · Magia'], trapaceiro: ['Além do que os olhos veem', 'Ilusão · Furtividade · Astúcia']
  };
  const ornament = '<svg class="class-ornament" viewBox="0 0 320 24" aria-hidden="true"><path d="M0 12h129l11-5 10 5-10 5-11-5m22 0 9-9 9 9-9 9-9-9m18 0h22l11-5 10 5-10 5-11-5h118"/><path d="M154 12l6-6 6 6-6 6z"/></svg>';
  const medallion = id => `<div class="class-medallion" aria-hidden="true"><svg viewBox="0 0 200 200"><path d="M100 8 174 48 187 133 100 192 13 133 26 48Z M100 17 167 54 178 129 100 182 22 129 33 54Z"/><path d="M48 33 37 26 27 34 M152 33 163 26 173 34 M10 86 5 98 11 111 M190 86 195 98 189 111 M61 172 65 184 79 187 M139 172 135 184 121 187"/><path d="M100 3v18 M100 179v18 M3 100h17 M180 100h17"/></svg>${icon(id)}<span class="medallion-spark"></span></div>`;

  window.unregisterAetheriusClass = ui.registerModule({
    id: 'class', label: 'CLASSE', version: '2.0.0', sdkMin: '1.0.0', sdkMaxExclusive: '2.0.0',
    rootRoute: '/class', radialSlot: 1, assets: ['modules/class/class-module.css', 'modules/class/data.js'],
    capabilities: ['class.read', 'class.select', 'class.attributes', 'class.reset'],
    mount(container, context) {
      const shell = document.getElementById('aetherius-shell');
      shell.classList.add('is-class-workspace');
      container.classList.add('aetherius-class');
      let player = null, selected = null, inspecting = false, stageIndex = null, tab = 'progression', busy = false, message = '';
      let allocation = { health: 0, magicka: 0, stamina: 0 };
      let disposed = false;
      const sum = () => Object.values(allocation).reduce((a, b) => a + b, 0);
      function apply(data) {
        if (!data || !data.player) throw new Error('Estado de classe indisponível.');
        player = data.player;
        if (player.classId) { selected = player.classId; inspecting = true; }
      }
      function render() {
        if (disposed) return;
        if (!player) {
          container.innerHTML = `<div class="class-empty"><h2>${busy ? 'CARREGANDO CLASSE' : 'CLASSE INDISPONÍVEL'}</h2><p role="status">${esc(message || 'Aguardando dados do servidor.')}</p>${busy ? '' : button('TENTAR NOVAMENTE', 'refresh')}</div>`;
          return;
        }
        const cls = classes.find(c => c.id === selected);
        const choosing = !player.classId;
        container.innerHTML = choosing && !inspecting ? catalog() : `<div class="class-toolbar"><span class="class-breadcrumb">${choosing ? 'CLASSES DE COMBATE / APRESENTAÇÃO' : `${esc(player.playerName)} / ${esc(player.className)}`}</span><div>${choosing ? button('← ESCOLHER OUTRA CLASSE', 'backCatalog') : ''}${button('↻ ATUALIZAR', 'refresh')}</div></div>
          <main class="class-detail">${cls ? `<header class="class-hero">${medallion(cls.id)}<div class="class-hero-copy"><span class="class-kicker">${esc(cls.archetype)}</span><h2>${esc(cls.name)}</h2><p class="class-motto">${esc(identities[cls.id][0])}</p>${ornament}<p class="class-specialties">${esc(identities[cls.id][1])}</p></div><div class="class-hero-seal"><span>CAMINHO</span><strong>${choosing ? 'I — XL' : String(player.level).padStart(2,'0')}</strong><small>${choosing ? 'PROGRESSÃO DE CLASSE' : 'NÍVEL DE CLASSE'}</small></div></header>
          <div class="class-introduction"><span class="class-section-mark" aria-hidden="true">✧</span><p class="class-description">${esc(cls.description)}</p></div>
          <div class="class-facts"><div>${icon('mestre_espadachim')}<span><small>PROGRESSÃO</small><strong>${cls.stages.length} marcos · Níveis 1 a 40</strong></span></div><div>${icon('invocador')}<span><small>${choosing ? 'REQUISITO' : 'EXPERIÊNCIA'}</small><strong>${choosing ? cls.requiresWinterholdStudent ? 'Vínculo com Winterhold' : 'Livre escolha' : `${player.currentXp.toLocaleString('pt-BR')} / ${player.nextLevelXp.toLocaleString('pt-BR')} XP`}</strong></span></div><div>${icon('curandeiro')}<span><small>${choosing ? 'ATRIBUTOS' : 'PONTOS DISPONÍVEIS'}</small><strong>${choosing ? '+15 pontos por nível' : player.unspentAttributePoints + ' pontos'}</strong></span></div></div>
          ${choosing ? `<div class="class-enlist"><p>${cls.requiresWinterholdStudent && !player.hasWinterholdKeyword ? 'Você pode conhecer esta classe. A confirmação exige autorização do Colégio de Winterhold.' : 'Este é o caminho que você deseja seguir?'}</p>${button('CONFIRMAR ' + cls.name, 'select', `class="class-primary" ${busy || (cls.requiresWinterholdStudent && !player.hasWinterholdKeyword) ? 'disabled' : ''}`)}</div>` : ''}
          <nav class="class-tabs" aria-label="Detalhes da classe">${[['progression','PROGRESSÃO'],['spells','GRIMÓRIO'], ...(!choosing ? [['attributes','ATRIBUTOS']] : [])].map(([id,label]) => button(label, 'tab', `data-tab="${id}" aria-pressed="${tab === id}"`)).join('')}</nav>
          ${tab === 'progression' ? progression(cls, choosing) : tab === 'spells' ? spells(cls) : attributes()}
          ${!choosing ? `<footer class="class-management">${button('REDEFINIR CLASSE', 'reset')}<span>${player.level <= 15 ? 'Redefinição gratuita até o nível 15.' : 'Requer Ticket de Troca de Classe.'}</span>${player.level >= 15 ? '<a href="https://aetherius.net.br/" target="_blank" rel="noopener noreferrer">OBTER TICKET ↗</a>' : ''}</footer>` : ''}` : ''}</main>`;
        container.insertAdjacentHTML('beforeend', `<p class="class-feedback" role="status" aria-live="polite">${esc(message)}</p>`);
        if (busy) container.querySelectorAll('button, input, select').forEach(el => { el.disabled = true; });
      }
      function catalog() {
        const archetypes = [['CONJURADORES','conjuradores','I','Mestres do arcano'],['GUERREIROS','guerreiros','II','Força, aço e determinação'],['ESPECIALISTAS','especialistas','III','Precisão, sombras e astúcia']];
        return `<header class="class-selection-heading"><span class="class-kicker">AETHERIUS · CAMINHOS DE COMBATE</span><h2>SELECIONE SUA CLASSE</h2><p>Dezoito caminhos. Escolha aquele que conta a sua história.</p>${ornament}</header>
          <div class="class-catalog">${archetypes.map(([group,id,number,subtitle]) => `<section class="class-archetype"><header><span class="archetype-number">${number}</span><img src="./modules/class/assets/ui/${id}.svg" alt="" class="archetype-insignia"><h3>${group}</h3><p>${subtitle}</p><span class="archetype-rule" aria-hidden="true"></span></header><div class="class-archetype-list">${classes.filter(c => c.archetype === group).map(c => `<button type="button" class="class-choice ${c.id === selected ? 'is-selected' : ''}" data-select="${esc(c.id)}" aria-pressed="${c.id === selected}"><span class="class-card-illustration">${icon(c.id)}</span><span class="class-card-copy"><strong>${esc(c.name)}</strong><small>${esc(identities[c.id][0])}</small></span><span class="class-card-arrow" aria-hidden="true">›</span>${c.requiresWinterholdStudent && !player.hasWinterholdKeyword ? '<span class="class-card-lock">WINTERHOLD</span>' : ''}</button>`).join('')}</div></section>`).join('')}</div>
          <footer class="class-catalog-footer"><span>18 CLASSES <i>◇</i> 3 ARQUÉTIPOS <i>◇</i> UMA ESCOLHA</span><p>Selecione uma classe para conhecer suas habilidades e seu grimório.</p></footer>`;
      }
      function progression(cls, choosing) {
        const pct = player.level >= 40 ? 100 : Math.max(0, Math.min(100, 100 * player.currentXp / (player.nextLevelXp || 1)));
        const currentIndex = cls.stages.reduce((index, stage, i) => stage.level <= player.level ? i : index, 0);
        const index = stageIndex === null ? choosing ? 0 : currentIndex : Math.min(stageIndex, cls.stages.length - 1);
        const stage = cls.stages[index];
        return `${!choosing ? `<div class="class-xp"><span>NÍVEL ${player.level} / 40</span><span>${player.currentXp.toLocaleString('pt-BR')} / ${player.nextLevelXp.toLocaleString('pt-BR')} XP</span><progress max="100" value="${pct}" aria-label="Experiência"></progress></div>${player.level >= 15 ? `<p class="class-note">CANSAÇO DIÁRIO · ${player.dailyXpGained || 0} / ${player.dailyXpCap || 0} XP · ${player.isFatigued ? 'Limite atingido' : 'Disponível'} · Renova às 06:00 BRT</p>` : ''}` : ''}
          <div class="class-chapter-heading"><span class="class-kicker">O CAMINHO ATÉ A MAESTRIA</span><p>Explore os marcos da sua evolução.</p></div>
          <nav class="class-stage-path" aria-label="Marcos da progressão">${cls.stages.map((s,i) => `<button type="button" data-action="stage" data-stage="${i}" aria-pressed="${i === index}" class="${!choosing && s.level <= player.level ? 'is-earned' : ''}"><span class="stage-node" aria-hidden="true">${i === index ? '◆' : '◇'}</span><strong>${String(s.level).padStart(2,'0')}</strong><small>NÍVEL</small></button>`).join('')}</nav>` +
          `<section class="class-chapter"><aside class="class-chapter-summary"><span class="class-kicker">MARCO ${String(index + 1).padStart(2,'0')}</span><h3>NÍVEL <strong>${stage.level}</strong></h3>${medallion(cls.id)}<span class="class-chapter-status">${choosing ? 'PRÉVIA DA PROGRESSÃO' : stage.level <= player.level ? 'DESBLOQUEADO' : 'A DESBLOQUEAR'}</span><div><h4>HABILIDADES</h4><p>${esc(stage.skills || 'Mantém os patamares anteriores.')}</p></div></aside><div class="class-perk-ledger"><header><h3>HABILIDADES DO MARCO</h3><span>${stage.perks.length} ${stage.perks.length === 1 ? 'BENEFÍCIO' : 'BENEFÍCIOS'}</span></header>${stage.perks.map((name,i) => { const perk = window.AETHERIUS_PERKS[name]; return `<article class="class-perk"><span class="perk-glyph" aria-hidden="true">${['✧','◇','❖','✦'][i % 4]}</span><div><h4>${esc(perk?.namePt || name)}</h4><p>${esc(perk?.descriptionPt || 'Descrição indisponível.')}</p></div><span class="perk-number">${String(i + 1).padStart(2,'0')}</span></article>`; }).join('') || '<p class="class-note">Este marco mantém os benefícios anteriores.</p>'}</div></section>`;
      }
      function spells(cls) {
        const entries = Object.entries(cls.authorizedSpells || {});
        return entries.length ? `<p class="class-note">${esc(cls.spellsRPNotice || 'Os feitiços devem ser aprendidos através de Roleplay no Colégio de Winterhold; não são concedidos automaticamente.')}</p><div class="class-spell-grid">${entries.map(([tier,names]) => `<section class="class-spells"><h3>${icon('invocador')}${esc(tier)}</h3>${names.map(name => { const s = window.AETHERIUS_SPELLS[name]; return `<details><summary>${esc(s?.namePt || name)}</summary><p>${esc(s?.descriptionPt || 'Descrição indisponível.')}</p></details>`; }).join('')}</section>`).join('')}</div>` : `<div class="class-empty">${medallion(cls.id)}<h3>SEM FEITIÇOS AUTORIZADOS</h3><p>Esta classe concentra sua progressão nas habilidades de combate.</p></div>`;
      }
      function attributes() {
        return `<p class="class-note">${player.unspentAttributePoints - sum()} PONTOS DISPONÍVEIS · +15 por nível · Distribua em passos de 5.</p><div class="class-attributes">${[['health','Vida','curandeiro'],['magicka','Mágicka','invocador'],['stamina','Vigor','berserker']].map(([key,label,glyph]) => `<div class="class-attribute">${icon(glyph)}<div><h3>${label}</h3><p>${(player.baseAttributes?.[key] || 100) + player['allocated' + key[0].toUpperCase() + key.slice(1)]} pontos atuais</p></div>${button('−5','step',`data-key="${key}" data-delta="-5" ${allocation[key] < 5 ? 'disabled' : ''}`)}<output>${allocation[key]}</output>${button('+5','step',`data-key="${key}" data-delta="5" ${player.unspentAttributePoints - sum() < 5 ? 'disabled' : ''}`)}</div>`).join('')}</div>${button('APLICAR ATRIBUTOS', 'allocate', `class="class-primary" ${sum() <= 0 ? 'disabled' : ''}`)}`;
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
        if (el.dataset.select) { selected = el.dataset.select; inspecting = true; stageIndex = null; tab = 'progression'; render(); container.parentElement.scrollTop = 0; return; }
        const action = el.dataset.action;
        if (action === 'tab') { tab = el.dataset.tab; render(); }
        else if (action === 'backCatalog') { inspecting = false; render(); container.parentElement.scrollTop = 0; }
        else if (action === 'stage') { stageIndex = Number(el.dataset.stage); render(); }
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
        } else if (action === 'confirmReset') { tab = 'progression'; selected = null; inspecting = false; stageIndex = null; request('resetClass'); }
        else if (action === 'cancelReset') render();
      }

      container.addEventListener('click', click);
      context.subscribe(envelope => { if (!busy && ['snapshot','event'].includes(envelope.kind) && envelope.payload?.player) { apply(envelope.payload); render(); } });
      request('snapshot');
      // Progression remains current without a second transport.
      let polling = false;
      const timer = setInterval(async () => {
        if (busy || polling || disposed || container.querySelector('.class-confirm') || document.activeElement?.matches('input,select')) return;
        polling = true;
        try {
          const data = await context.request('class', 'snapshot', {});
          if (disposed || busy) return;
          if (JSON.stringify(player) !== JSON.stringify(data.player)) {
            apply(data); if (sum() > player.unspentAttributePoints) allocation = { health: 0, magicka: 0, stamina: 0 }; render();
          }
        } catch (_) { /* Manual refresh exposes transport errors without discarding the last snapshot. */ }
        finally { polling = false; }
      }, 5000);
      return { unmount() { disposed = true; clearInterval(timer); shell.classList.remove('is-class-workspace'); container.removeEventListener('click', click); container.replaceChildren(); } };
    }
  });
}());
