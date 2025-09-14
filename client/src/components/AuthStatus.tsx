import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export function AuthStatus() {
  const { isLoaded, isSignedIn } = useClerkAuth();

  if (!isLoaded) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Authentication is loading... If this takes more than 30 seconds, try refreshing the page.
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!isSignedIn) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please sign in to submit demos.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
