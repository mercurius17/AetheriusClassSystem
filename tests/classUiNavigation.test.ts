import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';

async function mountUi() {
  const classes = { guardiao: { id: 'guardiao', name: 'GUARDIÃO', archetype: 'GUERREIROS', description: 'Defesa', stages: [{ level: 1, perks: [] }] }, arqueiro: { id: 'arqueiro', name: 'ARQUEIRO', archetype: 'ESPECIALISTAS', description: 'Arco', stages: [{ level: 1, perks: [] }] } };
  let player: any = { playerId: 1, playerName: 'Teste', classId: 'guardiao', className: 'GUARDIÃO', level: 20, currentXp: 0, nextLevelXp: 100, unspentAttributePoints: 0 };
  let resetSucceeds = false, definition: any;
  const request = jest.fn(async (_module: string, action: string) => {
    if (action === 'resetClass' && resetSucceeds) player = { ...player, classId: null, className: null, level: 1 };
    return { player: { ...player }, result: action === 'resetClass' ? { success: resetSucceeds, message: resetSucceeds ? 'Classe redefinida.' : 'É necessário um ticket.' } : undefined };
  });
  const listeners: any = {};
  const container: any = { innerHTML: '', classList: { add() {} }, parentElement: { scrollTop: 0 },
    addEventListener: (name: string, callback: any) => { listeners[name] = callback; }, removeEventListener() {},
    insertAdjacentHTML: (_position: string, html: string) => { container.innerHTML += html; },
    querySelectorAll: () => [], querySelector: () => ({ scrollIntoView() {} }), replaceChildren() {} };
  runInNewContext(readFileSync(resolve(__dirname, '../ui/class-module.js'), 'utf8'), {
    window: { AetheriusUI: { registerModule: (value: any) => { definition = value; } }, AETHERIUS_CLASSES: classes, AETHERIUS_PERKS: {}, AETHERIUS_SPELLS: {} },
    document: { getElementById: () => ({ classList: { add() {}, remove() {} } }) }, setInterval: () => 0, clearInterval() {}
  });
  definition.mount(container, { request, subscribe() {} });
  const click = async (dataset: any) => { listeners.click({ target: { closest: () => ({ dataset }) } }); await Promise.resolve(); await Promise.resolve(); };
  await Promise.resolve(); await Promise.resolve();
  return { container, click, request, allowReset: () => { resetSucceeds = true; } };
}

test('assigned players can browse other classes and snapshots preserve the inspected page', async () => {
  const ui = await mountUi();
  await ui.click({ action: 'backCatalog' });
  expect(ui.container.innerHTML).toContain('CONHEÇA AS CLASSES');
  await ui.click({ action: 'refresh' });
  expect(ui.container.innerHTML).toContain('CONHEÇA AS CLASSES');
  await ui.click({ select: 'arqueiro' });
  await ui.click({ action: 'refresh' });
  expect(ui.container.innerHTML).toContain('<h2>ARQUEIRO</h2>');
  expect(ui.container.innerHTML).not.toContain('data-action="select"');
  expect(ui.container.innerHTML).not.toContain('data-tab="attributes"');
  expect(ui.container.innerHTML).not.toContain('data-action="reset"');
  expect(ui.container.innerHTML).not.toContain('is-earned');
  await ui.click({ action: 'ownClass' });
  expect(ui.container.innerHTML).toContain('<h2>GUARDIÃO</h2>');
  expect(ui.container.innerHTML).toContain('data-tab="attributes"');
});

test('failed resets keep the active class visible and successful resets return to the catalog', async () => {
  const ui = await mountUi();
  await ui.click({ action: 'confirmReset' });
  expect(ui.container.innerHTML).toContain('<h2>GUARDIÃO</h2>');
  expect(ui.container.innerHTML).toContain('É necessário um ticket.');
  ui.allowReset(); await ui.click({ action: 'confirmReset' });
  expect(ui.container.innerHTML).toContain('SELECIONE SUA CLASSE');
  expect(ui.container.innerHTML).not.toContain('data-tab="attributes"');
  await ui.click({ select: 'arqueiro' });
  expect(ui.container.innerHTML).toContain('data-action="select"');
});
