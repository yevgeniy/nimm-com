const IoServer = require("./IoServer");
const { toSelector, removeFromArray, guid, isSame } = require("./helpers");

function toBuffer(ent) {
  if (!ent) return ent;
  else if (ent.constructor === Object) return { ...ent };
  else if (ent.constructor === Array) return [...ent];
  return ent;
}

function createServer({ useState, useEffect, useRef }, baseStore = {}) {
  const StoreManager = {
    _store: baseStore,
    _listeners: [],
    _clients: [],
    _hookOns: [],

    addListener: function(fn) {
      this._listeners.push(fn);
      return () => {
        this._listeners = this._listeners.filter(v => v !== fn);
      };
    },

    onUpdate: function() {
      this._listeners.forEach(v => v());
    },
    onUpdateIo: function() {
      this._clients.forEach(v => {
        v.update();
      });
    },

    merge: function(mergeEnt_prop_selector, mergeEnt_prop, _mergeEnt) {
      const args = [...arguments];
      let selector;
      let prop;
      let mergeEnt;

      if (args.length === 1) {
        mergeEnt = args[0];
      } else if (args.length === 2) {
        selector = v => v;
        prop = args[0];
        mergeEnt = args[1];
      } else if (args.length === 3) {
        selector = toSelector(args[0]);
        prop = args[1];
        mergeEnt = args[2];
      }

      if (!selector && !prop) this._store = { ...this._store, ...mergeEnt };
      else {
        const ent = selector(this._store);
        ent[prop] = { ...ent[prop], ...mergeEnt };
      }

      this.onUpdate();
    },
    safeMerge: function(fn) {
      fn = toSelector(fn);
      const res = fn(this._store);
      if (res) this._store = { ...this._store, ...res };
      this.onUpdate();
    },
    add: function(selector, ...entries) {
      selector = toSelector(selector);
      selector(this._store).push(...entries);
      this.onUpdate();
    },
    remove: function(selector, matcher) {
      selector = toSelector(selector);
      const col = selector(this._store);

      removeFromArray(col, matcher);

      this.onUpdate();
    },
    splice: function(selector, ...args) {
      selector = toSelector(selector);
      const ent = selector(this._store);
      ent.splice(...args);

      this.onUpdate();
    },
    setProp: function(selector, prop, val) {
      selector = toSelector(selector);
      selector(this._store)[prop] = val;
      this.onUpdate();
    },
    deleteProp: function(selector, prop) {
      selector = toSelector(selector);
      delete selector(this._store)[prop];
      this.onUpdate();
    },
    addIoServer: function(comServer) {
      this._clients.push(comServer);

      this.onUpdateIo("merge", this._store);

      return () => {
        comServer.shutdown();
        this._ioServers = this._clients.filter(v => v !== comServer);
      };
    },
    registerOn: function(guid, name, fn) {
      this.unregisterOn(guid);
      this._clients.forEach(client =>
        client.listeners.push({ guid, name, fn })
      );
    },
    unregisterOn: function(guid) {
      this._clients.forEach(client => {
        client.listeners = client.listeners.filter(v => v.guid !== guid);
      });
    }
  };

  function useSelect(selector = x => x) {
    const updator = useRef(0);
    const [, sett] = useState(updator.current);

    useEffect(() => {
      let buffer = toBuffer(selector(StoreManager._store));
      const c = StoreManager.addListener(() => {
        const newval = toBuffer(selector(StoreManager._store));

        if (isSame(buffer, newval)) return;

        buffer = newval;
        sett(++updator.current);
      });

      return c;
    }, [selector.toString()]);

    const merge = (...args) => {
      StoreManager.merge(...args);
      StoreManager.onUpdateIo("merge", ...args);
    };
    const safeMerge = fn => {
      StoreManager.safeMerge(fn);
      StoreManager.onUpdateIo("safeMerge", ...args);
    };
    const add = (...args) => {
      StoreManager.add(selector, ...args);
      StoreManager.onUpdateIo("add", selector, ...args);
    };
    const remove = (...args) => {
      StoreManager.remove(selector, ...args);
      StoreManager.onUpdateIo("remove", selector, ...args);
    };
    const splice = (...args) => {
      StoreManager.splice(selector, ...args);
      StoreManager.onUpdateIo("splice", selector, ...args);
    };
    const setProp = (...args) => {
      StoreManager.setProp(selector, ...args);
      StoreManager.onUpdateIo("setProp", selector, ...args);
    };
    const deleteProp = (...args) => {
      StoreManager.deleteProp(selector, ...args);
      StoreManager.onUpdateIo("deleteProp", selector, ...args);
    };

    return [
      selector(StoreManager._store),
      {
        merge,
        safeMerge,
        add,
        remove,
        splice,
        setProp,
        deleteProp
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

    return { on };
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
