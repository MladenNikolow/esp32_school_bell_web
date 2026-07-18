const STORAGE_KEY = 'ringy.httpDebug';
const MAX_EVENTS = 200;

class HttpDiagnostics {
  constructor() {
    this.sequence = 0;
    this.active = 0;
    this.peakActive = 0;
    this.events = [];
    this.enabled = this._readEnabled();

    if (typeof window !== 'undefined') {
      window.__ringyHttpDiagnostics = {
        enable: () => this.setEnabled(true),
        disable: () => this.setEnabled(false),
        clear: () => { this.events = []; },
        snapshot: () => this.snapshot(),
      };
    }
  }

  _readEnabled() {
    if (typeof window === 'undefined') return false;
    const queryEnabled = new URLSearchParams(window.location.search).get('httpDebug') === '1';
    return queryEnabled || window.localStorage?.getItem(STORAGE_KEY) === '1';
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(STORAGE_KEY, this.enabled ? '1' : '0');
    }
    console.info(`[HTTP DIAG] detailed tracing ${this.enabled ? 'enabled' : 'disabled'}`);
  }

  _safeEndpoint(url) {
    try {
      return new URL(url, window.location.origin).pathname;
    } catch {
      return String(url).split('?')[0];
    }
  }

  _record(event) {
    const entry = {
      timestamp: new Date().toISOString(),
      online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
      visibility: typeof document === 'undefined' ? undefined : document.visibilityState,
      ...event,
    };
    this.events.push(entry);
    if (this.events.length > MAX_EVENTS) this.events.shift();
    return entry;
  }

  start(method, url) {
    const context = {
      id: ++this.sequence,
      method,
      endpoint: this._safeEndpoint(url),
      startedAt: performance.now(),
    };
    this.active += 1;
    this.peakActive = Math.max(this.peakActive, this.active);
    this._record({
      phase: 'start',
      id: context.id,
      method,
      endpoint: context.endpoint,
      active: this.active,
      peakActive: this.peakActive,
    });
    if (this.enabled) {
      console.debug(
        `[HTTP DIAG #${context.id}] START ${method} ${context.endpoint}`,
        { active: this.active, peakActive: this.peakActive },
      );
    }
    return context;
  }

  response(context, response) {
    const entry = this._record({
      phase: 'response',
      id: context.id,
      method: context.method,
      endpoint: context.endpoint,
      status: response.status,
      ok: response.ok,
      durationMs: Math.round(performance.now() - context.startedAt),
      active: this.active,
    });
    if (this.enabled || !response.ok) {
      const log = response.ok ? console.debug : console.warn;
      log(
        `[HTTP DIAG #${context.id}] RESPONSE ${response.status} `
        + `${context.method} ${context.endpoint}`,
        entry,
      );
    }
  }

  error(context, error) {
    const networkLevel = error instanceof TypeError;
    const entry = this._record({
      phase: 'error',
      id: context.id,
      method: context.method,
      endpoint: context.endpoint,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
      networkLevel,
      durationMs: Math.round(performance.now() - context.startedAt),
      active: this.active,
      protocol: typeof location === 'undefined' ? undefined : location.protocol,
    });
    console.warn(
      `[HTTP DIAG #${context.id}] ${networkLevel ? 'NETWORK' : 'REQUEST'} ERROR `
      + `${context.method} ${context.endpoint}`,
      entry,
    );
  }

  finish(context) {
    this.active = Math.max(0, this.active - 1);
    if (this.enabled) {
      console.debug(
        `[HTTP DIAG #${context.id}] END ${context.method} ${context.endpoint}`,
        { active: this.active },
      );
    }
  }

  snapshot() {
    return {
      enabled: this.enabled,
      active: this.active,
      peakActive: this.peakActive,
      events: [...this.events],
    };
  }
}

export default new HttpDiagnostics();
