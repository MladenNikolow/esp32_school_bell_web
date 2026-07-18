const PRIORITY = {
  critical: 0,
  visible: 1,
  supporting: 2,
  background: 3,
};

const abortError = () => new DOMException('The request was aborted', 'AbortError');

class RequestScheduler {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.sequence = 0;
    this.queue = [];
    this.inFlight = new Map();
    this.exclusivePending = false;
  }

  schedule(task, options = {}) {
    const {
      priority = 'visible',
      key = null,
      signal = null,
      exclusive = false,
      onQueued = null,
      onStarted = null,
    } = options;

    if (signal?.aborted) return Promise.reject(abortError());
    if (key && this.inFlight.has(key)) {
      return this.inFlight.get(key).then((value) =>
        value instanceof Response ? value.clone() : value);
    }

    let resolveJob;
    let rejectJob;
    const promise = new Promise((resolve, reject) => {
      resolveJob = resolve;
      rejectJob = reject;
    });
    const job = {
      task,
      priority: PRIORITY[priority] ?? PRIORITY.visible,
      priorityName: priority,
      sequence: ++this.sequence,
      signal,
      exclusive,
      onStarted,
      resolve: resolveJob,
      reject: rejectJob,
    };

    if (exclusive) this.exclusivePending = true;
    this.queue.push(job);
    this.queue.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    onQueued?.();

    if (signal) {
      job.abortHandler = () => {
        const index = this.queue.indexOf(job);
        if (index >= 0) {
          this.queue.splice(index, 1);
          rejectJob(abortError());
          if (exclusive) this.exclusivePending = this.queue.some((item) => item.exclusive);
        }
      };
      signal.addEventListener('abort', job.abortHandler, { once: true });
    }

    const sharedPromise = promise.finally(() => {
      if (key) this.inFlight.delete(key);
    });
    if (key) this.inFlight.set(key, sharedPromise);
    this._drain();

    return sharedPromise.then((value) =>
      value instanceof Response ? value.clone() : value);
  }

  _drain() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) return;

    const exclusiveIndex = this.queue.findIndex((job) => job.exclusive);
    if (exclusiveIndex >= 0) {
      if (this.active > 0) return;
      const [job] = this.queue.splice(exclusiveIndex, 1);
      this._start(job);
      return;
    }
    if (this.exclusivePending) return;

    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      this._start(job);
    }
  }

  _start(job) {
    if (job.signal?.aborted) {
      job.reject(abortError());
      this._drain();
      return;
    }
    if (job.abortHandler) {
      job.signal.removeEventListener('abort', job.abortHandler);
    }
    this.active += 1;
    job.onStarted?.();

    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        this.active = Math.max(0, this.active - 1);
        if (job.exclusive) {
          this.exclusivePending = this.queue.some((item) => item.exclusive);
        }
        this._drain();
      });
  }
}

export default new RequestScheduler(3);
export { RequestScheduler, PRIORITY };
