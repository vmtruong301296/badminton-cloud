import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    setAuthError(false);
    try {
      const response = await authApi.me();
      setUser(response.data);
    } catch (error) {
      setUser(null);
      // No response = network error or timeout (backend slow/unreachable).
      // A real 401 (server responded) just means "not logged in", which is
      // handled normally by redirecting to the login screen.
      if (!error.response) {
        setAuthError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.errors?.email?.[0] ||
        "Đăng nhập thất bại";
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      return { success: true }; // Still clear user even if API call fails
    }
  };

  const hasPermission = (permissionName) => {
    if (!user) return false;

    // Check if user has the permission through any of their roles
    return (
      user.roles?.some((role) =>
        role.permissions?.some(
          (permission) => permission.name === permissionName,
        ),
      ) || false
    );
  };

  const hasAnyPermission = (permissionNames) => {
    if (!user) return false;
    return permissionNames.some((permissionName) =>
      hasPermission(permissionName),
    );
  };

  const hasRole = (roleName) => {
    if (!user) return false;
    return user.roles?.some((role) => role.name === roleName) || false;
  };

  const value = {
    user,
    loading,
    authError,
    login,
    logout,
    checkAuth,
    hasPermission,
    hasAnyPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
