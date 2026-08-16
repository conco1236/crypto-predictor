import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type IndicatorTooltipProps = {
  name: string;
  description: string;
  interpretation: string;
  className?: string;
};

export default function IndicatorTooltip({ name, description, interpretation, className = "" }: IndicatorTooltipProps) {
  return <TooltipProvider delayDuration={180}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`Giải thích ${name}`} className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="w-[min(340px,calc(100vw-2rem))] border-border bg-popover p-4 text-popover-foreground shadow-xl">
        <p className="text-xs font-semibold text-primary">{name}</p>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
        <p className="mt-2 border-t border-border pt-2 text-[11px] leading-4 text-foreground/80"><strong className="text-foreground">Cách đọc:</strong> {interpretation}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>;
}
