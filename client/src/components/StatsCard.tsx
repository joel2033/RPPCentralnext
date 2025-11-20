import { LucideIcon, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value?: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  isLoading?: boolean;
}

export function StatsCard({ title, value, change, changeType = 'positive', icon: Icon, iconBgColor, iconColor, isLoading = false }: StatsCardProps) {
  const TrendIcon = changeType === 'positive' ? TrendingUp : TrendingDown;

  return (
    <Card className="bg-white border-0 rounded-3xl shadow-rpp-card hover:shadow-rpp-card-hover transition-all duration-300 hover:-translate-y-1">
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconBgColor || 'bg-gradient-to-br from-primary/20 to-primary/10'}`}>
              <Icon className={`w-5 h-5 ${iconColor || 'text-primary'}`} />
            </div>
            {!isLoading && change && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                changeType === 'positive'
                  ? 'text-support-green'
                  : 'text-red-600'
              }`}>
                <TrendIcon className="w-3 h-3" />
                <span>{change}</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-rpp-grey-medium uppercase tracking-wider">{title}</p>
            {isLoading ? (
              <div className="flex items-center gap-2 h-9">
                <Loader2 className="w-6 h-6 text-rpp-grey-medium animate-spin" />
                <span className="text-sm text-rpp-grey-medium">Loading...</span>
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold text-rpp-grey-dark leading-none">{value}</p>
                <p className="text-xs text-rpp-grey-light">vs last month</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
