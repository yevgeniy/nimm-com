const { createClient } = require("../client");
const { root, component, useState, useEffect } = require("nimm-react");
const React = require("nimm-react");
const io = {
  events: [],
  trigger: function(name, ...args) {
    const entry = this.events.find(v => v[0] === name);
    entry && entry[1](...args);
  },
  on: function(name, fn) {
    this.events.push([name, fn]);
  },
  emit: jest.fn()
};
describe("client", () => {
  afterEach(() => {
    jest.clearAllMocks();
    io.events = [];
  });
  test("creating hook", async () => {
    const { useSelect } = createClient(React, io);

    const fn = jest.fn();
    const C = () => {
      const [foo] = useSelect(x => x.foo);
      fn(foo);
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 100));

    expect(io.emit.mock.calls[0][0]).toBe("nimm-com-open-client-hook");
    expect(io.emit.mock.calls[0][1].constructor).toBe(String);
    expect(io.emit.mock.calls[0][2]).toBe("x => x.foo");

    const guid = io.emit.mock.calls[0][1];

    io.trigger("nimm-com-server-update-hook", guid, "super sexy");

    await new Promise(res => setTimeout(res, 100));

    expect(fn.mock.calls).toEqual([[null], ["super sexy"]]);
  });
  test("updating hook on client", async () => {
    const { useSelect, client } = createClient(React, io);

    const fn = jest.fn();
    let c = 0;
    const C = () => {
      const [, seta] = useState("a");
      const [foo] = useSelect(c === 0 ? x => x.foo : x => x.boo);
      fn(foo);

      useEffect(() => {
        if (c !== 0) return;
        c++;

        seta("return");
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 200));

    expect(io.emit.mock.calls[0][0]).toBe("nimm-com-open-client-hook");
    expect(io.emit.mock.calls[0][1].constructor).toBe(String);
    expect(io.emit.mock.calls[0][2]).toBe("x => x.foo");

    expect(io.emit.mock.calls[1][0]).toBe("nimm-com-open-client-hook");
    expect(io.emit.mock.calls[1][1].constructor).toBe(String);
    expect(io.emit.mock.calls[1][2]).toBe("x => x.boo");

    expect(client.hooks.length).toBe(1);
    expect(client.hooks[0].guid).toBe(io.emit.mock.calls[1][1]);
  });
  test.each`
    args                                               | oper            | res
    ${[x => x.feefee, "foo", { fun: 123, coom: 234 }]} | ${"merge"}      | ${["merge", "x => x.feefee", "foo", { fun: 123, coom: 234 }]}
    ${[1, 2, 3]}                                       | ${"add"}        | ${["add", "x => x.feefee", 1, 2, 3]}
    ${[v => v === "a"]}                                | ${"remove"}     | ${["remove", "x => x.feefee", 'v => v === "a"']}
    ${[0, 1, "a"]}                                     | ${"splice"}     | ${["splice", "x => x.feefee", 0, 1, "a"]}
    ${["foo", "hello world"]}                          | ${"setProp"}    | ${["setProp", "x => x.feefee", "foo", "hello world"]}
    ${["foo"]}                                         | ${"deleteProp"} | ${["deleteProp", "x => x.feefee", "foo"]}
  `("operations", async ({ args, oper, res }) => {
    const { useSelect } = createClient(React, io);

    let c = 0;
    const C = () => {
      const [foo, opers] = useSelect("x => x.feefee");

      useEffect(() => {
        if (c !== 0) return;
        c++;

        opers[oper](...args);
      });
    };

    root(component(C));

    await new Promise(r => setTimeout(r, 100));

    expect(io.emit.mock.calls[1]).toEqual(["nimm-com-client-send", ...res]);
  });

  test("send", async () => {
    const { useCom } = createClient(React, io);

    const fn = jest.fn();
    let c = 0;
    const C = () => {
      const { send } = useCom();

      useEffect(() => {
        if (c !== 0) return;
        c++;

        send("update-user", {
          id: 1,
          username: "cuteandsexy",
          goodlooking: true
        });
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 200));

    expect(io.emit.mock.calls).toEqual([
      [
        "nimm-com-client-send",
        "request",
        null,
        "update-user",
        { id: 1, username: "cuteandsexy", goodlooking: true }
      ]
    ]);
  });

  test("request response", async () => {
    const { useCom, client } = createClient(React, io);

    const fn = jest.fn();
    let c = 0;
    const C = () => {
      const { request } = useCom();

      useEffect(() => {
        if (c !== 0) return;
        c++;

        request("update-user", {
          id: 1,
          username: "cuteandsexy",
          goodlooking: true
        }).then(data => fn(data));
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 200));

    expect(io.emit.mock.calls[0][0]).toBe("nimm-com-client-send");
    expect(io.emit.mock.calls[0][1]).toBe("request");
    expect(io.emit.mock.calls[0][2].constructor).toBe(String);
    expect(io.emit.mock.calls[0][3]).toBe("update-user");
    expect(io.emit.mock.calls[0][4]).toEqual({
      id: 1,
      username: "cuteandsexy",
      goodlooking: true
    });

    const guid = io.emit.mock.calls[0][2];

    io.trigger("nimm-com-servier-request-response", guid, {
      id: 1,
      updated: true
    });

    await new Promise(res => setTimeout(res, 200));

    expect(fn.mock.calls).toEqual([[{ id: 1, updated: true }]]);

    expect(client.requests.length).toBe(0);
  });
});
