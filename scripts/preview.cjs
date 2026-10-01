// Local-only preview using the actual ClassSystem and Core router, no browser mocks.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { UiServerRouter } = require('../dist/vendor/ui-core/sdk/server/router');
const { registerClassUi } = require('../dist/server/uiModule');
const { serverInstance } = require('../dist/server/index');
const router = new UiServerRouter();
registerClassUi(router, serverInstance);
const actorId = 1;
const state = serverInstance.playerRepo.getPlayerState(actorId, 'Dovahkiin · PRÉVIA LOCAL');
state.hasWinterholdKeyword = true;
serverInstance.playerRepo.savePlayerState(state);
// This action exists only in this localhost preview process, never in the host bootstrap.
router.register('class', 'demoGrantXp', (context, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length) throw new Error('Invalid demo payload');
  const player = serverInstance.playerRepo.getPlayerState(context.actorId);
  if (!player.classId) throw new Error('Selecione uma classe primeiro.');
  let remaining = Math.max(0, player.nextLevelXp - player.currentXp), awarded = 0;
  // Simulate successive rested cycles through the real leveling pipeline.
  // This makes all milestones accessible in the demo without changing game rules.
  for (let cycle = 0; remaining > 0 && player.level < 40 && cycle < 10; cycle++) {
    player.dailyXpGained = 0; player.isFatigued = false;
    const result = serverInstance.levelingSystem.addExperience(player, remaining);
    if (!result.xpAwarded) break;
    remaining -= result.xpAwarded; awarded += result.xpAwarded;
  }
  const snapshot = serverInstance.handleClientPacket(context.actorId, 'requestInitialData', {}).data;
  const { unlockedPerksData, partyId, isRaid, ...updated } = snapshot.player;
  return { player: updated, result: { message: awarded ? `Demonstração: +${awarded.toLocaleString('pt-BR')} EXP · Nível ${updated.level}.` : 'Demonstração: nível máximo atingido.' } };
});
const root = path.resolve(__dirname, '../dist/meridian/Data/MeridianUI/aetheriusui');
router.register('class', 'demoResetClass', (context, payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length) throw new Error('Invalid demo payload');
  const player = serverInstance.playerRepo.getPlayerState(context.actorId);
  player.hasResetTicket = true;
  serverInstance.playerRepo.savePlayerState(player);
  const result = serverInstance.classSystem.resetClass(context.actorId);
  const snapshot = serverInstance.handleClientPacket(context.actorId, 'requestInitialData', {}).data;
  const { unlockedPerksData, partyId, isRaid, ...updated } = snapshot.player;
  return { player: updated, result: { success: result.success, message: result.message } };
});
const bridge = `<script>
window.AetheriusClassPreview = true;
function previewReceive(packet) { window.dispatchEvent(new CustomEvent('aetherius-ui-message', { detail: btoa(unescape(encodeURIComponent(JSON.stringify(packet)))) })); }
window.aetheriusUiSend = function(json) { fetch('/preview-request', { method:'POST', headers:{'Content-Type':'application/json'}, body:json }).then(r=>r.json()).then(envelope=>previewReceive({type:'envelope',envelope})); };
previewReceive({type:'session',sessionId:'local-preview'});
window.AetheriusUI.nativeFocusChanged(true);
</script>`;
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/preview-request') {
    let body = ''; for await (const part of req) { body += part; if (body.length > 16384) { res.writeHead(413).end(); return; } }
    try {
      const response = await router.dispatch(JSON.parse(body), { userId: 1, actorId, expectedSessionId: 'local-preview' });
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(response));
    } catch { res.writeHead(400).end(); }
    return;
  }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.ttf':'font/ttf' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    let content = fs.readFileSync(file);
    if (path.extname(file) === '.html') content = content.toString().replace('</body>', bridge + '</body>');
    res.end(content);
  } catch { res.writeHead(404).end(); }
}).listen(5510,'127.0.0.1',() => console.log('Preview: http://127.0.0.1:5510/?preview (local-only, nonpersistent)'));
