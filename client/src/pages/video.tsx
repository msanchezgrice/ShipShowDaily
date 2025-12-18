import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/Navigation";
import VideoPlayerEnhanced from "@/components/VideoPlayerEnhanced";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Eye, Heart, ExternalLink, Share2, Play, ArrowLeft, 
  Calendar, Clock, Hash, Copy, Check
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function VideoPage() {
  const [, params] = useRoute("/video/:id");
  const videoId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPlayer, setShowPlayer] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch video details with stats
  const { data: videoData, isLoading, refetch } = useQuery<any>({
    queryKey: [`/api/videos/${videoId}/details`],
    enabled: !!videoId,
  });

  // Update document title and meta tags for SEO
  useEffect(() => {
    if (videoData?.video) {
      const video = videoData.video;
      const creator = videoData.creator;
      const creatorName = creator?.firstName && creator?.lastName
        ? `${creator.firstName} ${creator.lastName}`
        : creator?.email?.split('@')[0] || 'Anonymous';
      
      document.title = `${video.title} | ShipShow`;
      
      // Update meta description
      const updateMeta = (selector: string, attr: string, value: string) => {
        let el = document.querySelector(selector);
        if (!el) {
          el = document.createElement('meta');
          if (selector.includes('property=')) {
            el.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] || '');
          } else if (selector.includes('name=')) {
            el.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] || '');
          }
          document.head.appendChild(el);
        }
        el.setAttribute(attr, value);
      };

      const description = video.description || `Watch ${video.title} on ShipShow`;
      const imageUrl = video.thumbnailPath || 'https://www.shipshow.io/og-image.png';
      const pageUrl = `https://www.shipshow.io/video/${video.id}`;

      updateMeta('meta[name="description"]', 'content', description);
      updateMeta('meta[property="og:title"]', 'content', `${video.title} | ShipShow`);
      updateMeta('meta[property="og:description"]', 'content', description);
      updateMeta('meta[property="og:image"]', 'content', imageUrl);
      updateMeta('meta[property="og:url"]', 'content', pageUrl);
      updateMeta('meta[property="og:type"]', 'content', 'video.other');
      updateMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
      updateMeta('meta[name="twitter:title"]', 'content', `${video.title} | ShipShow`);
      updateMeta('meta[name="twitter:description"]', 'content', description);
      updateMeta('meta[name="twitter:image"]', 'content', imageUrl);
      updateMeta('meta[name="author"]', 'content', creatorName);
    }
    return () => {
      document.title = 'ShipShow - Daily Demo Leaderboard';
    };
  }, [videoData]);

  // Share tracking mutation
  const shareMutation = useMutation({
    mutationFn: async (platform: string) => {
      return apiRequest("POST", `/api/videos/${videoId}/share`, { platform });
    },
  });

  // Favorite mutation
  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/videos/${videoId}/favorite`);
      return res.json();
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: data?.favorited ? "Added to favorites" : "Removed from favorites",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update favorite",
        variant: "destructive",
      });
    },
  });

  const handleShare = async (platform: string) => {
    const shareUrl = `${window.location.origin}/video/${videoId}`;
    const shareText = `Check out "${videoData?.video?.title}" on ShipShow!`;

    shareMutation.mutate(platform);

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'copy':
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: "Link copied to clipboard!" });
        break;
    }
  };

  if (isLoading) {
    return (
      <>
        <Navigation />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="aspect-video bg-gray-300 rounded-lg mb-6"></div>
            <div className="h-8 bg-gray-300 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </main>
      </>
    );
  }

  if (!videoData?.video) {
    return (
      <>
        <Navigation />
        <main className="container max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Video Not Found</h1>
            <p className="text-muted-foreground mb-6">This video may have been removed or doesn't exist.</p>
            <Button onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>
        </main>
      </>
    );
  }

  const { video, creator, stats, tags, isFavorited } = videoData;
  const creatorName = creator?.firstName && creator?.lastName
    ? `${creator.firstName} ${creator.lastName}`
    : creator?.email?.split('@')[0] || 'Anonymous';

  return (
    <>
      <Navigation />
      <main className="container max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        {/* Video Player Section */}
        <Card className="mb-6 overflow-hidden">
          <div 
            className="relative aspect-video bg-black cursor-pointer group"
            onClick={() => setShowPlayer(true)}
          >
            {video.thumbnailPath ? (
              <img
                src={video.thumbnailPath}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Play className="h-16 w-16 text-primary/60" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="bg-primary rounded-full p-6">
                <Play className="h-12 w-12 text-primary-foreground" />
              </div>
            </div>
            {video.duration_s && (
              <Badge className="absolute bottom-4 right-4 bg-black/70">
                <Clock className="mr-1 h-3 w-3" />
                {Math.floor(video.duration_s / 60)}:{(video.duration_s % 60).toString().padStart(2, '0')}
              </Badge>
            )}
          </div>
        </Card>

        {/* Video Info */}
        <div className="space-y-6">
          {/* Title and Actions */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {video.title}
              </h1>
              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {tags.map((tag: any) => (
                    <Badge key={tag.id} variant="secondary" className="text-xs">
                      <Hash className="mr-1 h-3 w-3" />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isFavorited ? "default" : "outline"}
                size="sm"
                onClick={() => favoriteMutation.mutate()}
                disabled={favoriteMutation.isPending}
              >
                <Heart className={`mr-2 h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
                {isFavorited ? 'Favorited' : 'Favorite'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleShare('twitter')}>
                    Share on Twitter/X
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('linkedin')}>
                    Share on LinkedIn
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('facebook')}>
                    Share on Facebook
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShare('copy')}>
                    {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <Eye className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{stats?.totalViews || 0}</p>
                <p className="text-xs text-muted-foreground">Views</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Heart className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{stats?.favorites || 0}</p>
                <p className="text-xs text-muted-foreground">Favorites</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <ExternalLink className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{stats?.demoClicks || 0}</p>
                <p className="text-xs text-muted-foreground">Demo Clicks</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Share2 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold">{stats?.shares || 0}</p>
                <p className="text-xs text-muted-foreground">Shares</p>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {video.description && (
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground whitespace-pre-wrap">{video.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Creator Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/profile/${creator?.id}`)}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={creator?.profileImageUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {creatorName[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground hover:text-primary">{creatorName}</p>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Calendar className="mr-1 h-3 w-3" />
                      {video.createdAt ? new Date(video.createdAt).toLocaleDateString() : 'Recently'}
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate(`/profile/${creator?.id}`)}>
                  View Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Try Product CTA */}
          {video.productUrl && (
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => window.open(video.productUrl, '_blank')}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              Try the Product
            </Button>
          )}
        </div>
      </main>

      {/* Video Player Modal */}
      {showPlayer && (
        <VideoPlayerEnhanced
          video={{
            ...video,
            creator,
            todayViews: stats?.todayViews || 0,
            isFavorited,
          }}
          onClose={() => {
            setShowPlayer(false);
            refetch();
          }}
        />
      )}
    </>
  );
}
