// Independent test-page instrumentation. Never shipped in either adapter.
export function observeResources() {
  const listeners = [];
  const observers = new Set();
  const frames = new Set();
  const timers = new Set();
  const nativeAdd = EventTarget.prototype.addEventListener;
  const nativeRemove = EventTarget.prototype.removeEventListener;
  const capture = options => typeof options === "boolean" ? options : Boolean(options?.capture);
  EventTarget.prototype.addEventListener = function(type, callback, options) {
    if (!listeners.some(item => item.target === this && item.type === type && item.callback === callback && item.capture === capture(options))) {
      listeners.push({target: this, type, callback, capture: capture(options)});
    }
    return nativeAdd.call(this, type, callback, options);
  };
  EventTarget.prototype.removeEventListener = function(type, callback, options) {
    const index = listeners.findIndex(item => item.target === this && item.type === type && item.callback === callback && item.capture === capture(options));
    if (index !== -1) listeners.splice(index, 1);
    return nativeRemove.call(this, type, callback, options);
  };
  for (const name of ["MutationObserver", "ResizeObserver"]) {
    const Native = window[name];
    window[name] = class extends Native {
      observe(...args) { observers.add(this); return super.observe(...args); }
      disconnect() { observers.delete(this); return super.disconnect(); }
    };
  }
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    const id = nativeFrame(time => { frames.delete(id); callback(time); });
    frames.add(id);
    return id;
  };
  window.cancelAnimationFrame = id => { frames.delete(id); nativeCancel(id); };
  const nativeTimeout = window.setTimeout.bind(window);
  const nativeClear = window.clearTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    const id = nativeTimeout(() => { timers.delete(id); callback(...args); }, delay);
    timers.add(id);
    return id;
  };
  window.clearTimeout = id => { timers.delete(id); nativeClear(id); };
  return () => ({listeners: listeners.length, observers: observers.size, frames: frames.size, timers: timers.size});
}
