import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Rocket, 
  Trophy, 
  BarChart3, 
  Upload, 
  Coins,
  User,
  LogOut
} from "lucide-react";
import { useLocation } from "wouter";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navItems = [
    { href: "/", label: "Leaderboard", icon: Trophy, active: location === "/" },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, active: location === "/dashboard" },
    { href: "/submit", label: "Submit Demo", icon: Upload, active: location === "/submit" },
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
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  variant={item.active ? "default" : "ghost"}
                  className={item.active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}
                  onClick={() => window.location.href = item.href}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* User Credits Display */}
            <div className="hidden sm:flex items-center bg-card rounded-lg px-3 py-2 border border-border">
              <Coins className="text-accent mr-2 h-4 w-4" />
              <span className="text-accent font-semibold" data-testid="text-user-credits">
                {user?.credits || 0}
              </span>
              <span className="text-muted-foreground ml-1">credits</span>
            </div>
            
            {/* User Profile */}
            <div className="flex items-center space-x-3">
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
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
