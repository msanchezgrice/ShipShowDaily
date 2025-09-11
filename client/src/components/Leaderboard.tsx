import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Crown } from "lucide-react";

interface LeaderboardItem {
  position: number;
  video: {
    id: string;
    title: string;
  };
  creator: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  views: number;
}

interface LeaderboardProps {
  items: LeaderboardItem[];
}

export default function Leaderboard({ items }: LeaderboardProps) {
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

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="text-accent mr-2 h-5 w-5" />
          Daily Leaderboard
        </CardTitle>
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
                    <AvatarImage src={item.creator.profileImageUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getCreatorInitial(item.creator)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground text-sm">
                      {getCreatorName(item.creator)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.video.title}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    item.position === 1 ? 'text-accent' : 'text-foreground'
                  }`}>
                    {item.views.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">views</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
