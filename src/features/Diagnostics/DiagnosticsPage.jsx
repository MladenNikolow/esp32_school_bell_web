import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useLocale from '../../hooks/useLocale.jsx';
import {
  fetchDiagnostics,
  clearDiagnostics,
  clearErrors,
} from './DiagnosticsSlice.js';

const POLL_MS = 10000;

const SEV_INFO = 0;
const SEV_DEGRADED = 1;
const SEV_CRITICAL = 2;

function sevClass(sev) {
  if (sev === SEV_CRITICAL) return 'diag-sev critical';
  if (sev === SEV_DEGRADED) return 'diag-sev degraded';
  return 'diag-sev info';
}

function formatUptime(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '0s';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d && !h) parts.push(`${s}s`);
  return parts.join(' ');
}

function formatTs(ev) {
  // ts is epoch seconds; 0 means no wall clock at the time
  if (ev.ts && ev.ts > 1577836800) {
    const d = new Date(ev.ts * 1000);
    return d.toLocaleString();
  }
  return `+${ev.up}s`;
}

const RESET_REASONS = {
  0: 'unknown',
  1: 'power_on',
  2: 'external',
  3: 'software',
  4: 'panic',
  5: 'int_wdt',
  6: 'task_wdt',
  7: 'wdt',
  8: 'deepsleep',
  9: 'brownout',
  10: 'sdio',
};

