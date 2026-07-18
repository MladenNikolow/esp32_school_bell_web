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

## API scheduling and page loading

All API operations use a central scheduler with at most three active network
operations. Mutations are `critical`, visible page reads are `visible`, shared
editor data is `supporting`, and holiday checks are `background`. Identical
active GET requests share one network operation. A network-level GET failure is
retried once after a short jitter.

Settings loads `core`, then `access`; `maintenance` is lazy-loaded when the
Firmware/TLS area is within 600 px of the viewport. Schedule loads Today and
the shared Templates cache first, then enables the pending-holidays banner.
Dashboard polling runs only while the page is visible and does not overlap.

During hardware acceptance, the diagnostic snapshot must report
`peakActive <= 3`.
