import { useConvexAuth } from "convex/react";
import { useUser } from "@clerk/clerk-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  fallback,
}: ProtectedRouteProps) {
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const { user, isLoaded, isSignedIn } = useUser();

  // Use Clerk's authentication state as primary
  const userIsAuthenticated = isSignedIn && user;

  // Show loading while auth is being determined
  if (authIsLoading || !isLoaded) {
    return (
      <div className="brutal-card text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800 mx-auto mb-4"></div>
        <p style={{ color: "var(--text-secondary)" }}>
          Loading authentication...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!userIsAuthenticated) {
    return (
      fallback || (
        <div className="brutal-card text-center">
          <h2 className="brutal-text-lg mb-4">Authentication Required</h2>
          <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
            Please sign in to access this section.
          </p>
        </div>
      )
    );
  }

  // Check admin role if required
  if (requireAdmin) {
    const userRole = user.publicMetadata?.role;
    if (userRole !== "admin") {
      return (
        fallback || (
          <div className="brutal-card text-center">
            <h2 className="brutal-text-lg mb-4">Access Denied</h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Admin privileges required to access this section.
            </p>
          </div>
        )
      );
    }
  }

  return <>{children}</>;
}
