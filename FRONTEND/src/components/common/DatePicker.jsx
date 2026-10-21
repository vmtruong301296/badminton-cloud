export default function DatePicker({ value, onChange, className = '', ...props }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={`px-3 py-2 border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 ${className}`}
      {...props}
    />
  );
}

