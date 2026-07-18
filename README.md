# esp32_school_bell_web

## HTTP diagnostics

Enable detailed request tracing by opening:

```text
https://ringy.local/?httpDebug=1
```

Alternatively, run `window.__ringyHttpDiagnostics.enable()` in DevTools and
reload. The trace contains request IDs, endpoint paths, duration, HTTP status,
active-request count, and peak concurrency. Network errors are always logged.
Request and response bodies, headers, cookies, credentials, and query
parameters are never recorded.

Useful DevTools commands:

```js
window.__ringyHttpDiagnostics.snapshot()
window.__ringyHttpDiagnostics.clear()
window.__ringyHttpDiagnostics.disable()
```
