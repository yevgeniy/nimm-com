const IoServer = require("./IoServer");
const {
  toSelector,
  removeFromArray,
  guid,
  isSame,
  clone
} = require("./helpers");

function createServer({ useState, useEffect, useRef }, baseStore = {}) {
  const StoreManager = {
    _store: baseStore,
    _listeners: [],
    _clients: [],
    _hookOns: [],
    _api: [],

    addListener: function (fn) {
      this._listeners.push(fn);
      return () => {
        this._listeners = this._listeners.filter(v => v !== fn);
      };
    },

    onUpdate: function (subject, oper, data) {
      const change = { subject, oper, data };
      this._listeners.forEach(v => v(change));
      this.onUpdateIo(change);
    },
    onUpdateIo: function (changeDescriptor = {}) {
      this._clients.forEach(v => {
        v.update(changeDescriptor);
      });
    },

    merge: function (merge_ent_or_funct) {
      const args = [...arguments];

      let mergeFn;

      if (args[0].constructor === Function) {
        mergeFn = args[0];
      } else
        mergeFn = x => args[0];

      const mergeEnt = mergeFn(this._store);
      this._store = { ...this._store, ...mergeEnt };
      this.onUpdate(this._store, 'merge', { ent: mergeEnt })
    },
    update: function (selector, updates) {
      selector = toSelector(selector);

      let fn;
      if (updates.constructor === Function) fn = updates;
      else fn = () => updates;

      const subject = selector(this._store);

      const mergeEnt = fn(subject, this._store);

      for (let i in mergeEnt) subject[i] = mergeEnt[i];
      this.onUpdate(subject, "update", { ent: mergeEnt });
    },
    updateArray: function (selector, updates) {
      selector = toSelector(selector);

      let fn;
      if (updates.constructor === Function) fn = updates;
      else fn = () => updates;

      const subject = selector(this._store);

      const mergeEnt = fn(subject, this._store);

      subject.splice(0, Infinity);
      subject.push(...mergeEnt);

      this.onUpdate(subject, "update", { ent: mergeEnt });
    },

    add: function (selector, ...entries) {
      selector = toSelector(selector);
      const subject = selector(this._store);
      subject.push(...entries);
      this.onUpdate(subject, "add", { added: entries });
    },
    remove: function (selector, matcher) {
      selector = toSelector(selector);
      const col = selector(this._store);

      const removed = removeFromArray(col, matcher);

      this.onUpdate(col, "remove", { removed });
    },
    splice: function (selector, ...args) {
      selector = toSelector(selector);
      const subject = selector(this._store);
      const removed = subject.splice(...args);

      this.onUpdate(subject, "splice", {
        removed,
        start: args[0],
        cut: args[1],
        added: args.slice(2)
      });
    },
    setProp: function (selector, prop, val) {
      selector = toSelector(selector);

      const subject = selector(this._store);
      subject[prop] = val;
      this.onUpdate(subject, "setProp", { prop, val });
    },
    deleteProp: function (selector, prop) {
      selector = toSelector(selector);
      const subject = selector(this._store);
      const val = subject[prop];
      delete subject[prop];
      this.onUpdate(subject, "delete", { prop, val });
    },
    addIoServer: function (comServer) {
      this._clients.push(comServer);

      this.onUpdateIo("merge", this._store);

      return () => {
        comServer.shutdown();
        this._ioServers = this._clients.filter(v => v !== comServer);
      };
    },
    registerOn: function (guid, name, fn) {
      this.unregisterOn(guid);
      this._api.push({ guid, name, fn });
    },
    unregisterOn: function (guid) {
      this._api = this._api.filter(v => v.guid !== guid);
    },
    send: function (name, ...args) {
      this.request(name, ...args);
    },
    request: async function (name, ...args) {
      const ress = this._api
        .filter(v => v.name === name)
        .map(entry => {
          return new Promise(r => {
            res = entry.fn(...args);
            res && res.then ? res.then(r) : r(res);
          });
        });
      const [data] = await Promise.all(ress);
      return data;
    }
  };

  function useSelect(selector = x => x) {
    const updator = useRef(0);
    const [, sett] = useState(updator.current);
    const changeDescriptor = useRef(null);

    useEffect(() => {
      let buffer = clone(selector(StoreManager._store));
      const c = StoreManager.addListener(change => {
        const newval = clone(selector(StoreManager._store));

        if (isSame(buffer, newval)) return;

        buffer = newval;
        changeDescriptor.current = change;
        sett(++updator.current);
      });

      return c;
    }, [selector.toString()]);

    const merge = (...args) => {
      StoreManager.merge(...args);
    };
    const add = (...args) => {
      StoreManager.add(selector, ...args);
    };
    const remove = (...args) => {
      StoreManager.remove(selector, ...args);
    };
    const splice = (...args) => {
      StoreManager.splice(selector, ...args);
    };
    const setProp = (...args) => {
      StoreManager.setProp(selector, ...args);
    };
    const deleteProp = (...args) => {
      StoreManager.deleteProp(selector, ...args);
    };
    const update = (...args) => {
      StoreManager.update(selector, ...args);
    };
    const updateArray = (...args) => {
      StoreManager.updateArray(selector, ...args);
    };

    const change = changeDescriptor.current;
    if (change) changeDescriptor.current = null;

    return [
      selector(StoreManager._store),
      {
        merge,
        add,
        update,
        updateArray,
        remove,
        splice,
        setProp,
        deleteProp,
        changeDescriptor: change
      }
    ];
  }

  function useCom() {
    const hookGuid = useRef(guid());
    useEffect(() => {
      return () => StoreManager.unregisterOn(hookGuid.current);
    }, []);
    const on = (name, fn) => {
      StoreManager.registerOn(hookGuid.current, name, fn);
    };
    const send = (...args) => {
      StoreManager.send(...args);
    };
    const request = (...args) => {
      return StoreManager.request(...args);
    };
    const watch = (selector, fn) => {
      const [observing, { changeDescriptor }] = useSelect(selector);

      if (changeDescriptor) {
        const { subject, oper, data } = changeDescriptor;
        if (observing.indexOf(subject) > -1) fn(subject, oper, data);
      }
    };

    return { on, send, request, watch };
  }

  function listen(port) {
    const io = require("socket.io")();
    io.listen(port);
    connectServer(io);
  }
  function connectServer(io) {
    io.sockets.on("connection", com => {
      wireServer(com);
    });
  }
  function wireServer(com) {
    console.log("CONNECTION FOUND");
    const ioServer = new IoServer(com, StoreManager);
    const c = StoreManager.addIoServer(ioServer);

    com.on("disconnect", () => {
      console.log("CONNECTION SHUTTING DOWN");
      c();
    });
  }

  return {
    StoreManager,
    useSelect,
    useCom,
    listen,
    connectServer,
    wireServer
  };
}

module.exports = {
  createServer,
  __esModule: true
};
