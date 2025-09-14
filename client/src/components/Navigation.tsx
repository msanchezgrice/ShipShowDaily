import { useAuth } from "@/hooks/useAuth";
import { useClerk, SignedIn, SignedOut, SignInButton, useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  Rocket, 
  Trophy, 
  BarChart3, 
  Upload, 
  Coins,
  User,
  Film,
  LogOut,
  Settings
} from "lucide-react";
import { useLocation } from "wouter";

export default function Navigation() {
  // Use Clerk's useUser hook directly for user info to avoid context issues
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const [location, navigate] = useLocation();
  
  // Use the custom useAuth hook only for app-specific data like credits
  let appUserData = null;
  try {
    const authData = useAuth();
    appUserData = authData?.user;
  } catch (error) {
    console.warn("Failed to get user data:", error);
  }

  const handleSignOut = () => {
    signOut();
  };


  const navItems = [
    { href: "/", label: "Leaderboard", icon: Trophy, active: location === "/", requiresAuth: false },
    { href: "/feed", label: "Feed", icon: Film, active: location === "/feed", requiresAuth: false },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, active: location === "/dashboard", requiresAuth: true },
    { href: "/submit-demo", label: "Submit Demo", icon: Upload, active: location === "/submit-demo", requiresAuth: true },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Rocket className="text-primary text-2xl mr-3" />
              <span className="text-xl font-bold text-foreground">ShipShow.io</span>
            </div>
            <div className="hidden md:flex items-center space-x-1 ml-8">
              {navItems.map((item) => {
                // Show all items for non-auth routes, only show auth routes when signed in
                if (item.requiresAuth) {
                  return (
                    <SignedIn key={item.href}>
                      <Button
                        variant={item.active ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => navigate(item.href)}
                        className="flex items-center space-x-2"
                        data-testid={`button-nav-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Button>
                    </SignedIn>
                  );
                }
                
                return (
                  <Button
                    key={item.href}
                    variant={item.active ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => navigate(item.href)}
                    className="flex items-center space-x-2"
                    data-testid={`button-nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <SignedIn>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 cursor-help"
                      data-testid="credits-display"
                    >
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-primary">
                        {appUserData?.credits ?? 0}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Available Credits</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </SignedIn>
            
            <SignedOut>
              <SignInButton mode="modal">
                <Button 
                  variant="outline" 
                  className="border-primary text-primary hover:bg-primary/10"
                  data-testid="button-sign-in"
                >
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            
            <SignedIn>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                  data-testid="user-profile"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={clerkUser?.imageUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-foreground font-medium text-sm" data-testid="text-user-name">
                      {clerkUser?.firstName || clerkUser?.primaryEmailAddress?.emailAddress || "User"}
                    </span>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => navigate('/settings')}
                  data-testid="button-settings"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  data-testid="button-sign-out"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}