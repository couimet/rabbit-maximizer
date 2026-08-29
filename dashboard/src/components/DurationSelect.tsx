import { type Duration, DURATION_OPTIONS } from '../../../src/utils/index.js';

interface DurationSelectProps {
  value: Duration;
  onChange: (duration: Duration) => void;
  'aria-label': string;
}

const DurationSelect = ({ value, onChange, 'aria-label': ariaLabel }: DurationSelectProps) => (
  <select className="duration-select" value={value} onChange={(e) => onChange(e.target.value as Duration)} aria-label={ariaLabel}>
    {DURATION_OPTIONS.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export default DurationSelect;
