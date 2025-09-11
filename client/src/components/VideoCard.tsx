import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Play, Eye, ExternalLink, Crown } from "lucide-react";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    description: string;
    productUrl: string;
    videoPath: string;
    totalViews: number;
    creator: {
      id: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      profileImageUrl?: string;
    };
    todayViews: number;
  };
  position: number;
  onPlay: () => void;
}

export default function VideoCard({ video, position, onPlay }: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getPositionBadge = () => {
    const colors = {
      1: "bg-accent text-accent-foreground",
      2: "bg-orange-500 text-white",
      3: "bg-purple-500 text-white",
    } as const;

    const color = colors[position as keyof typeof colors] || "bg-blue-500 text-white";

    return (
      <Badge className={`${color} absolute top-3 left-3 font-semibold`}>
        #{position}
        {position === 1 && <Crown className="ml-1 h-3 w-3" />}
      </Badge>
    );
  };

  const getCreatorInitial = () => {
    if (video.creator.firstName) {
      return video.creator.firstName.charAt(0).toUpperCase();
    }
    if (video.creator.email) {
      return video.creator.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getCreatorName = () => {
    if (video.creator.firstName && video.creator.lastName) {
      return `${video.creator.firstName} ${video.creator.lastName}`;
    }
    if (video.creator.firstName) {
      return video.creator.firstName;
    }
    return video.creator.email || "Anonymous";
  };

  const handleTryProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(video.productUrl, "_blank");
  };

  return (
    <Card 
      className="bg-card border-border group cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onPlay}
      data-testid={`video-card-${video.id}`}
    >
      <div className="relative">
        {/* Video Thumbnail Placeholder */}
        <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative overflow-hidden rounded-t-lg">
          <div className="text-center">
            <Play className="h-12 w-12 text-primary/60 mb-2" />
            <p className="text-sm text-muted-foreground">Video Preview</p>
          </div>
          
          {/* Hover Overlay */}
          <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="bg-primary rounded-full p-4">
              <Play className="text-primary-foreground h-6 w-6" />
            </div>
          </div>
          
          {/* Position Badge */}
          {getPositionBadge()}
          
          {/* View Count */}
          <Badge variant="secondary" className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm text-foreground">
            <Eye className="mr-1 h-3 w-3" />
            {video.todayViews}
          </Badge>
          
          {/* Duration */}
          <Badge variant="secondary" className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm text-foreground text-xs">
            30s
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">{video.title}</h3>
        <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{video.description}</p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={video.creator.profileImageUrl} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getCreatorInitial()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{getCreatorName()}</span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTryProduct}
            className="text-primary hover:text-primary/80 p-0 h-auto font-medium"
            data-testid={`button-try-${video.id}`}
          >
            Try Now <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
