import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CircleAlert, Loader } from '../../components/ui/icons';

export default function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
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

	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
			<div className="w-full max-w-md">
				<div className="card sm:p-8">
					{/* Đầu thẻ */}
					<img src="/favicon.svg" alt="" className="h-12 w-12 mb-4" />
					<h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sổ cầu lông</h1>
					<p className="mt-1 text-sm font-medium text-slate-700">Chào mừng trở lại</p>
					<p className="mt-1 text-sm text-slate-500">
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
								required
								className="field-input"
								placeholder="Nhập email của bạn"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>

						<div>
							<label htmlFor="password" className="field-label">
								Mật khẩu
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								className="field-input"
								placeholder="Nhập mật khẩu"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
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

				<p className="mt-5 text-center text-sm text-slate-500">
					Hệ thống quản lý thanh toán cầu lông
				</p>
			</div>
		</div>
	);
}
