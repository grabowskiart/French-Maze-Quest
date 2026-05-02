import { Flame, Clock, Moon, Sun, HelpCircle, Settings, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

interface GameHeaderProps {
  streak: number;
  questionsAnswered: number;
  sessionTime: number;
}

export function GameHeader({ streak, questionsAnswered, sessionTime }: GameHeaderProps) {
  const { theme, toggleTheme } = useTheme();

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
              aria-label="Bestiary"
            >
              <BookOpen className="w-5 h-5" />
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
