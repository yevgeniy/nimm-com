const { toSelector, isSame, clone } = require("./helpers");

class IoServer {
  constructor(io, storeManager) {
    this.io = io;
    this.hooks = [];
    this.isShutdown = false;
    this.storeManager = storeManager;

    this.wire();
  }
  wire() {
    const io = this.io;

    io.on("nimm-com-client-send", (operation, ...args) => {
      if (operation === "request") this.processRequest(...args);
      else this.processClientUpdate(operation, ...args);
    });
    io.on("nimm-com-open-client-hook", (...args) => {
      this.openClientHook(...args);
    });
  }
  openClientHook(guid, selector) {
    selector = toSelector(selector);
    const data = selector(this.storeManager._store);
    this.hooks.push({
      guid,
      selector,
      buffer: clone(selector(this.storeManager._store))
    });

    this.updateClientHook(guid, data);
  }
  updateClientHook(guid, data) {
    this.io.emit("nimm-com-server-update-hook", guid, data);
  }
  processRequest(guid, name, ...args) {
    this.storeManager._api
      .filter(v => v.name === name)
      .forEach(entry => {
        const res = entry.fn(...args);
        if (!guid) return;

        res && res.then
          ? res.then(r => this.sendResponse(guid, r))
          : this.sendResponse(guid, res);
      });
  }
  sendResponse(guid, data) {
    this.io.emit("nimm-com-servier-request-response", guid, data);
  }
  processClientUpdate(operation, ...args) {
    console.log("CLIENT UPDATE", operation, args);

    /* remove operations from client can only be a function selector */
    if (operation === "remove") args = args.map(v => toSelector(v));

    this.storeManager[operation](...args);
  }

  shutdown() {
    this.io.removeAllListeners();
  }
  update() {
    this.hooks.forEach(entry => {
      const newObject = entry.selector(this.storeManager._store);
      if (isSame(entry.buffer, newObject)) return;

      entry.buffer = clone(newObject);
      this.updateClientHook(entry.guid, newObject);
    });
  }
}

module.exports = IoServer;
