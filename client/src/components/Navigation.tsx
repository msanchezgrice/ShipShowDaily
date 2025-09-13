import { useAuth } from "@/hooks/useAuth";
import { useClerk, SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
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
  const { user } = useAuth();
  const { signOut } = useClerk();
  const [location, navigate] = useLocation();

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
                        variant={item.active ? "default" : "ghost"}
                        className={item.active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}
                        onClick={() => navigate(item.href)}
                        data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {item.label}
                      </Button>
                    </SignedIn>
                  );
                }
                return (
                  <Button
                    key={item.href}
                    variant={item.active ? "default" : "ghost"}
                    className={item.active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}
                    onClick={() => navigate(item.href)}
                    data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <SignedOut>
              <SignInButton mode="modal" afterSignInUrl="/dashboard">
                <Button className="bg-primary text-primary-foreground">Sign In</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
            {/* User Credits Display with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="hidden sm:flex items-center bg-card rounded-lg px-3 py-2 border border-border cursor-pointer hover:bg-card/80 transition-colors"
                    onClick={() => navigate('/dashboard')}
                    data-testid="credits-display"
                  >
                    <Coins className="text-accent mr-2 h-4 w-4" />
                    <span className="text-accent font-semibold" data-testid="text-user-credits">
                      {user?.credits || 0}
                    </span>
                    <span className="text-muted-foreground ml-1">credits</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-2">Ways to get credits:</p>
                  <ul className="text-sm space-y-1">
                    <li>• Watch demos for 30+ seconds</li>
                    <li>• Purchase credit packages</li>
                    <li>• Submit popular videos</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">Click to manage credits</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* User Profile with Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
                  data-testid="user-profile"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col">
                    <span className="text-foreground font-medium text-sm" data-testid="text-user-name">
                      {user?.firstName || user?.email || "User"}
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
