import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Video, Eye, Calendar, Clock, TrendingUp, Award, ArrowLeft, Play, ExternalLink } from "lucide-react";
import { useUser } from "@clerk/clerk-react";

export default function Profile() {
  const [, params] = useRoute("/profile/:userId");
  const userId = params?.userId;
  const [, navigate] = useLocation();
  const { user: currentUser } = useUser();
  const isOwnProfile = currentUser?.id === userId;

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

  // Calculate stats
  const totalViews = userVideos.reduce((sum: number, video: any) => sum + (video.totalViews || 0), 0);
  const totalTodayViews = userVideos.reduce((sum: number, video: any) => sum + (video.todayViews || 0), 0);
  const averageViews = userVideos.length > 0 ? Math.round(totalViews / userVideos.length) : 0;

  if (userLoading || videosLoading) {
    return (
      <>
        <Navigation />
        <main className="container max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-300 rounded-lg mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

  return (
    <>
      <Navigation />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Profile Header */}
        <Card className="mb-8 bg-gradient-to-r from-primary/10 to-accent/10">
          <CardContent className="p-8">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {userName}
                  {isOwnProfile && (
                    <Badge variant="secondary" className="ml-3">Your Profile</Badge>
                  )}
                </h1>
                <p className="text-muted-foreground">
                  {userVideos.length} demo{userVideos.length !== 1 ? 's' : ''} shared
                </p>
              </div>
              {isOwnProfile && (
                <Button onClick={() => navigate("/submit-demo")}>
                  <Video className="mr-2 h-4 w-4" />
                  Upload New Demo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Views</p>
                  <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                </div>
                <Eye className="text-purple-500 h-8 w-8" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Today's Views</p>
                  <p className="text-2xl font-bold">{totalTodayViews.toLocaleString()}</p>
                </div>
                <TrendingUp className="text-green-500 h-8 w-8" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Average Views</p>
                  <p className="text-2xl font-bold">{averageViews.toLocaleString()}</p>
                </div>
                <Award className="text-yellow-500 h-8 w-8" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Demos Shared</p>
                  <p className="text-2xl font-bold">{userVideos.length}</p>
                </div>
                <Video className="text-primary h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Videos Grid */}
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
                  <div
                    key={video.id}
                    className="bg-secondary rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/watch/${video.id}`)}
                  >
                    {/* Video Thumbnail */}
                    <div className="relative aspect-video bg-primary/20 group">
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
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
                        {video.title}
                      </h3>
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
                          {video.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{video.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Eye className="mr-1 h-3 w-3" />
                          {video.totalViews || 0} views
                        </span>
                        <span className="flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          {video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>

                      {/* Product Link */}
                      {video.productUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-3"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(video.productUrl, '_blank');
                          }}
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          Visit Product
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}