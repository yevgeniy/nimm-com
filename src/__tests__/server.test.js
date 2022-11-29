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
    ${[{ foo: 2 }]}                                           | ${{ foo: 2 }}
    ${[x => ({ foo: x.foo + 2 })]} | ${{ foo: 3 }}
  `("merge server operator", ({ args, res }) => {
    const { StoreManager } = createServer(React, {
      foo: 1,
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
  test("watch updates", async () => {
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
      const [, { merge }] = useSelect(x => x);

      useEffect(() => {
        if (state === "init") {
          state = "another";
          merge({ ids: ['a', 'b'] });
        } else if (state === "another") {
          state = "done";
          merge({
            sexykitten: {
              young: {
                and: 'cute'
              }
            }
          });
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

    expect(fn.mock.calls).toEqual([
      [
        {
          "bar": "asdf",
          "foo": 1,
          "ids": ["a", "b"],
          "sexykitten": { "young": { "and": "nubile" } }
        },
        "merge",
        { "ent": { "ids": ["a", "b"] } }
      ],
      [
        { "bar": "asdf", "foo": 1, "ids": ["a", "b"], "sexykitten": { "young": { "and": "cute" } } },
        "merge",
        { "ent": { "sexykitten": { "young": { "and": "cute" } } } }]]);
  });

  test("respond only on watched subjects", async () => {
    const { useSelect, useCom } = createServer(React, {
      users: []
    });

    const fn = jest.fn();

    let state = "init";
    const Operator = () => {
      const [res, { merge }] = useSelect(v => v);
      const [, { update }] = useSelect(v => v.users[0])

      useEffect(() => {
        if (state === "init") {
          state = "next";
          merge({ users: [{ username: "kat" }, { username: "mermaid" }] });
        } else if (state === "next") {
          state = "done";
          update({
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
        "update",
        { ent: { pictures: 123, seen: true } }
      ]
    ]);
  });
});
