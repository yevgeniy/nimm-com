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
  if (a !== b) return false;

  if (!a || !b) return a === b;

  if (a.constructor === Object) {
    if (Object.keys(a).length !== Object.keys(b).length) return false;
    for (let i in a) {
      if (a[i] !== b[i]) return false;
      if (a.constructor === Object || a.constructor === Array)
        return isSame(a[i], b[i]);
    }
  } else if (a.constructor === Array) {
    if (a.length !== b.length) return false;
    for (let x = 0; x < a.length; x++) {
      if (a[x] !== b[x]) return false;
      if (a[x].constructor === Object || a[x].constructor === Array)
        return isSame(a[x], b[x]);
    }
  }

  return true;
}
function removeFromArray(col, matcher) {
  const toremoveindex = [];
  col.forEach((v, i) => matcher(v, i) && toremoveindex.push(i));
  toremoveindex.reverse();

  toremoveindex.forEach(i => col.splice(i, 1));
}
function clone(object) {
  if (!object) return object;
  if (object.constructor === Object) return { ...object };
  else if (object.constructor === Array) return [...object];
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
