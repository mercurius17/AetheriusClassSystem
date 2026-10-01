// Host bootstrap: pass the Core router and a bound, authoritative ClassRuntime.
// Never pass browser data, a client mp.events object, or an unbound native method.
module.exports = function registerClassSystem(router, runtime) {
  const { configureClassRuntime } = require('../dist/server/runtime');
  const { serverInstance } = require('../dist/server/index');
  const { registerClassUi } = require('../dist/server/uiModule');
  configureClassRuntime(runtime);
  serverInstance.playerRepo.clearMemory();
  serverInstance.initialize();
  return registerClassUi(router, serverInstance);
};
