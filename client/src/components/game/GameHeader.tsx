import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame, Clock, Moon, Sun, HelpCircle, Settings, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  BESTIARY_SEEN_EVENT,
  loadSeenCreatureIds,
} from "@/lib/saveGame";

interface GameHeaderProps {
  streak: number;
  questionsAnswered: number;
  sessionTime: number;
  activeProfileId: string | null;
}

interface BestiaryResponse {
  defeatedCreatureIds: string[];
}

export function GameHeader({ streak, questionsAnswered, sessionTime, activeProfileId }: GameHeaderProps) {
  const { theme, toggleTheme } = useTheme();

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

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border rounded-b-2xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0" role="img" aria-label="French flag">🇫🇷</span>
          <h1 className="hidden sm:block font-display text-xl sm:text-2xl font-bold text-foreground truncate">
            Maze Adventure
          </h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-4">
          <Badge
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1 sm:gap-1.5 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold"
            data-testid="badge-session-time"
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <span>{formatTime(sessionTime)}</span>
          </Badge>

          <Badge
            variant="secondary"
            className="flex items-center gap-1 px-2 py-1 sm:gap-1.5 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-semibold"
            data-testid="badge-questions-count"
          >
            <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <span>{questionsAnswered}</span>
          </Badge>

          <div
            className={`flex items-center gap-1 px-2 py-1 sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-md font-bold text-xs sm:text-sm transition-all ${
              streak >= 3
                ? "bg-warning/20 text-warning-foreground dark:text-warning"
                : "bg-muted text-muted-foreground"
            }`}
            data-testid="badge-streak"
          >
            <Flame
              className={`w-4 h-4 sm:w-5 sm:h-5 ${
                streak >= 3 ? "text-warning animate-pulse" : "text-muted-foreground"
              }`}
            />
            <span>{streak}</span>
          </div>

          <Link href="/bestiary">
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-open-bestiary"
              aria-label={
                newCount > 0
                  ? `Bestiary (${newCount} new)`
                  : "Bestiary"
              }
              className="relative"
            >
              <BookOpen className="w-5 h-5" />
              {newCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-warning text-warning-foreground text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-card animate-pulse"
                  data-testid="badge-bestiary-new"
                  aria-hidden="true"
                >
                  {newCount > 9 ? "9+" : newCount}
                </span>
              )}
            </Button>
          </Link>

          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-settings"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
