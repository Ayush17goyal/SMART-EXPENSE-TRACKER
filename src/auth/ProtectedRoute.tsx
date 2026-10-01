import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth(),
    location = useLocation();
  if (isLoading)
    return (
      <div className="auth-loading" role="status">
        <span className="auth-spinner" />
        <h1>Securing your workspace…</h1>
        <p>Restoring your session safely.</p>
      </div>
    );
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="auth-loading" role="status">
        <span className="auth-spinner" />
        <p>Checking your session…</p>
      </div>
    );
  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <>{children}</>
  );
}
