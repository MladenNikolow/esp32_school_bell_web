import React, { useEffect, useState, useCallback } from 'react';
import ScheduleService from '../../../services/ScheduleService.js';
import useLocale from '../../../hooks/useLocale.jsx';
import HolidayImportDialog from './HolidayImportDialog.jsx';

/**
 * Renders nothing unless `/api/schedule/holidays/pending` returns content.
 * When present, shows a banner with Review / Dismiss actions.
 *
 * Props:
 *  - refreshKey (any): change this to force a re-poll (e.g. after dialog applies).
 */
export default function HolidayPendingBanner({ refreshKey }) {
  const { t } = useLocale();
  const [pending, setPending] = useState(null); // { year, fetchedAt, items }
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const poll = useCallback(async () => {
    try {
      const data = await ScheduleService.getPendingHolidays();
      // The service may return null/empty body on 204
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        setPending(data);
      } else {
        setPending(null);
      }
    } catch {
      setPending(null);
    }
  }, []);

  useEffect(() => { poll(); }, [poll, refreshKey]);

  const onReview = () => setDialogOpen(true);

  const onDismiss = async () => {
    setBusy(true);
    setError('');
    try {
      await ScheduleService.dismissPendingHolidays();
      setPending(null);
    } catch (e) {
      setError(e?.message || t('schedule.holidayImport.errDismiss'));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = (didApply) => {
    setDialogOpen(false);
    // Whether user applied or cancelled, re-poll to see if pending was cleared.
    poll();
    if (didApply) {
      // Allow parent (Schedule page) to refresh exceptions list via refreshKey trigger.
    }
  };

  if (!pending) return null;

  return (
    <>
      <div className="holiday-pending-banner">
        <div className="hpb-icon" aria-hidden="true">🎉</div>
        <div className="hpb-body">
          <div className="hpb-title">
            {t('schedule.holidayImport.bannerTitle', { year: pending.year })}
          </div>
          <div className="hpb-subtitle">
            {t('schedule.holidayImport.bannerSubtitle', {
              count: pending.items.length,
            })}
          </div>
          {error && <div className="error-message hpb-error">{error}</div>}
        </div>
        <div className="hpb-actions">
          <button
            type="button"
            className="save-button"
            onClick={onReview}
            disabled={busy}
          >
            {t('schedule.holidayImport.bannerReview')}
          </button>
          <button
            type="button"
            className="modal-cancel"
            onClick={onDismiss}
            disabled={busy}
          >
            {t('schedule.holidayImport.bannerDismiss')}
          </button>
        </div>
      </div>

      <HolidayImportDialog
        open={dialogOpen}
        preloaded={pending}
        onClose={handleClose}
      />
    </>
  );
}
