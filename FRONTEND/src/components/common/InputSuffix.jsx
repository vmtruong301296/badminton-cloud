/** Đơn vị mờ nằm trong ô, bên phải (CurrencyInput / NumberInput prop suffix); ô bên trong chừa pr-8. */
export default function InputSuffix({ suffix, className = "", children }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400"
      >
        {suffix}
      </span>
    </div>
  );
}
