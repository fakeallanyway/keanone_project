import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  variant?: "default" | "premium" | "success" | "destructive";
}

export function StatsCard({
  title,
  value,
  description,
  variant = "default",
}: StatsCardProps) {
  return (
    <Card
      className={cn(
        "transition-colors",
        variant === "premium" &&
          "bg-gradient-to-br from-yellow-100 to-amber-50 border-yellow-200",
        variant === "success" &&
          "bg-gradient-to-br from-green-100 to-emerald-50 border-green-200",
        variant === "destructive" &&
          "bg-gradient-to-br from-red-100 to-rose-50 border-red-200"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium",
            variant === "premium" && "text-amber-900",
            variant === "success" && "text-emerald-900",
            variant === "destructive" && "text-red-900"
          )}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            variant === "premium" && "text-amber-900",
            variant === "success" && "text-emerald-900",
            variant === "destructive" && "text-red-900"
          )}
        >
          {value}
        </div>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            variant === "premium" && "text-amber-800/80",
            variant === "success" && "text-emerald-800/80",
            variant === "destructive" && "text-red-800/80"
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
