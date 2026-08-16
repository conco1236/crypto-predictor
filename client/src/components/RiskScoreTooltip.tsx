import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type RiskScoreTooltipProps = {
  score: number;
  level: string;
  details: Array<[string, string]>;
  delayDuration?: number;
};

export default function RiskScoreTooltip({ score, level, details, delayDuration = 180 }: RiskScoreTooltipProps) {
  const fill = level === "low" ? "bg-emerald-300" : level === "high" ? "bg-rose-300" : "bg-amber-300";
  const safeScore = Math.max(0, Math.min(100, score));
  const tooltipText = details.map(([label, detail]) => `${label}: ${detail}`).join(" | ");
  return <TooltipProvider delayDuration={delayDuration}>
    <Tooltip>
      <TooltipTrigger asChild>
        <div tabIndex={0} role="button" data-tooltip-content={tooltipText} className="rounded-xl border border-border bg-muted/50 px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Điểm rủi ro ${score} trên 100. Di chuột hoặc nhấn để xem thành phần.`}>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>Risk score</span><span className="font-semibold text-foreground">{score}/100</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-[width] duration-500 ${fill}`} style={{ width: `${safeScore}%` }} /></div>
          <div className="mt-1 flex justify-between text-[9px] text-muted-foreground"><span>Thấp</span><span>Vừa</span><span>Cao</span></div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="w-[min(360px,calc(100vw-2rem))] border-border bg-popover p-4 text-popover-foreground shadow-2xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Cấu thành risk score · {score}/100</p>
        <div className="space-y-2">{details.map(([label, detail]) => <div key={label}><p className="text-[11px] font-semibold text-foreground">{label}</p><p className="text-[11px] leading-4 text-muted-foreground">{detail}</p></div>)}</div>
        <p className="mt-3 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">Điểm càng cao nghĩa là độ bất định và biên độ rủi ro càng lớn; đây là thông tin tham khảo, không phải khuyến nghị đầu tư.</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>;
}
