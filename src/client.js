const IoClient = require("./IoClient");
const { removeFromArray, isSame, toSelector } = require("./helpers");

function createClient({ useState, useEffect, useRef }, io) {
  const client = new IoClient(io);

  function useSelect(selector = "x => x") {
    selector = selector.toString();

    const [data, setdata] = useState(null);
    const state = useRef("init");

    useEffect(() => {
      state.current = "requesting";
      const c = client.registerHook(selector, newData => {
        state.current = "set";
        setdata(data => {
          return isSame(data, newData) ? data : newData;
        });
      });

      return () => c();
    }, [selector]);

    const merge = (...args) => {
      client.send("merge", ...args);

      if (args.length === 1) setdata(toSelector(selector)(args[0]));
    };
    const add = (...args) => {
      console.log("OPER", args);
      client.send("add", selector, ...args);

      if (data && data.constructor === Array) {
        const newdata = [...data, ...args];
        setdata(newdata);
      }
    };
    const remove = fn => {
      if (fn.constructor !== Function)
        throw new Error("remove param must be a function");
      fn = fn.toString();
      client.send("remove", selector, fn);

      if (data && data.constructor === Array) {
        removeFromArray(data, ...args);
        setdata([...data]);
      }
    };
    const splice = (...args) => {
      client.send("splice", selector, ...args);

      if (data && data.constructor === Array) {
        data.splice(...args);
        setdata([...data]);
      }
    };
    const setProp = (...args) => {
      client.send("setProp", selector, ...args);

      if (data && data.constructor === Object) {
        data[args[0]] = args[1];
        setdata({ ...data });
      }
    };
    const deleteProp = (...args) => {
      client.send("deleteProp", selector, ...args);

      if (data && data.constructor === Object) {
        delete data[args[0]];
        setdata({ ...data });
      }
    };

    return [data, { state, merge, add, remove, splice, setProp, deleteProp }];
  }

  function useCom() {
    const send = (name, ...args) => {
      client.send("request", null, name, ...args);
    };
    const request = (name, ...args) => {
      return new Promise((res, rej) => {
        return client.request(
          (data, error) => {
            if (error) {
              rej(error);
              return;
            }
            res(data);
          },
          name,
          ...args
        );
      });
    };
    return {
      send,
      request
    };
  }

  return {
    client,
    useCom,
    useSelect
  };
}

module.exports = {
  createClient
};
