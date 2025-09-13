import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { useLocation } from "wouter";
import VideoCard from "@/components/VideoCard";
import Leaderboard from "@/components/Leaderboard";
import VideoPlayer from "@/components/VideoPlayer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Video, Coins, Users, Clock, TrendingUp, BarChart3, Hash, X } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [resetTimer, setResetTimer] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [leaderboardSortBy, setLeaderboardSortBy] = useState<'views' | 'favorites' | 'demo_clicks'>('views');

  const { data: topVideos = [] } = useQuery<any[]>({
    queryKey: ["/api/videos/top", selectedTag],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedTag) {
        params.append('tag', selectedTag);
      }
      const url = `/api/videos/top${params.toString() ? '?' + params.toString() : ''}`;
      return fetch(url).then(async res => {
        if (!res.ok) return [];
        return res.json();
      });
    },
  });

  const { data: allTags = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/tags"],
    queryFn: () => fetch('/api/tags').then(async r => (r.ok ? r.json() : [])),
  });

  const { data: stats } = useQuery<{
    totalViews: number;
    demosSubmitted: number;
    creditsEarned: number;
    activeUsers: number;
  }>({
    queryKey: ["/api/stats/today"],
    queryFn: () => fetch('/api/stats/today').then(async r => (r.ok ? r.json() : { totalViews:0, demosSubmitted:0, creditsEarned:0, activeUsers:0 })),
  });

  const { data: leaderboard = [] } = useQuery<any[]>({
    queryKey: ["/api/simple-leaderboard", leaderboardSortBy],
    queryFn: () => {
      // Temporarily use simple-leaderboard endpoint
      const url = `/api/simple-leaderboard`;
      return fetch(url).then(async res => (res.ok ? res.json() : []));
    },
  });

  // Update reset timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setResetTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
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
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Eye className="text-primary h-5 w-5" />
                </div>
                <div className="ml-4">
                  <p className="text-muted-foreground text-sm">Total Views Today</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.totalViews?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-accent/10 rounded-lg">
                  <Video className="text-accent h-5 w-5" />
                </div>
                <div className="ml-4">
                  <p className="text-muted-foreground text-sm">Demos Submitted</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.demosSubmitted || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-orange-500/10 rounded-lg">
                  <Coins className="text-orange-500 h-5 w-5" />
                </div>
                <div className="ml-4">
                  <p className="text-muted-foreground text-sm">Credits Earned</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.creditsEarned?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Users className="text-purple-500 h-5 w-5" />
                </div>
                <div className="ml-4">
                  <p className="text-muted-foreground text-sm">Active Users</p>
                  <p className="text-2xl font-bold text-foreground">{stats?.activeUsers?.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Top Videos Grid */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-foreground">Today's Top Demos</h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Resets in:</span>
                <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {resetTimer}
                </span>
              </div>
            </div>
            
            {/* Tag Filtering */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground font-medium flex items-center">
                  <Hash className="h-3 w-3 mr-1" />
                  Filter by tags:
                </span>
                
                {selectedTag && (
                  <Badge 
                    className="bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
                    onClick={() => setSelectedTag(null)}
                    data-testid="active-tag-filter"
                  >
                    {selectedTag}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 8).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={selectedTag === tag.name ? "default" : "secondary"}
                      className={`cursor-pointer transition-colors ${
                        selectedTag === tag.name 
                          ? "bg-primary text-primary-foreground" 
                          : "hover:bg-primary/20"
                      }`}
                      onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                      data-testid={`filter-tag-${tag.name}`}
                    >
                      <Hash className="w-2.5 h-2.5 mr-1" />
                      {tag.name}
                    </Badge>
                  ))}
                  
                  {allTags.length === 0 && (
                    <span className="text-sm text-muted-foreground italic">No tags available yet</span>
                  )}
                </div>
              </div>
              
              {selectedTag && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing videos tagged with "<strong>{selectedTag}</strong>". {topVideos.length} video{topVideos.length !== 1 ? 's' : ''} found.
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" data-testid="videos-grid">
              {topVideos.map((video: any, index: number) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  position={index + 1}
                  onPlay={() => setSelectedVideo(video)}
                  onTagClick={(tagName) => setSelectedTag(tagName)}
                />
              ))}
            </div>

            {topVideos.length === 0 && (
              <div className="text-center py-12">
                <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No videos available today. Be the first to submit!</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Leaderboard 
              items={leaderboard} 
              sortBy={leaderboardSortBy}
              onSortChange={setLeaderboardSortBy}
            />
            
            {/* User Progress Card */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                  <TrendingUp className="text-primary mr-2 h-5 w-5" />
                  Quick Actions
                </h3>
                
                <div className="space-y-3">
                  <Button 
                    className="w-full bg-primary text-primary-foreground" 
                    onClick={() => navigate('/dashboard')}
                    data-testid="button-dashboard"
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Dashboard
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => navigate('/submit-demo')}
                    data-testid="button-submit"
                  >
                    <Video className="mr-2 h-4 w-4" />
                    Submit Demo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
