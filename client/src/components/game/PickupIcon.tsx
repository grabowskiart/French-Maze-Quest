export type PickupKind = "heart" | "potion" | "weapon";

export type PickupMarker = { kind: PickupKind; weaponName?: string };

interface PickupVisual {
  label: string;
  fallbackEmoji: string;
}

const PICKUP_VISUALS: Record<PickupKind, PickupVisual> = {
  heart: { label: "Heart", fallbackEmoji: "❤" },
  potion: { label: "Potion", fallbackEmoji: "🧪" },
  weapon: { label: "Weapon", fallbackEmoji: "⚔️" },
};

const PICKUP_IMAGE: Record<PickupKind, string> = {
  heart: "/images/maze/pickup-heart.png",
  potion: "/images/maze/pickup-potion.png",
  weapon: "/images/weapons/knights-blade.png",
};

const WEAPON_IMAGE_BY_NAME: Record<string, string> = {
  "Rusty Sword": "/images/weapons/rusty-sword.png",
  "Knight's Blade": "/images/weapons/knights-blade.png",
  "War Axe": "/images/weapons/war-axe.png",
  "Spiked Mace": "/images/weapons/spiked-mace.png",
  "Moon Lance": "/images/weapons/moon-lance.png",
  "Flame Saber": "/images/weapons/flame-saber.png",
  "Dragonfang Spear": "/images/weapons/dragonfang-spear.png",
};

export function getPickupVisual(kind: PickupKind): PickupVisual {
  return PICKUP_VISUALS[kind];
}

export function getWeaponImage(name: string): string | null {
  return WEAPON_IMAGE_BY_NAME[name] ?? null;
}

export function getPickupImage(kind: PickupKind, weaponName?: string): string {
  if (kind === "weapon" && weaponName) {
    return getWeaponImage(weaponName) ?? PICKUP_IMAGE.weapon;
  }
  return PICKUP_IMAGE[kind];
}

interface PickupIconProps {
  kind: PickupKind;
  weaponName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_PX: Record<NonNullable<PickupIconProps["size"]>, number> = {
  sm: 20,
  md: 28,
  lg: 56,
};

export function PickupIcon({
  kind,
  weaponName,
  size = "md",
  className = "",
}: PickupIconProps) {
  const visual = getPickupVisual(kind);
  const src = getPickupImage(kind, weaponName);
  const px = SIZE_PX[size];
  const label = kind === "weapon" && weaponName ? weaponName : visual.label;
  return (
    <img
      src={src}
      alt={label}
      title={label}
      width={px}
      height={px}
      style={{ width: px, height: px }}
      className={`object-contain shrink-0 drop-shadow-sm ${className}`}
      data-testid={`icon-pickup-${kind}`}
    />
  );
}
