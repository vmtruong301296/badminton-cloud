import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import StatusScreen from './ui/StatusScreen';
import { Lock, Loader } from './ui/icons';

export default function ProtectedRoute({ children, requiredPermission = null }) {
	const { user, loading, hasPermission } = useAuth();

	if (loading) {
		return <StatusScreen icon={Loader} spin title="Đang tải..." />;
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	if (requiredPermission && !hasPermission(requiredPermission)) {
		return (
			<StatusScreen
				icon={Lock}
				tone="rose"
				title="Không có quyền truy cập"
				description="Bạn không có quyền để truy cập trang này."
			/>
		);
	}

	return children;
}

