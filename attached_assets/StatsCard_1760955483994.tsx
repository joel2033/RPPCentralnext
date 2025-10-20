import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "./ui/card";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: LucideIcon;
}

export function StatsCard({ title, value, change, changeType, icon: Icon }: StatsCardProps) {
  const TrendIcon = changeType === 'positive' ? TrendingUp : TrendingDown;
  
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-border/50 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="p-2.5 relative">
        <div className="flex items-start justify-between mb-1.5">
          <div className="p-1 bg-gradient-to-br from-primary/20 via-primary/15 to-primary/5 rounded-md group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-primary/10 ring-1 ring-primary/20">
            <Icon className="w-3.5 h-3.5 text-primary drop-shadow-sm" />
          </div>
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs ${
            changeType === 'positive' 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            <TrendIcon className="w-2.5 h-2.5" />
            <span className="text-xs">{change}</span>
          </div>
        </div>
        
        <div>
          <p className="text-muted-foreground text-xs mb-0">{title}</p>
          <p className="text-lg tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0">vs last month</p>
        </div>
      </CardContent>
    </Card>
  );
}
