import { Braces, Brain, Eye, Mic, Unlock, Wrench } from "lucide-react";
import { Badge } from "./ui";

interface CapabilityFlags {
  reasoning: boolean;
  toolCalling: boolean;
  structuredOutput: boolean;
  openWeights: boolean;
  inputModalities: string[];
}

const ITEMS = [
  { key: "reasoning", label: "Reasoning", Icon: Brain, on: (m: CapabilityFlags) => m.reasoning },
  { key: "tools", label: "Tool calling", Icon: Wrench, on: (m: CapabilityFlags) => m.toolCalling },
  { key: "json", label: "Structured output", Icon: Braces, on: (m: CapabilityFlags) => m.structuredOutput },
  { key: "vision", label: "Vision input", Icon: Eye, on: (m: CapabilityFlags) => m.inputModalities.includes("IMAGE") },
  { key: "audio", label: "Audio input", Icon: Mic, on: (m: CapabilityFlags) => m.inputModalities.includes("AUDIO") },
  { key: "open", label: "Open weights", Icon: Unlock, on: (m: CapabilityFlags) => m.openWeights },
];

/** Compact icon row for tables; full labelled badges for detail pages. */
export function CapabilityIcons({ model }: { model: CapabilityFlags }) {
  return (
    <div className="flex items-center gap-1.5">
      {ITEMS.map(({ key, label, Icon, on }) => {
        const active = on(model);
        return (
          <span key={key} title={`${label}: ${active ? "yes" : "no"}`} className={active ? "text-foreground" : "text-muted/25"}>
            <Icon className="size-3.5" aria-label={active ? label : undefined} aria-hidden={!active} />
          </span>
        );
      })}
    </div>
  );
}

export function CapabilityBadges({ model }: { model: CapabilityFlags }) {
  const active = ITEMS.filter((i) => i.on(model));
  if (!active.length) return <span className="text-sm text-muted">No special capabilities listed</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(({ key, label, Icon }) => (
        <Badge key={key} tone="accent" className="px-2 py-1 text-xs">
          <Icon className="size-3.5" /> {label}
        </Badge>
      ))}
    </div>
  );
}
