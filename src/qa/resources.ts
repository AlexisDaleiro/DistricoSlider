export interface ResourceSample {
  cycle: number;
  urls: number;
  listeners: number;
  timeouts: number;
  intervals: number;
  frames: number;
  nodes: number;
  heapBytes: number | null;
}

/** Solo durante QA. No retiene nodos: observa listeners de window/document. */
export function observeResources() {
  const browser: Window = window;
  const urls = new Set<string>(),
    timeouts = new Set<number>(),
    intervals = new Set<number>(),
    frames = new Set<number>();
  const listeners: {
    target: EventTarget;
    type: string;
    callback: EventListenerOrEventListenerObject;
    capture: boolean;
  }[] = [];
  const original = {
    timeout: browser.setTimeout,
    clearTimeout: browser.clearTimeout,
    interval: browser.setInterval,
    clearInterval: browser.clearInterval,
    frame: window.requestAnimationFrame,
    cancelFrame: window.cancelAnimationFrame,
    create: URL.createObjectURL,
    revoke: URL.revokeObjectURL,
  };
  browser.setTimeout = ((
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    if (typeof handler !== 'function')
      return original.timeout.call(window, handler, delay, ...args);
    const id = original.timeout.call(
      window,
      () => {
        timeouts.delete(id);
        if (typeof handler === 'function')
          (handler as (...args: unknown[]) => void)(...args);
      },
      delay,
    );
    timeouts.add(id);
    return id;
  }) as typeof browser.setTimeout;
  browser.clearTimeout = ((id?: number) => {
    if (id !== undefined) timeouts.delete(id);
    original.clearTimeout.call(window, id);
  }) as typeof browser.clearTimeout;
  browser.setInterval = ((
    handler: TimerHandler,
    delay?: number,
    ...args: unknown[]
  ) => {
    const id = original.interval.call(window, handler, delay, ...args);
    intervals.add(id);
    return id;
  }) as typeof browser.setInterval;
  browser.clearInterval = ((id?: number) => {
    if (id !== undefined) intervals.delete(id);
    original.clearInterval.call(window, id);
  }) as typeof browser.clearInterval;
  window.requestAnimationFrame = (callback) => {
    const id = original.frame.call(window, (time) => {
      frames.delete(id);
      callback(time);
    });
    frames.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    frames.delete(id);
    original.cancelFrame.call(window, id);
  };
  URL.createObjectURL = (object) => {
    const url = original.create.call(URL, object);
    urls.add(url);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    urls.delete(url);
    original.revoke.call(URL, url);
  };
  const captureOf = (options?: boolean | EventListenerOptions) =>
    typeof options === 'boolean' ? options : Boolean(options?.capture);
  const restoreListeners = [window, document].map((target: EventTarget) => {
    const add = target.addEventListener,
      remove = target.removeEventListener;
    target.addEventListener = function (type, callback, options) {
      const capture = captureOf(options);
      if (
        (this === window || this === document) &&
        callback &&
        !(typeof options === 'object' && (options.once || options.signal)) &&
        !listeners.some(
          (item) =>
            item.target === this &&
            item.type === type &&
            item.callback === callback &&
            item.capture === capture,
        )
      )
        listeners.push({ target: this, type, callback, capture });
      add.call(this, type, callback, options);
    };
    target.removeEventListener = function (type, callback, options) {
      const index = listeners.findIndex(
        (item) =>
          item.target === this &&
          item.type === type &&
          item.callback === callback &&
          item.capture === captureOf(options),
      );
      if (index !== -1) listeners.splice(index, 1);
      remove.call(this, type, callback, options);
    };
    return () => {
      target.addEventListener = add;
      target.removeEventListener = remove;
    };
  });
  let stopped = false;
  return {
    sample(cycle: number): ResourceSample {
      const memory = (
        performance as Performance & { memory?: { usedJSHeapSize: number } }
      ).memory;
      return {
        cycle,
        urls: urls.size,
        listeners: listeners.length,
        timeouts: timeouts.size,
        intervals: intervals.size,
        frames: frames.size,
        nodes: document.querySelectorAll('*').length,
        heapBytes: memory?.usedJSHeapSize ?? null,
      };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      browser.setTimeout = original.timeout;
      browser.clearTimeout = original.clearTimeout;
      browser.setInterval = original.interval;
      browser.clearInterval = original.clearInterval;
      window.requestAnimationFrame = original.frame;
      window.cancelAnimationFrame = original.cancelFrame;
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      restoreListeners.forEach((restore) => restore());
      listeners.length = 0;
      urls.clear();
      timeouts.clear();
      intervals.clear();
      frames.clear();
    },
  };
}

export function stableResources(samples: ResourceSample[]): boolean {
  if (samples.length < 2) return true;
  const first = samples[0],
    last = samples[samples.length - 1];
  return (
    (['urls', 'listeners', 'timeouts', 'intervals', 'frames'] as const).every(
      (key) => last[key] <= first[key],
    ) && last.nodes <= first.nodes
  );
}
