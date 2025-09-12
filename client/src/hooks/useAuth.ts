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
      queryKey: ["/api/auth/user"],
      enabled: isSignedIn && isLoaded,
      retry: false,
      queryFn: async () => {
        const token = await getToken();
        const response = await fetch("/api/auth/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
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
