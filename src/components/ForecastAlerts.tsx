import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info, CheckCircle2, AlertCircle } from "lucide-react";
import { ForecastAlert } from "@/hooks/useForecast";

const config = {
  danger: { Icon: AlertTriangle, className: "border-destructive/50 text-destructive [&>svg]:text-destructive" },
  warning: { Icon: AlertCircle, className: "border-yellow-500/50 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-500" },
  info: { Icon: Info, className: "border-primary/50 text-primary [&>svg]:text-primary" },
  success: { Icon: CheckCircle2, className: "border-success/50 text-success [&>svg]:text-success" },
};

export function ForecastAlerts({ alerts }: { alerts: ForecastAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const { Icon, className } = config[a.level];
        return (
          <Alert key={i} className={className}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="text-sm font-semibold">{a.title}</AlertTitle>
            <AlertDescription className="text-xs">{a.message}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
