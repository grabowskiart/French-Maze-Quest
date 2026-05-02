import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skull } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  BESTIARY_SEEN_EVENT,
  loadSeenCreatureIds,
} from "@/lib/saveGame";

interface BestiaryButtonProps {
  activeProfileId: string | null;
}

interface BestiaryResponse {
  defeatedCreatureIds: string[];
}

export function BestiaryButton({ activeProfileId }: BestiaryButtonProps) {
  const bestiaryKey = activeProfileId
    ? ["/api/bestiary", activeProfileId]
    : ["/api/bestiary"];

  const { data: bestiaryData } = useQuery<BestiaryResponse>({
    queryKey: bestiaryKey,
    staleTime: 0,
  });

  const [seenIds, setSeenIds] = useState<string[]>(() =>
    loadSeenCreatureIds(activeProfileId),
  );

  useEffect(() => {
    setSeenIds(loadSeenCreatureIds(activeProfileId));
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ profileId?: string }>).detail;
      if (!detail || detail.profileId === activeProfileId) {
        setSeenIds(loadSeenCreatureIds(activeProfileId));
      }
    };
    window.addEventListener(BESTIARY_SEEN_EVENT, handler);
    return () => window.removeEventListener(BESTIARY_SEEN_EVENT, handler);
  }, [activeProfileId]);

  const newCount = useMemo(() => {
    const defeated = bestiaryData?.defeatedCreatureIds ?? [];
    if (defeated.length === 0) return 0;
    const seen = new Set(seenIds);
    let count = 0;
    for (const id of defeated) {
      if (!seen.has(id)) count += 1;
    }
    return count;
  }, [bestiaryData?.defeatedCreatureIds, seenIds]);

  return (
    <Link href="/bestiary">
      <Button
        variant="secondary"
        size="sm"
        data-testid="button-open-bestiary"
        aria-label={
          newCount > 0
            ? `Examine Bestiary (${newCount} new)`
            : "Examine Bestiary"
        }
        className="relative gap-2 font-semibold"
      >
        <Skull className="w-4 h-4" />
        <span>Examine Bestiary</span>
        {newCount > 0 && (
          <span
            className="ml-1 min-w-[1.25rem] h-[1.25rem] px-1.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center shadow animate-pulse"
            data-testid="badge-bestiary-new"
            aria-hidden="true"
          >
            {newCount > 9 ? "9+" : `${newCount} new!`}
          </span>
        )}
      </Button>
    </Link>
  );
}
