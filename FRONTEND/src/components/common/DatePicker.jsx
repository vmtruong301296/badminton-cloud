/** Style mặc định. Màn nào dùng bộ class khác (vd field-input) thì truyền baseClassName để thay hẳn, đừng dồn vào className. */
const DEFAULT_BASE_CLASS =
  'px-3 py-2 border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20';

export default function DatePicker({ value, onChange, className = '', baseClassName = DEFAULT_BASE_CLASS, ...props }) {
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={`${baseClassName} ${className}`}
      {...props}
    />
  );
}

