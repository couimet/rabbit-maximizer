import { useErrorContext } from '../context/index.js';

import './GlobalErrorBanner.css';

export const GlobalErrorBanner = () => {
  const { errors, dismissError } = useErrorContext();

  if (errors.length === 0) return null;

  return (
    <div className="global-error-banner" role="alert">
      {errors.map((err) => (
        <div key={err.id} className="global-error-banner-item">
          <span className="global-error-banner-icon" aria-hidden="true">
            ⚠️
          </span>
          <span className="global-error-banner-message">{err.message}</span>
          <button className="global-error-banner-dismiss" onClick={() => dismissError(err.id)} aria-label={`Dismiss error`}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
