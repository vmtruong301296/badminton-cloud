import { Minus, Plus } from '../ui/icons';
import { canStep, stepNumber } from '../../utils/numberStep';
import InputSuffix from './InputSuffix';
import selectAllOnFocus from './selectAllOnFocus';

/** Style mặc định. Màn nào dùng bộ class khác (vd field-input) thì truyền baseClassName để thay hẳn, đừng dồn vào className. */
const DEFAULT_BASE_CLASS =
  'px-3 py-2 border border-slate-300 rounded-xl focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20';

const STEP_BUTTON_CLASS =
  'flex w-11 flex-none items-center justify-center text-slate-700 active:bg-slate-100 disabled:text-slate-300 disabled:active:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 sm:w-10';

// Nút −/+ không lấy focus: bàn phím đang mở không sập, ô chưa mở thì không bật bàn phím.
const keepFocus = (e) => e.preventDefault();

/**
 * Ô số. Tùy chọn (M17, mặc định giữ hành vi cũ):
 * - stepper: nút −/+ 44 px hai bên (số nguyên nhỏ: số ngày, số bảng, level); decrementLabel /
 *   incrementLabel là aria-label (vd "Bớt 1 ngày" / "Thêm 1 ngày"). Khung viền nằm ở wrapper:
 *   độ rộng truyền qua wrapperClassName.
 * - selectOnFocus: chạm vào ô là bôi đen cả số, gõ đè luôn.
 * - suffix: đơn vị mờ trong ô bên phải (vd "L/100km"), aria-hidden — nhãn vẫn phải ghi đơn vị.
 */
export default function NumberInput({ value, onChange, min, max, step = 1, placeholder = '', className = '', baseClassName = DEFAULT_BASE_CLASS, stepper = false, decrementLabel = 'Bớt 1', incrementLabel = 'Thêm 1', selectOnFocus = false, suffix, wrapperClassName = '', onFocus, ...props }) {
  const handleFocus = (e) => {
    if (selectOnFocus) selectAllOnFocus(e);
    onFocus?.(e);
  };

  const handleChange = (e) => {
    const numValue = parseFloat(e.target.value) || 0;
    let finalValue = numValue;
    
    if (min !== undefined && numValue < min) finalValue = min;
    if (max !== undefined && numValue > max) finalValue = max;
    
    onChange?.(finalValue);
  };

  if (stepper) {
    const stepTo = (direction) => onChange?.(stepNumber(value, direction, { step, min, max }));
    return (
      <div className={`flex h-11 items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20 sm:h-10 ${wrapperClassName}`}>
        <button
          type="button"
          aria-label={decrementLabel}
          onMouseDown={keepFocus}
          onClick={() => stepTo(-1)}
          disabled={props.disabled || !canStep(value, -1, { min, max })}
          className={`${STEP_BUTTON_CLASS} border-r border-slate-200`}
        >
          <Minus className="h-5 w-5" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={handleChange}
          onFocus={handleFocus}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={`min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-base font-semibold text-slate-900 [appearance:textfield] focus:outline-none sm:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
          {...props}
        />
        <button
          type="button"
          aria-label={incrementLabel}
          onMouseDown={keepFocus}
          onClick={() => stepTo(1)}
          disabled={props.disabled || !canStep(value, 1, { min, max })}
          className={`${STEP_BUTTON_CLASS} border-l border-slate-200`}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    );
  }

  const input = (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      onChange={handleChange}
      onFocus={handleFocus}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      className={`${baseClassName} ${className}${suffix ? ' pr-8' : ''}`}
      {...props}
    />
  );

  if (!suffix) return input;
  return <InputSuffix suffix={suffix} className={wrapperClassName}>{input}</InputSuffix>;
}

