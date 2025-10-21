import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
}

export function StatsCard({ title, value, change, changeType, icon: Icon, iconBgColor, iconColor }: StatsCardProps) {
  const TrendIcon = changeType === 'positive' ? TrendingUp : TrendingDown;

  return (
    <Card className="group bg-white border-0 rounded-3xl shadow-modern hover:shadow-colored transition-smooth hover-lift overflow-hidden relative">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-rpp-red-palest/0 to-rpp-red-pale/0 group-hover:from-rpp-red-palest/40 group-hover:to-rpp-red-pale/20 transition-all duration-500 -z-0" />

      <CardContent className="p-6 relative z-10">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-smooth shadow-sm ${iconBgColor || 'bg-gradient-to-br from-primary/20 to-primary/10'}`}>
              <Icon className={`w-6 h-6 ${iconColor || 'text-primary'}`} />
            </div>
            <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full transition-smooth ${
              changeType === 'positive'
                ? 'text-support-green bg-green-50 group-hover:bg-green-100'
                : 'text-red-600 bg-red-50 group-hover:bg-red-100'
            }`}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{change}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-rpp-grey uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold text-rpp-grey-dark leading-none group-hover:text-rpp-red-dark transition-colors">{value}</p>
            <p className="text-xs text-rpp-grey-light font-medium">vs last month</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
