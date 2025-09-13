import { useAuth as useClerkAuth, useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  credits: number;
  totalCreditsEarned: number;
  createdAt?: string;
  updatedAt?: string;
}

export function useAuth() {
  try {
    const { isSignedIn, isLoaded, getToken } = useClerkAuth();
    const { user: clerkUser } = useUser();

  // Fetch our app's user data (credits, etc.) when authenticated
  const { data: appUser, isLoading: isAppUserLoading } = useQuery<User>({
    queryKey: ["/api/auth/user-simple"],
    enabled: isSignedIn && isLoaded,
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }
      
      const response = await fetch("/api/auth/user-simple", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        // Special handling for authentication errors
        if (response.status === 401) {
          console.warn("Authentication token may be expired, retrying...");
          // Token might be expired, try to refresh it
          const newToken = await getToken({ skipCache: true });
          if (newToken && newToken !== token) {
            // Retry with new token
            const retryResponse = await fetch("/api/auth/user-simple", {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            });
            if (retryResponse.ok) {
              return retryResponse.json();
            }
          }
        }
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }
      return response.json();
    },
  });

    // Combine Clerk user data with our app's user data
    const user = isSignedIn && clerkUser && appUser ? {
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      profileImageUrl: clerkUser.imageUrl,
      credits: appUser.credits,
      totalCreditsEarned: appUser.totalCreditsEarned,
      createdAt: appUser.createdAt,
      updatedAt: appUser.updatedAt,
    } : null;

    return {
      user,
      isLoading: !isLoaded || (isSignedIn && isAppUserLoading),
      isAuthenticated: isSignedIn && !!user,
      getToken,
    };
  } catch (error) {
    // Fallback for when ClerkProvider is not available
    console.warn("Clerk not available, falling back to loading state:", error);
    return {
      user: null,
      isLoading: true,
      isAuthenticated: false,
      getToken: async () => null,
    };
  }
}
