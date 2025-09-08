// tiny EventEmitter shim
class EventEmitter {
  constructor() {
    this._handlers = {};
  }
  on(ev, fn) {
    (this._handlers[ev] = this._handlers[ev] || []).push(fn);
  }
  off(ev, fn) {
    this._handlers[ev] = (this._handlers[ev] || []).filter((f) => f !== fn);
  }
  emit(ev, ...args) {
    (this._handlers[ev] || []).forEach((fn) => tryCall(fn, args));
  }
}
function tryCall(fn, args) {
  try {
    fn(...args);
  } catch (e) {
    /* swallow */
  }
}
module.exports = EventEmitter;
