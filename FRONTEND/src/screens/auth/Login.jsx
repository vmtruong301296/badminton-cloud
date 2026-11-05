import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CircleAlert, Eye, EyeOff, Loader } from '../../components/ui/icons';

// Nét vẽ sân cầu lông đúng tỉ lệ (13,4 × 6,1 m: biên dọc / đôi, vạch giao cầu ngắn / dài, lưới).
function CourtLines() {
	return (
		<svg viewBox="0 0 390 236" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
			<g fill="none" stroke="#fff" strokeOpacity=".24" strokeWidth="2">
				<rect x="1" y="29" width="388" height="177" />
				<line x1="1" y1="42.3" x2="389" y2="42.3" />
				<line x1="1" y1="192.7" x2="389" y2="192.7" />
				<line x1="137.6" y1="29" x2="137.6" y2="206" />
				<line x1="252.4" y1="29" x2="252.4" y2="206" />
				<line x1="23" y1="29" x2="23" y2="206" />
				<line x1="367" y1="29" x2="367" y2="206" />
				<line x1="1" y1="117.5" x2="137.6" y2="117.5" />
				<line x1="252.4" y1="117.5" x2="389" y2="117.5" />
				<line x1="195" y1="14" x2="195" y2="221" strokeWidth="3" strokeDasharray="2 4" strokeOpacity=".4" />
			</g>
		</svg>
	);
}

export default function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const passwordRef = useRef(null);
	const { login } = useAuth();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);

		try {
			const result = await login(email, password);
			if (result.success) {
				navigate('/');
			} else {
				setError(result.message || 'Đăng nhập thất bại');
			}
		} catch {
			setError('Có lỗi xảy ra khi đăng nhập');
		} finally {
			setLoading(false);
		}
	};

	// Phím "Tiếp" ở ô email chuyển sang ô mật khẩu thay vì gửi form.
	const handleEmailKeyDown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			passwordRef.current?.focus();
		}
	};

	// Điện thoại: dải sân cầu lông + form bám đỉnh trên nền trắng; desktop (sm:) giữ thẻ giữa màn.
	return (
		<div className="flex min-h-screen flex-col bg-white sm:items-center sm:justify-center sm:bg-slate-50 sm:px-4 sm:py-10">
			<div
				aria-hidden="true"
				className="relative h-[calc(120px+env(safe-area-inset-top))] flex-none overflow-hidden bg-emerald-700 min-[375px]:h-[calc(132px+env(safe-area-inset-top))] min-[420px]:h-[calc(148px+env(safe-area-inset-top))] sm:hidden">
				<CourtLines />
			</div>
			<div className="w-full px-4 sm:max-w-md sm:px-0">
				<div className="sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-8 sm:shadow-card">
					{/* Đầu thẻ */}
					<img
						src="/favicon.svg"
						alt=""
						className="relative -mt-8 h-16 w-16 rounded-[17px] shadow-[0_0_0_4px_#fff,0_10px_20px_-8px_rgba(4,120,87,0.55)] sm:mb-4 sm:mt-0 sm:h-12 sm:w-12 sm:rounded-none sm:shadow-none"
					/>
					<h1 className="mt-3.5 text-[28px] font-bold leading-[34px] tracking-tight text-slate-900 sm:mt-0 sm:text-2xl sm:font-semibold">
						Sổ cầu lông
					</h1>
					<p className="mt-0.5 text-[15px] font-medium text-slate-700 sm:mt-1 sm:text-sm">Chào mừng trở lại</p>
					<p className="mt-0.5 text-sm text-slate-500 sm:mt-1">
						Chia tiền buổi chơi, bill tiệc và thuê xe cho nhóm cầu lông.
					</p>

					<form className="mt-6 space-y-5" onSubmit={handleSubmit}>
						{error && (
							<div
								role="alert"
								className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
								<CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
								<span>{error}</span>
							</div>
						)}

						<div>
							<label htmlFor="email" className="field-label">
								Email
							</label>
							<input
								id="email"
								name="email"
								type="email"
								inputMode="email"
								autoComplete="username"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								enterKeyHint="next"
								required
								className="field-input"
								placeholder="Nhập email của bạn"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								onKeyDown={handleEmailKeyDown}
							/>
						</div>

						<div>
							<label htmlFor="password" className="field-label">
								Mật khẩu
							</label>
							<div className="relative">
								<input
									ref={passwordRef}
									id="password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									autoComplete="current-password"
									enterKeyHint="go"
									required
									className="field-input pr-11"
									placeholder="Nhập mật khẩu"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
								<button
									type="button"
									onClick={() => setShowPassword((value) => !value)}
									aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
									aria-pressed={showPassword}
									className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 sm:w-10">
									{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
								</button>
							</div>
						</div>

						<button type="submit" disabled={loading} className="btn btn-primary w-full">
							{loading ? (
								<>
									<Loader className="h-4 w-4 animate-spin" />
									Đang đăng nhập...
								</>
							) : (
								'Đăng nhập'
							)}
						</button>
					</form>
				</div>
			</div>

			<p className="mt-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-8 text-center text-sm text-slate-500 sm:mt-5 sm:p-0">
				Hệ thống quản lý thanh toán cầu lông
			</p>
		</div>
	);
}
