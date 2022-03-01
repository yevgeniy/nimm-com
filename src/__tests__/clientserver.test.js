const { createServer, createClient } = require("../../");
const React = require("nimm-react");
const { root, component, useEffect } = require("nimm-react");

const serverIo = {
  events: [],
  on: function(name, fn) {
    this.events.push({ name, fn });
  },
  emit: function(name, ...data) {
    data = data.map(v =>
      (v && v.constructor === Object) || (v && v.constructor === Array)
        ? JSON.parse(JSON.stringify(v))
        : v
    );
    clientIo.events.filter(v => v.name === name).forEach(v => v.fn(...data));
  }
};
const clientIo = {
  events: [],
  on: function(name, fn) {
    this.events.push({ name, fn });
  },
  emit: function(name, ...data) {
    data = data.map(v =>
      (v && v.constructor === Object) || (v && v.constructor === Array)
        ? JSON.parse(JSON.stringify(v))
        : v
    );
    serverIo.events.filter(v => v.name === name).forEach(v => v.fn(...data));
  }
};

describe("clientserver", () => {
  afterEach(() => {
    serverIo.events = [];
    clientIo.events = [];
    jest.clearAllMocks();
  });
  test("open hook", async () => {
    const { useSelect: useSelectServer, wireServer } = createServer(React, {
      foo: 123
    });
    wireServer(serverIo);

    const { useSelect: useSelectClient } = createClient(React, clientIo);

    const fn = jest.fn();
    const ClientComponent = () => {
      const [foo] = useSelectClient(v => v.foo);
      fn(foo);
    };

    root(component(ClientComponent));

    await new Promise(res => setTimeout(res, 300));

    expect(fn.mock.calls).toEqual([[null], [123]]);
  });
  test.each`
    oper            | args                        | store                            | init                    | res
    ${"merge"}      | ${[{ foo: "hello world" }]} | ${{ foo: 123 }}                  | ${123}                  | ${"hello world"}
    ${"add"}        | ${["123", "234"]}           | ${{ foo: ["a"] }}                | ${["a"]}                | ${["a", "123", "234"]}
    ${"remove"}     | ${["a"]}                    | ${{ foo: ["a", "b"] }}           | ${["a", "b"]}           | ${["b"]}
    ${"remove"}     | ${[v => v === "a"]}         | ${{ foo: ["a", "b"] }}           | ${["a", "b"]}           | ${["b"]}
    ${"splice"}     | ${[0, 1, 1, 2, 3]}          | ${{ foo: ["a", "b"] }}           | ${["a", "b"]}           | ${[1, 2, 3, "b"]}
    ${"setProp"}    | ${["boo", 1]}               | ${{ foo: { coo: 123 } }}         | ${{ coo: 123 }}         | ${{ coo: 123, boo: 1 }}
    ${"deleteProp"} | ${["coo"]}                  | ${{ foo: { boo: 1, coo: 123 } }} | ${{ coo: 123, boo: 1 }} | ${{ boo: 1 }}
  `("update from server", async ({ oper, args, store, init, res }) => {
    const { useSelect: useSelectServer, wireServer } = createServer(
      React,
      store
    );
    wireServer(serverIo);

    const { useSelect: useSelectClient } = createClient(React, clientIo);

    const clientfn = jest.fn();
    const serverfn = jest.fn();
    let c = 0;
    const ServerComponent = () => {
      const [foo, opers] = useSelectServer(v => v.foo);
      serverfn(
        foo && foo.constructor === Object
          ? { ...foo }
          : foo && foo.constructor === Array
          ? [...foo]
          : foo
      );
      useEffect(() => {
        if (c !== 0) return;
        c++;
        setTimeout(() => {
          opers[oper](...args);
        }, 200);
      });
    };

    const ClientComponent = () => {
      const [foo] = useSelectClient(v => v.foo);
      clientfn(
        foo && foo.constructor === Object
          ? { ...foo }
          : foo && foo.constructor === Array
          ? [...foo]
          : foo
      );
    };

    root(component(ServerComponent));
    root(component(ClientComponent));

    await new Promise(res => setTimeout(res, 400));

    expect(clientfn.mock.calls).toEqual([[null], [init], [res]]);
    expect(serverfn.mock.calls).toEqual([[init], [res]]);
  });

  test.each`
    store                          | oper            | args                | res
    ${{ foo: null }}               | ${"merge"}      | ${[{ foo: 123 }]}   | ${[[null], [123]]}
    ${{ foo: ["a"] }}              | ${"add"}        | ${["b", "c"]}       | ${[[["a"]], [["a", "b", "c"]]]}
    ${{ foo: ["a", "b"] }}         | ${"remove"}     | ${[v => v === "a"]} | ${[[["a", "b"]], [["b"]]]}
    ${{ foo: ["a", "b"] }}         | ${"splice"}     | ${[0, 1, 123]}      | ${[[["a", "b"]], [[123, "b"]]]}
    ${{ foo: { coo: 1 } }}         | ${"setProp"}    | ${["moo", 2]}       | ${[[{ coo: 1 }], [{ coo: 1, moo: 2 }]]}
    ${{ foo: { coo: 1, moo: 2 } }} | ${"deleteProp"} | ${["moo"]}          | ${[[{ coo: 1, moo: 2 }], [{ coo: 1 }]]}
  `("update store from client", async ({ store, oper, args, res }) => {
    const { useSelect: useSelectServer, wireServer } = createServer(
      React,
      store
    );
    wireServer(serverIo);

    const { useSelect: useSelectClient } = createClient(React, clientIo);

    let c = 0;
    const fn = jest.fn();
    const ServerComponent = () => {
      const [foo] = useSelectServer(v => v.foo);
      fn(
        foo && foo.constructor === Object
          ? { ...foo }
          : foo && foo.constructor === Array
          ? [...foo]
          : foo
      );
    };

    const ClientComponent = () => {
      const [foo, opers] = useSelectClient(v => v.foo);

      useEffect(() => {
        if (c !== 0) return;
        c++;
        opers[oper](...args);
      });
    };

    root(component(ServerComponent));
    root(component(ClientComponent));

    await new Promise(res => setTimeout(res, 300));

    expect(fn.mock.calls).toEqual(res);
  });

  test("send", async () => {
    const { useCom: useComServer, wireServer } = createServer(React, {
      foo: null
    });
    wireServer(serverIo);

    const { useCom: useComClient } = createClient(React, clientIo);

    let c = 0;
    const fn = jest.fn();
    const ServerComponent = () => {
      const { on } = useComServer();
      on("update-users", (id, user) => {
        fn(id, user);
      });
    };

    const ClientComponent = () => {
      const { send } = useComClient();

      useEffect(() => {
        if (c !== 0) return;
        c++;

        send("update-users", 123, { username: "cuteuser" });
      });
    };

    root(component(ServerComponent));
    root(component(ClientComponent));

    await new Promise(res => setTimeout(res, 300));

    expect(fn.mock.calls).toEqual([[123, { username: "cuteuser" }]]);
  });
  test.each`
    ret                         | res
    ${{ saved: true }}          | ${{ saved: true }}
    ${Promise.resolve("saved")} | ${"saved"}
  `("request", async ({ ret, res }) => {
    const { useCom: useComServer, wireServer } = createServer(React, {
      foo: null
    });
    wireServer(serverIo);

    const { useCom: useComClient } = createClient(React, clientIo);

    let c = 0;
    const fn = jest.fn();
    const ServerComponent = () => {
      const { on } = useComServer();
      on("update-users", (id, user) => {
        fn(id, user);
        return ret;
      });
    };

    const ClientComponent = () => {
      const { request } = useComClient();

      useEffect(() => {
        if (c !== 0) return;
        c++;

        request("update-users", 123, { username: "cuteuser" }).then(r => fn(r));
      });
    };

    root(component(ServerComponent));
    root(component(ClientComponent));

    await new Promise(res => setTimeout(res, 300));

    expect(fn.mock.calls).toEqual([[123, { username: "cuteuser" }], [res]]);
  });
});
