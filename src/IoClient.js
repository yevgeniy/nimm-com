const ChannelStream = require("./ChannelStream");
const { guid, isSame } = require("./helpers");

class IoClient {
  constructor(io) {
    this.io = io;
    this.hooks = [];
    this.requests = [];
    this.wire();
  }
  wire() {
    this.io.on("nimm-com-server-update-hook", (...args) =>
      this.parseUpdateHook(...args)
    );
    this.io.on("nimm-com-servier-request-response", (...args) =>
      this.requestResponse(...args)
    );
  }
  parseUpdateHook(guid, data) {
    const entry = this.hooks.find(entry => entry.guid === guid);
    if (!entry) return;

    entry.onData(data);
  }
  registerHook(selector, onData) {
    const g = guid();

    this.hooks.push({ guid: g, selector, onData });

    this.io.emit("nimm-com-open-client-hook", g, selector);

    return () => {
      this.hooks = this.hooks.filter(v => v.guid !== g);
    };
  }
  send(...args) {
    this.io.emit("nimm-com-client-send", ...args);
  }
  request(onData, name, ...args) {
    const g = guid();
    this.requests.push({
      guid: g,
      onData
    });

    setTimeout(() => this.timeoutRequest(g), 100000);

    this.send("request", g, name, ...args);
  }
  requestResponse(guid, data) {
    const entry = this.requests.find(v => v.guid === guid);
    if (!entry) return;

    entry.onData(data);

    this.requests = this.requests.filter(v => v !== entry);
  }
  timeoutRequest(guid) {
    const entry = this.requests.find(v => v.guid === guid);
    if (!entry) return;

    entry.onData(null, new Error("Com Request timed out"));

    this.request = this.request.filter(v => v !== entry);
  }
}

module.exports = IoClient;
