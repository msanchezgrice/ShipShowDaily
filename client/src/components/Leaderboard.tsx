import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Crown, Eye, Heart, ExternalLink, Hash } from "lucide-react";

interface LeaderboardItem {
  position: number;
  video: {
    id: string;
    title: string;
    tags?: Array<{ id: string; name: string }>;
  };
  creator: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  views: number;
  favorites?: number;
  demoClicks?: number;
}

interface LeaderboardProps {
  items: LeaderboardItem[];
  sortBy?: 'views' | 'favorites' | 'demo_clicks';
  onSortChange?: (sortBy: 'views' | 'favorites' | 'demo_clicks') => void;
}

export default function Leaderboard({ items, sortBy = 'views', onSortChange }: LeaderboardProps) {
  const getPositionColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-accent text-accent-foreground";
      case 2:
        return "bg-orange-500 text-white";
      case 3:
        return "bg-purple-500 text-white";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getCreatorName = (creator: LeaderboardItem['creator']) => {
    if (creator.firstName && creator.lastName) {
      return `${creator.firstName} ${creator.lastName}`;
    }
    if (creator.firstName) {
      return creator.firstName;
    }
    return creator.email || "Anonymous";
  };

  const getCreatorInitial = (creator: LeaderboardItem['creator']) => {
    if (creator.firstName) {
      return creator.firstName.charAt(0).toUpperCase();
    }
    if (creator.email) {
      return creator.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getMetricValue = (item: LeaderboardItem) => {
    switch (sortBy) {
      case 'favorites':
        return item.favorites || 0;
      case 'demo_clicks':
        return item.demoClicks || 0;
      default:
        return item.views;
    }
  };

  const getMetricLabel = () => {
    switch (sortBy) {
      case 'favorites':
        return 'favorites';
      case 'demo_clicks':
        return 'demo clicks';
      default:
        return 'views';
    }
  };

  const getMetricIcon = () => {
    switch (sortBy) {
      case 'favorites':
        return Heart;
      case 'demo_clicks':
        return ExternalLink;
      default:
        return Eye;
    }
  };

  const MetricIcon = getMetricIcon();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Trophy className="text-accent mr-2 h-5 w-5" />
            Daily Leaderboard
          </CardTitle>
          {onSortChange && (
            <div className="flex space-x-1">
              <Button
                variant={sortBy === 'views' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSortChange('views')}
                data-testid="sort-by-views"
                className="px-2"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant={sortBy === 'favorites' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSortChange('favorites')}
                data-testid="sort-by-favorites"
                className="px-2"
              >
                <Heart className="h-4 w-4" />
              </Button>
              <Button
                variant={sortBy === 'demo_clicks' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onSortChange('demo_clicks')}
                data-testid="sort-by-demo-clicks"
                className="px-2"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" data-testid="leaderboard-list">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No videos yet today</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.video.id}
                className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${
                  item.position === 1 
                    ? 'bg-accent/5 border border-accent/20' 
                    : 'bg-secondary/50'
                }`}
                data-testid={`leaderboard-item-${item.position}`}
              >
                <div className="flex items-center space-x-3">
                  <Badge 
                    className={`${getPositionColor(item.position)} font-bold min-w-[2rem] justify-center`}
                  >
                    {item.position}
                    {item.position === 1 && <Crown className="ml-1 h-3 w-3" />}
                  </Badge>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={item.creator?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getCreatorInitial(item.creator)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">
                      {getCreatorName(item.creator)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.video.title}
                    </p>
                    {item.video.tags && item.video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.video.tags.slice(0, 3).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs px-1 py-0 h-4"
                          >
                            <Hash className="h-2 w-2 mr-0.5" />
                            {tag.name}
                          </Badge>
                        ))}
                        {item.video.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{item.video.tags.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end space-x-3">
                    {/* Primary metric */}
                    <div className="text-right">
                      <div className="flex items-center justify-end">
                        <MetricIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                        <p className={`font-semibold ${
                          item.position === 1 ? 'text-accent' : 'text-foreground'
                        }`}>
                          {getMetricValue(item).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{getMetricLabel()}</p>
                    </div>
                    
                    {/* Secondary metrics (when not primary) */}
                    {sortBy !== 'views' && (
                      <div className="text-right opacity-70">
                        <div className="flex items-center justify-end">
                          <Eye className="h-2 w-2 mr-1 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {item.views.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {sortBy !== 'favorites' && item.favorites !== undefined && (
                      <div className="text-right opacity-70">
                        <div className="flex items-center justify-end">
                          <Heart className="h-2 w-2 mr-1 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {item.favorites.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {sortBy !== 'demo_clicks' && item.demoClicks !== undefined && (
                      <div className="text-right opacity-70">
                        <div className="flex items-center justify-end">
                          <ExternalLink className="h-2 w-2 mr-1 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {item.demoClicks.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
