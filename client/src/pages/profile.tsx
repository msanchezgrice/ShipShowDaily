import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Video, Eye, Calendar, TrendingUp, Award, ArrowLeft, Play, 
  ExternalLink, Heart, Share2, Clock, User, Settings
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId;
  const [, navigate] = useLocation();
  const { user: currentUser } = useUser();
  const isOwnProfile = currentUser?.id === userId;
  const [activeTab, setActiveTab] = useState("videos");

  // Fetch user details
  const { data: profileUser, isLoading: userLoading } = useQuery<any>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  // Fetch user's videos
  const { data: userVideos = [], isLoading: videosLoading } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/videos`],
    enabled: !!userId,
  });

  // Fetch user's favorites (only for own profile)
  const { data: userFavorites = [] } = useQuery<any[]>({
    queryKey: [`/api/users/${userId}/favorites`],
    enabled: !!userId && isOwnProfile,
  });

  // Calculate stats from videos
  const totalViews = userVideos.reduce((sum: number, video: any) => sum + (video.totalViews || 0), 0);
  const totalFavorites = userVideos.reduce((sum: number, video: any) => sum + (video.favorites || 0), 0);
  const totalShares = userVideos.reduce((sum: number, video: any) => sum + (video.shares || 0), 0);
  const totalDemoClicks = userVideos.reduce((sum: number, video: any) => sum + (video.demoClicks || 0), 0);

  if (userLoading || videosLoading) {
    return (
      <>
        <Navigation />
        <main className="container max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-300 rounded-lg mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-300 rounded-lg"></div>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  const userName = profileUser?.firstName && profileUser?.lastName
    ? `${profileUser.firstName} ${profileUser.lastName}`
    : profileUser?.email?.split('@')[0] || 'User';

  const userInitials = profileUser?.firstName && profileUser?.lastName
    ? `${profileUser.firstName[0]}${profileUser.lastName[0]}`
    : userName[0]?.toUpperCase() || '?';

  const memberSince = profileUser?.createdAt 
    ? new Date(profileUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown';

  return (
    <>
      <Navigation />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-primary/20">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-xl">
                {profileUser?.profileImageUrl ? (
                  <AvatarImage src={profileUser.profileImageUrl} alt={userName} />
                ) : null}
                <AvatarFallback className="text-2xl md:text-3xl font-bold bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    {userName}
                  </h1>
                  {isOwnProfile && (
                    <Badge variant="secondary" className="w-fit mx-auto md:mx-0">
                      <User className="mr-1 h-3 w-3" />
                      Your Profile
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mb-3">
                  <Calendar className="inline mr-1 h-4 w-4" />
                  Member since {memberSince}
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <Video className="mr-1 h-4 w-4 text-primary" />
                    {userVideos.length} demos
                  </span>
                  <span className="flex items-center">
                    <Eye className="mr-1 h-4 w-4 text-purple-500" />
                    {totalViews.toLocaleString()} views
                  </span>
                  <span className="flex items-center">
                    <Heart className="mr-1 h-4 w-4 text-red-500" />
                    {totalFavorites} favorites
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {isOwnProfile && (
                  <>
                    <Button variant="outline" onClick={() => navigate("/settings")}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Button>
                    <Button onClick={() => navigate("/submit-demo")}>
                      <Video className="mr-2 h-4 w-4" />
                      Upload Demo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm">Total Views</p>
                  <p className="text-xl md:text-2xl font-bold">{totalViews.toLocaleString()}</p>
                </div>
                <Eye className="text-purple-500 h-6 w-6 md:h-8 md:w-8" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm">Favorites</p>
                  <p className="text-xl md:text-2xl font-bold">{totalFavorites.toLocaleString()}</p>
                </div>
                <Heart className="text-red-500 h-6 w-6 md:h-8 md:w-8" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm">Demo Clicks</p>
                  <p className="text-xl md:text-2xl font-bold">{totalDemoClicks.toLocaleString()}</p>
                </div>
                <ExternalLink className="text-blue-500 h-6 w-6 md:h-8 md:w-8" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-xs md:text-sm">Shares</p>
                  <p className="text-xl md:text-2xl font-bold">{totalShares.toLocaleString()}</p>
                </div>
                <Share2 className="text-green-500 h-6 w-6 md:h-8 md:w-8" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Videos / Favorites */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="videos" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Demos ({userVideos.length})
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="favorites" className="flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Favorites ({userFavorites.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="videos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Video className="mr-2 h-5 w-5" />
                  {isOwnProfile ? 'My Demos' : `${userName}'s Demos`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userVideos.length === 0 ? (
                  <div className="text-center py-12">
                    <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {isOwnProfile ? "You haven't uploaded any demos yet" : "No demos uploaded yet"}
                    </p>
                    {isOwnProfile && (
                      <Button onClick={() => navigate("/submit-demo")}>
                        <Video className="mr-2 h-4 w-4" />
                        Upload Your First Demo
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userVideos.map((video: any) => (
                      <VideoCard key={video.id} video={video} navigate={navigate} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="favorites">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Heart className="mr-2 h-5 w-5" />
                    Favorited Demos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {userFavorites.length === 0 ? (
                    <div className="text-center py-12">
                      <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        You haven't favorited any demos yet
                      </p>
                      <Button onClick={() => navigate("/")}>
                        Browse Demos
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {userFavorites.map((video: any) => (
                        <VideoCard key={video.id} video={video} navigate={navigate} showCreator />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </>
  );
}

// Video Card Component
function VideoCard({ video, navigate, showCreator = false }: { 
  video: any; 
  navigate: (path: string) => void;
  showCreator?: boolean;
}) {
  const creatorName = video.creator?.firstName && video.creator?.lastName
    ? `${video.creator.firstName} ${video.creator.lastName}`
    : video.creator?.email?.split('@')[0] || 'Anonymous';

  return (
    <div
      className="bg-secondary rounded-lg overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer group"
      onClick={() => navigate(`/video/${video.slug || video.id}`)}
    >
      {/* Video Thumbnail */}
      <div className="relative aspect-video bg-primary/20">
        {video.thumbnailPath ? (
          <>
            <img
              src={video.thumbnailPath}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="text-white h-12 w-12" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="text-primary h-12 w-12" />
          </div>
        )}
        {video.status === 'processing' && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="bg-background/80 text-yellow-600">
              Processing
            </Badge>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground mb-1 line-clamp-2">
          {video.title}
        </h3>
        
        {showCreator && video.creator && (
          <p className="text-sm text-muted-foreground mb-2">
            by {creatorName}
          </p>
        )}

        {video.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {video.description}
          </p>
        )}

        {/* Tags */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {video.tags.slice(0, 3).map((tag: any) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center">
              <Eye className="mr-1 h-3 w-3" />
              {video.totalViews || 0}
            </span>
            <span className="flex items-center">
              <Heart className="mr-1 h-3 w-3" />
              {video.favorites || 0}
            </span>
          </div>
          <span className="flex items-center">
            <Calendar className="mr-1 h-3 w-3" />
            {video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
