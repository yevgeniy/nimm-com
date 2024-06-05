let c = 0;
function workgen(gen) {
  let name = ++c;

  let active = true;
  let childgen = [];

  const mainPromise = new Promise(async mainPromiseResolve => {
    if (!gen.next) gen = gen();

    let www = workgen._attacher;
    workgen._attacher = p => childgen.push(p);
    let step = gen.next();
    workgen._attacher = www;

    let res;

    while (!step.done) {
      if (step.value && step.value.then) {
        /*promise*/
        res = await step.value;
      } else if (step.value && step.value.next) {
        /*generator*/

        let www = workgen._attacher;
        workgen._attacher = p => childgen.push(p);
        res = await workgen(step.value);
        workgen._attacher = www;
      } else {
        res = step.value;
      }

      if (!active) {
        mainPromiseResolve(undefined);
        break;
      }

      let www = workgen._attacher;
      workgen._attacher = p => childgen.push(p);
      step = gen.next(res);
      workgen._attacher = www;
    }

    mainPromiseResolve(step.value);
  });
  workgen._attacher(mainPromise);

  mainPromise.kill = () => {
    active = false;
    childgen.forEach(v => v.kill());
  };

  return mainPromise;
}
workgen._attacher = () => {};

function toSelector(sel) {
  if (sel.constructor === Function) return sel;

  return new Function("store", `const fn = ${sel}; return fn(store)`);
}

function guid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isSame(a, b) {
  if (a && b && typeof a == "object" && typeof b == "object") {
    if (Object.keys(a).length != Object.keys(b).length) return false;
    for (var key in a) if (!isSame(a[key], b[key])) return false;
    return true;
  } else return a === b;
}
function removeFromArray(col, matcher) {
  const toremoveindex = [];
  col.forEach((v, i) => matcher(v, i) && toremoveindex.push(i));
  toremoveindex.reverse();

  const removed = [];
  toremoveindex.forEach(i => {
    removed.push(col.splice(i, 1)[0]);
  });

  return removed;
}
function clone(object) {
  if (!object) return object;
  if (object.constructor === Object || object.constructor === Array)
    return JSON.parse(JSON.stringify(object));
  return object;
}

module.exports = {
  workgen,
  toSelector,
  clone,
  guid,
  isSame,
  removeFromArray,
  __esModule: true
};