export default function DiagnosticsPage() {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const role = useSelector((s) => s.auth?.user?.role);
  const {
    health, events, bootId, uptimeSec,
    loading, refreshing, clearing, error, clearError, lastFetchAt,
  } = useSelector((s) => s.diagnostics);

  const [showConfirmClear, setShowConfirmClear] = useState(false);
  /* Tick once a second so the "Updated N s ago" label stays live. */
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* Initial fetch + polling */
  useEffect(() => {
    const p = dispatch(fetchDiagnostics());
    const id = setInterval(() => dispatch(fetchDiagnostics()), POLL_MS);
    return () => {
      clearInterval(id);
      p.abort?.();
    };
  }, [dispatch]);

  const onClear = useCallback(async () => {
    setShowConfirmClear(false);
    await dispatch(clearDiagnostics());
  }, [dispatch]);

  const overall = useMemo(() => {
    if (!health) return { key: 'unknown', cls: 'unknown' };
    if (health.critical) return { key: 'critical', cls: 'critical' };
    if (health.degraded) return { key: 'degraded', cls: 'degraded' };
    return { key: 'ok', cls: 'ok' };
  }, [health]);

  const isServiceRole = role === 'service';

  const updatedAgoSec = lastFetchAt
    ? Math.max(0, Math.floor((Date.now() - lastFetchAt) / 1000))
    : null;

  return (
    <div className="diagnostics-page">
      <div className="diag-header">
        <div className={`diag-health-badge ${overall.cls}`}>
          <span className="diag-health-dot" />
          <div className="diag-health-text">
            <div className="diag-health-title">{t(`diag.health.${overall.key}`)}</div>
            <div className="diag-health-sub">
              {t('diag.boot')} {bootId} · {t('diag.uptime')} {formatUptime(uptimeSec)}
            </div>
          </div>
        </div>

        <div className="diag-actions">
          <div
            className={`diag-live ${refreshing ? 'is-refreshing' : ''}`}
            title={t('diag.autoRefreshTitle')}
          >
            <span className="diag-live-dot" />
            <span className="diag-live-text">
              {refreshing
                ? t('diag.refreshing')
                : updatedAgoSec === null
                  ? t('diag.loading')
                  : t('diag.updatedAgo', { sec: updatedAgoSec })}
            </span>
          </div>
          <button
            className="diag-btn danger"
            onClick={() => setShowConfirmClear(true)}
            disabled={clearing || !health || (events?.length ?? 0) === 0 || !isServiceRole}
            title={!isServiceRole ? t('diag.clearRoleHint') : ''}
          >
            {clearing ? t('diag.clearing') : t('diag.clear')}
          </button>
        </div>
      </div>

      {error && (
        <div className="diag-banner error">
          {error}
          <button className="diag-banner-dismiss" onClick={() => dispatch(clearErrors())}>×</button>
        </div>
      )}
      {clearError && (
        <div className="diag-banner error">
          {clearError}
          <button className="diag-banner-dismiss" onClick={() => dispatch(clearErrors())}>×</button>
        </div>
      )}

      {/* Subsystems grid */}
      {health && (
        <section className="diag-card">
          <h3 className="diag-card-title">{t('diag.subsystems')}</h3>
          <div className="diag-subsys-grid">
            <SubsysTile
              label={t('diag.wifi')}
              ok={health.wifiConnected}
              okText={t('diag.connected')}
              badText={t('diag.disconnected')}
            />
            <SubsysTile
              label={t('diag.time')}
              ok={health.timeReliable}
              warn={!health.timeSyncFresh && health.timeReliable}
              okText={health.timeSyncFresh ? t('diag.fresh') : t('diag.stale')}
              badText={t('diag.never')}
            />
            <SubsysTile
              label={t('diag.bellHw')}
              ok={health.bellHardwarePresent}
              okText={t('diag.present')}
              badText={t('diag.absent')}
            />
            <SubsysTile
              label={t('diag.panic')}
              ok={!health.panicMode}
              warn={health.panicMode}
              okText={t('diag.off')}
              badText={t('diag.on')}
            />
          </div>

          <div className="diag-meta">
            <MetaRow
              label={t('diag.bellFailures')}
              value={String(health.consecutiveBellFailures ?? 0)}
              danger={(health.consecutiveBellFailures ?? 0) > 0}
            />
            <MetaRow
              label={t('diag.lastRing')}
              value={
                health.lastBellAttemptTime > 0
                  ? new Date(health.lastBellAttemptTime * 1000).toLocaleString()
                  : t('diag.neverRung')
              }
            />
            <MetaRow
              label={t('diag.resetReason')}
              value={RESET_REASONS[health.resetReason] ?? String(health.resetReason)}
            />
            <MetaRow
              label={t('diag.events')}
              value={String(health.eventCount ?? 0)}
            />
          </div>
        </section>
      )}

      {/* Events list */}
      <section className="diag-card">
        <h3 className="diag-card-title">
          {t('diag.recentEvents')}
          {events?.length ? <span className="diag-card-count"> ({events.length})</span> : null}
        </h3>

        {loading && !health && (
          <div className="diag-empty">{t('diag.loading')}</div>
        )}

        {!loading && events?.length === 0 && (
          <div className="diag-empty">{t('diag.noEvents')}</div>
        )}

        {events?.length > 0 && (
          <ul className="diag-events">
            {events.map((ev, i) => (
              <li key={`${ev.boot}-${ev.up}-${i}`} className={sevClass(ev.sev)}>
                <div className="diag-event-row1">
                  <span className="diag-event-code">{ev.codeName || `code_${ev.code}`}</span>
                  <span className="diag-event-sev">{ev.sevName || t(`diag.sev.${ev.sev}`)}</span>
                </div>
                <div className="diag-event-row2">
                  <span className="diag-event-when">{formatTs(ev)}</span>
                  <span className="diag-event-boot">#{ev.boot}</span>
                  {ev.ctx !== 0 && <span className="diag-event-ctx">ctx={ev.ctx}</span>}
                </div>
                {ev.det && <div className="diag-event-detail">{ev.det}</div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Confirm clear modal */}
      {showConfirmClear && (
        <div className="diag-modal-backdrop" onClick={() => setShowConfirmClear(false)}>
          <div className="diag-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('diag.clearConfirmTitle')}</h3>
            <p>{t('diag.clearConfirmBody')}</p>
            <div className="diag-modal-actions">
              <button className="diag-btn" onClick={() => setShowConfirmClear(false)}>
                {t('diag.cancel')}
              </button>
              <button className="diag-btn danger" onClick={onClear}>
                {t('diag.clear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubsysTile({ label, ok, warn, okText, badText }) {
  const cls = ok ? 'ok' : warn ? 'warn' : 'bad';
  return (
    <div className={`diag-subsys-tile ${cls}`}>
      <span className="diag-subsys-dot" />
      <div className="diag-subsys-text">
        <div className="diag-subsys-label">{label}</div>
        <div className="diag-subsys-value">{ok ? okText : badText}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, danger }) {
  return (
    <div className={`diag-meta-row${danger ? ' danger' : ''}`}>
      <span className="diag-meta-label">{label}</span>
      <span className="diag-meta-value">{value}</span>
    </div>
  );
}
