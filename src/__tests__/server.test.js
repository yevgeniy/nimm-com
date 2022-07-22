const { createServer } = require("../server");
const React = require("nimm-react");
const { root, component, useState, useEffect } = require("nimm-react");

describe("index", () => {
  test.each`
    store         | res
    ${undefined}  | ${{}}
    ${{ foo: 1 }} | ${{ foo: 1 }}
  `("set default store", ({ store, res }) => {
    const { StoreManager } = createServer(React, store);

    expect(StoreManager._store).toEqual(res);
  });

  test("add and remove listeners", () => {
    const { StoreManager } = createServer(React);
    const fn = jest.fn();

    const c = StoreManager.addListener(() => fn(1));

    StoreManager.onUpdate();

    expect(fn.mock.calls).toEqual([[1]]);

    c();

    StoreManager.onUpdate();
    expect(fn.mock.calls).toEqual([[1]]);
  });
  test("onUpdate", () => {
    const { StoreManager } = createServer(React);
    const fn = jest.fn();

    const c = StoreManager.addListener(() => fn(1));

    StoreManager.onUpdate();

    expect(fn.mock.calls).toEqual([[1]]);
  });

  /*

*/

  test.each`
    args                                                      | res
    ${[{ foo: 2 }]}                                           | ${{ foo: 2, moo: {}, users: { cutelass: {} } }}
    ${[s => ({
    lady: [...s.lady, "looking"]
  })]} | ${{ lady: ["good", "looking"] }}
    ${["moo", { dober: 2 }]}                                  | ${{ foo: 1, moo: { dober: 2 }, users: { cutelass: {} } }}
    ${[v => v.users, "cutelass", { seen: true }]}             | ${{ foo: 1, moo: {}, users: { cutelass: { seen: true } } }}
    ${[v => v.foo, foo => ({ foo: foo + 1 })]}                | ${{ foo: 2, moo: {}, users: { cutelass: {} } }}
    ${[v => v.foo, (foo, state) => ({ foo: state.foo + 1 })]} | ${{ foo: 2, moo: {}, users: { cutelass: {} } }}
  `("merge server operator", ({ args, res }) => {
    const { StoreManager } = createServer(React, {
      foo: 1,
      moo: {},
      users: { cutelass: {} },
      lady: ["good"]
    });

    StoreManager.merge(...args);

    expect(StoreManager._store).toMatchObject(res);
  });
  test.each`
    arg
    ${{ a: 11, b: 22 }}
    ${(moo, state) => ({ a: 8 + moo.b + state.foo, b: 22 })}
  `("update", ({ arg }) => {
    const { StoreManager } = createServer(React, {
      foo: 1,
      moo: { a: 1, b: 2 },
      users: { cutelass: {} }
    });

    StoreManager.update(x => x.moo, arg);

    expect(StoreManager._store).toEqual({
      foo: 1,
      moo: { a: 11, b: 22 },
      users: { cutelass: {} }
    });
  });
  test.each`
    arg
    ${[11, 22]}
    ${(moo, state) => [moo[0] + state.foo + 8, 22]}
  `("updateArray", ({ arg }) => {
    const { StoreManager } = createServer(React, {
      foo: 2,
      moo: [1, 2],
      users: { cutelass: {} }
    });

    StoreManager.update(x => x.moo, arg);

    expect(StoreManager._store).toEqual({
      foo: 2,
      moo: [11, 22],
      users: { cutelass: {} }
    });
  });

  test("merge calls onupdate", () => {
    const { StoreManager } = createServer(React, {
      foo: 1,
      moo: {},
      users: { cutelass: {} }
    });

    const fn = jest.fn();
    StoreManager.addListener(() => fn(1));
    StoreManager.merge({ foo: 2 });

    expect(StoreManager._store).toMatchObject({ foo: 2 });
    expect(fn.mock.calls).toEqual([[1]]);
  });

  test("useSelect merge", async () => {
    const { useSelect } = createServer(React, {
      foo: null
    });

    const fn = jest.fn();

    const C = () => {
      const [res, { merge }] = useSelect(v => v.foo);

      fn(res);

      useEffect(() => {
        res === null && merge({ foo: 2 });
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toEqual([[null], [2]]);
  });
  test("useSelect removes listener on unmount", async () => {
    const { useSelect, StoreManager } = createServer(React, {
      foo: 1
    });

    const fn = jest.fn();

    const C = () => {
      const [res] = useSelect(v => v.foo);

      fn(res);
    };

    const sys = root(component(C));

    await new Promise(res => setTimeout(res, 500));

    sys.shutdown();

    StoreManager.onUpdate();

    expect(fn.mock.calls).toEqual([[1]]);
  });
  test("useSelect can hot swap selectors", async () => {
    const { useSelect, StoreManager } = createServer(React, {
      foo: "foo",
      boo: "boo"
    });

    const fn = jest.fn();

    let c = 0;

    const C = () => {
      const [res, { merge }] = useSelect(c === 0 ? v => v.foo : v => v.boo);

      fn(res);

      useEffect(() => {
        c++;
        if (c > 3) return;
        merge({
          foo: "foo" + c,
          boo: "boo" + c
        });
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    /* there's probably a need to rework this to be more accurate */
    expect(fn.mock.calls).toEqual([["foo"], ["boo1"], ["boo2"], ["boo3"]]);
  });

  test("useSelect add", async () => {
    const { useSelect } = createServer(React, {
      foo: ["a"]
    });

    const fn = jest.fn();

    let c = 0;
    const C = () => {
      const [res, { add }] = useSelect(v => v.foo);

      fn([...res]);

      useEffect(() => {
        if (c !== 0) return;
        c++;
        add("b");
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toEqual([[["a"]], [["a", "b"]]]);
  });
  test.each`
    arg
    ${v => v === 3}
  `("useSelect remove", async ({ arg }) => {
    const { useSelect } = createServer(React, {
      foo: ["a", 3, 3, 4]
    });

    const fn = jest.fn();

    let c = 0;
    const C = () => {
      const [res, { remove }] = useSelect(v => v.foo);

      fn([...res]);

      useEffect(() => {
        if (c !== 0) return;
        c++;
        remove(arg);
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toEqual([[["a", 3, 3, 4]], [["a", 4]]]);
  });
  test("useSelect setProp", async () => {
    const { useSelect } = createServer(React, {
      foo: {
        a: 1
      }
    });

    const fn = jest.fn();

    let c = 0;
    const C = () => {
      const [res, { setProp }] = useSelect(v => v.foo);

      fn({ ...res });

      useEffect(() => {
        if (c !== 0) return;
        c++;
        setProp("b", 4);
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toEqual([[{ a: 1 }], [{ a: 1, b: 4 }]]);
  });
  test("useSelect deleteProp", async () => {
    const { useSelect } = createServer(React, {
      foo: {
        a: 1,
        b: 2
      }
    });

    const fn = jest.fn();

    let c = 0;
    const C = () => {
      const [res, { deleteProp }] = useSelect(v => v.foo);

      fn({ ...res });

      useEffect(() => {
        if (c !== 0) return;
        c++;
        deleteProp("b");
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toEqual([[{ a: 1, b: 2 }], [{ a: 1 }]]);
  });
  test("useSelect splice", async () => {
    const { useSelect } = createServer(React, {
      foo: ["a", "b", "c"]
    });

    const fn = jest.fn();

    let c = 0;
    const C = () => {
      const [res, { splice }] = useSelect(v => v.foo);

      fn([...res]);

      useEffect(() => {
        if (c !== 0) return;
        c++;
        splice(0, 1, 1, 2, 3);
      });
    };

    root(component(C));

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toEqual([[["a", "b", "c"]], [[1, 2, 3, "b", "c"]]]);
  });
  /*
  
  */
  test.each`
    selector | oper | args1 | args2 | exp
    ${v => v} | ${"merge"} | ${[{ foo: 2 }]} | ${[{ foo: 3 }]} | ${[
  [{ foo: 2, bar: "asdf" }, "merge", { ent: { foo: 2 } }],
  [{ foo: 3, bar: "asdf" }, "merge", { ent: { foo: 3 } }]
]}
    ${v => v} | ${"merge"} | ${[v => v, () => ({ foo: 2 })]} | ${[v => v, () => ({ foo: 3 })]} | ${[
  [{ foo: 2, bar: "asdf" }, "merge", { ent: { foo: 2 } }],
  [{ foo: 3, bar: "asdf" }, "merge", { ent: { foo: 3 } }]
]}
    ${v => v} | ${"merge"} | ${[v => v.sexykitten, "young", { and: "beautiful" }]} | ${[v => v.sexykitten, "young", { and: "cute" }]} | ${[
  [{ and: "beautiful" }, "merge", { ent: { and: "beautiful" } }],
  [{ and: "cute" }, "merge", { ent: { and: "cute" } }]
]}
    ${v => v.ids} | ${"add"} | ${[1, 2]} | ${["a", "b", "c"]} | ${[
  [[1, 2, 4, 1, 2], "add", { added: [1, 2] }],
  [[1, 2, 4, 1, 2, "a", "b", "c"], "add", { added: ["a", "b", "c"] }]
]}
    ${v => v.ids} | ${"remove"} | ${[v => v === 1]} | ${[v => v === 2]} | ${[
  [[2, 4], "remove", { removed: [1] }],
  [[4], "remove", { removed: [2] }]
]}
    ${v => v.sexykitten.young} | ${"setProp"} | ${["really", "cute"]} | ${["trully", "beautiful"]} | ${[
  [{ and: "nubile", really: "cute" }, "setProp", { prop: "really", val: "cute" }],
  [{ and: "nubile", really: "cute", trully: "beautiful" }, "setProp", { prop: "trully", val: "beautiful" }]
]}
    ${v => v.sexykitten.young} | ${"update"} | ${[{ trully: "gorgious", and: "beautiful" }]} | ${[{ certainly: "soft" }]} | ${[
  [{ and: "beautiful", trully: "gorgious" }, "update", { ent: { trully: "gorgious", and: "beautiful" } }],
  [{ and: "beautiful", trully: "gorgious", certainly: "soft" }, "update", { ent: { certainly: "soft" } }]
]}
    ${v => v.ids} | ${"splice"} | ${[0, 2, "a"]} | ${[0, 1, "b"]} | ${[
  [["a", 4], "splice", { removed: [1, 2], start: 0, cut: 2, added: ["a"] }],
  [["b", 4], "splice", { removed: ["a"], start: 0, cut: 1, added: ["b"] }]
]}
  `("watch updates", async ({ selector, oper, args1, args2, exp }) => {
    const { useSelect, useCom } = createServer(React, {
      foo: 1,
      bar: "asdf",
      sexykitten: {
        young: {
          and: "nubile"
        }
      },
      ids: [1, 2, 4]
    });

    const fn = jest.fn();

    let state = "init";
    const Operator = () => {
      const [res, opers] = useSelect(selector);

      useEffect(() => {
        if (state === "init") {
          state = "another";
          opers[oper](...args1);
        } else if (state === "another") {
          state = "done";
          opers[oper](...args2);
        }
      });
    };

    const Watcher = () => {
      const { watch } = useCom();

      watch(
        v => [v, v.ids, v.sexykitten.young],
        (subject, oper, data) =>
          fn(JSON.parse(JSON.stringify(subject)), oper, data)
      );
    };

    root(
      component(() => {
        return [component(Watcher), component(Operator)];
      })
    );

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toMatchObject(exp);
  });

  test("respond only on watched subjects", async () => {
    const { useSelect, useCom } = createServer(React, {
      users: []
    });

    const fn = jest.fn();

    let state = "init";
    const Operator = () => {
      const [res, { merge }] = useSelect(v => v);

      useEffect(() => {
        if (state === "init") {
          state = "next";
          merge({ users: [{ username: "kat" }, { username: "mermaid" }] });
        } else if (state === "next") {
          state = "done";
          merge(v => v.users, 0, {
            pictures: 123,
            seen: true
          });
        }
      });
    };

    const Watcher = () => {
      const { watch } = useCom();

      watch(
        v => v.users,
        (subject, oper, data) =>
          fn(JSON.parse(JSON.stringify(subject)), oper, data)
      );
    };

    root(
      component(() => {
        return [component(Watcher), component(Operator)];
      })
    );

    await new Promise(res => setTimeout(res, 500));

    expect(fn.mock.calls).toMatchObject([
      [
        { username: "kat", pictures: 123, seen: true },
        "merge",
        { ent: { pictures: 123, seen: true } }
      ]
    ]);
  });
});
