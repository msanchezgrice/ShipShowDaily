import { SignInButton } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Play, Upload, Eye, Trophy, Users, Coins } from "lucide-react";

export default function Landing() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Rocket className="text-primary text-2xl mr-3" />
              <span className="text-xl font-bold text-foreground">ShipShow.io</span>
            </div>
            <SignInButton mode="modal" afterSignInUrl="/">
              <Button className="bg-primary text-primary-foreground" data-testid="button-sign-in">
                Sign In
              </Button>
            </SignInButton>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Daily Demo Leaderboard
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-6 max-w-3xl mx-auto">
            Watch 30-second product demos, earn credits, and boost your own demos to the top. 
            Discover amazing products while building your audience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <SignInButton mode="modal" afterSignInUrl="/">
              <Button className="bg-primary text-primary-foreground px-8 py-3" data-testid="button-start-watching">
                <Play className="mr-2 h-4 w-4" />
                Start Watching Demos
              </Button>
            </SignInButton>
            <SignInButton mode="modal" afterSignInUrl="/submit-demo">
              <Button variant="outline" className="bg-accent text-accent-foreground px-8 py-3" data-testid="button-submit-demo">
                <Upload className="mr-2 h-4 w-4" />
                Submit Your Demo
              </Button>
            </SignInButton>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Watch & Earn</h3>
              <p className="text-muted-foreground">
                Watch 30-second product demos and earn 1 credit for each video you complete.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Submit Your Demo</h3>
              <p className="text-muted-foreground">
                Upload your product demo and get it in front of an engaged audience of builders.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Coins className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Boost Your Videos</h3>
              <p className="text-muted-foreground">
                Spend earned credits to boost your demos and get more visibility in the leaderboard.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Preview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">12K+</div>
            <div className="text-sm text-muted-foreground">Daily Views</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">500+</div>
            <div className="text-sm text-muted-foreground">Demo Videos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">2K+</div>
            <div className="text-sm text-muted-foreground">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">50K+</div>
            <div className="text-sm text-muted-foreground">Credits Earned</div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <SignInButton mode="modal" afterSignInUrl="/">
            <Button size="lg" className="bg-primary text-primary-foreground px-12 py-4 text-lg" data-testid="button-get-started">
              Get Started Now
            </Button>
          </SignInButton>
        </div>
      </div>
    </div>
  );
}
