import React from 'react';

/**
 * Ringy logo – renders the PNG brand image.
 * Props:
 *   height  – CSS height (default "48px")
 *   onClick – optional click handler (e.g. navigate to dashboard)
 */
export default function RingyLogo({ height = '48px', onClick }) {
  return (
    <img
      src="/Ringy_Logo_NoBackground.png"
      alt="Ringy Smart School Bell"
      className={`logo-img${onClick ? ' logo-img--clickable' : ''}`}
      style={{ height, width: 'auto', display: 'block' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    />
  );
}
