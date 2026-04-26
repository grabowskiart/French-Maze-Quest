export type PickupKind = "heart" | "potion" | "weapon";

interface PickupVisual {
  icon: string;
  label: string;
  badgeClass: string;
}

const PICKUP_VISUALS: Record<PickupKind, PickupVisual> = {
  heart: {
    icon: "❤",
    label: "Heart",
    badgeClass: "bg-red-500/95 text-white",
  },
  potion: {
    icon: "🧪",
    label: "Potion",
    badgeClass: "bg-cyan-500/90 text-white",
  },
  weapon: {
    icon: "⚔️",
    label: "Weapon",
    badgeClass: "bg-amber-500/90 text-zinc-950",
  },
};

export function getPickupVisual(kind: PickupKind): PickupVisual {
  return PICKUP_VISUALS[kind];
}

interface PickupIconProps {
  kind: PickupKind;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PickupIconProps["size"]>, string> = {
  sm: "h-3.5 w-3.5 text-[9px]",
  md: "h-6 w-6 text-sm",
  lg: "h-8 w-8 text-base",
};

export function PickupIcon({ kind, size = "md", className = "" }: PickupIconProps) {
  const visual = getPickupVisual(kind);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full leading-none shadow-sm shrink-0 ${SIZE_CLASSES[size]} ${visual.badgeClass} ${className}`}
      title={visual.label}
      aria-label={visual.label}
      data-testid={`icon-pickup-${kind}`}
    >
      {visual.icon}
    </span>
  );
}
