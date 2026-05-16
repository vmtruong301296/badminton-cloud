import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./screens/auth/Login";
import Dashboard from "./screens/dashboard/Dashboard";
import PlayersManagement from "./screens/players/PlayersManagement";
import MasterManagement from "./screens/master/MasterManagement";
import CreateBill from "./screens/bills/CreateBill";
import BillDetail from "./screens/bills/BillDetail";
import EditBill from "./screens/bills/EditBill";
import RolesManagement from "./screens/roles/RolesManagement";
import PartyBills from "./screens/party/PartyBills";
import CreatePartyBill from "./screens/party/CreatePartyBill";
import EditPartyBill from "./screens/party/EditPartyBill";
import PartyBillDetail from "./screens/party/PartyBillDetail";
import TournamentBrackets from "./screens/tournament/TournamentBrackets";

function HomeRedirect() {
  const { hasPermission } = useAuth();

  if (hasPermission("bills.view")) {
    return <Dashboard />;
  }

  if (hasPermission("tournament_brackets.view")) {
    return <TournamentBrackets />;
  }

  if (hasPermission("party_bills.view")) {
    return <PartyBills />;
  }

  // Fallback: no relevant permission
  return (
    <div className="p-6 text-center text-gray-600">
      Bạn chưa được cấp quyền truy cập bất kỳ chức năng nào.
    </div>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Đang tải...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

// Component to check if user has any master permission
function MasterRouteGuard({ children }) {
  const { hasPermission } = useAuth();
  const hasAnyMasterPermission =
    hasPermission("ratios.view") ||
    hasPermission("menus.view") ||
    hasPermission("shuttles.view") ||
    hasPermission("payment_accounts.view");

  if (!hasAnyMasterPermission) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <HomeRedirect />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/players"
        element={
          <ProtectedRoute requiredPermission="users.view">
            <Layout>
              <PlayersManagement />
            </Layout>
          </ProtectedRoute>
        }
      />
      {/* Master Management Route */}
      <Route
        path="/master"
        element={
          <ProtectedRoute>
            <MasterRouteGuard>
              <Layout>
                <MasterManagement />
              </Layout>
            </MasterRouteGuard>
          </ProtectedRoute>
        }
      />
      {/* Redirect old routes to master with appropriate tab */}
      <Route
        path="/ratios"
        element={<Navigate to="/master?tab=ratios" replace />}
      />
      <Route
        path="/menus"
        element={<Navigate to="/master?tab=menus" replace />}
      />
      <Route
        path="/shuttles"
        element={<Navigate to="/master?tab=shuttles" replace />}
      />
      <Route
        path="/payment-accounts"
        element={<Navigate to="/master?tab=payment-accounts" replace />}
      />
      <Route
        path="/bills/create"
        element={
          <ProtectedRoute requiredPermission="bills.create">
            <Layout>
              <CreateBill />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bills/:id/edit"
        element={
          <ProtectedRoute requiredPermission="bills.update">
            <Layout>
              <EditBill />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/party-bills"
        element={
          <ProtectedRoute requiredPermission="party_bills.view">
            <Layout>
              <PartyBills />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/party-bills/create"
        element={
          <ProtectedRoute requiredPermission="party_bills.create">
            <Layout>
              <CreatePartyBill />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/party-bills/:id/edit"
        element={
          <ProtectedRoute requiredPermission="party_bills.update">
            <Layout>
              <EditPartyBill />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/party-bills/:id"
        element={
          <ProtectedRoute requiredPermission="party_bills.view">
            <Layout>
              <PartyBillDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bills/:id"
        element={
          <ProtectedRoute requiredPermission="bills.view">
            <Layout>
              <BillDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute requiredPermission="roles.view">
            <Layout>
              <RolesManagement />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tournament-brackets"
        element={
          <ProtectedRoute requiredPermission="tournament_brackets.view">
            <Layout>
              <TournamentBrackets />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
