import { Flame, Clock, Moon, Sun, HelpCircle, Settings } from "lucide-react";
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
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl" role="img" aria-label="French flag">🇫🇷</span>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
              Maze Adventure
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Badge
            variant="secondary"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold"
            data-testid="badge-session-time"
          >
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>{formatTime(sessionTime)}</span>
          </Badge>

          <Badge
            variant="secondary"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold"
            data-testid="badge-questions-count"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            <span>{questionsAnswered}</span>
          </Badge>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-sm transition-all ${
              streak >= 3
                ? "bg-warning/20 text-warning-foreground dark:text-warning"
                : "bg-muted text-muted-foreground"
            }`}
            data-testid="badge-streak"
          >
            <Flame
              className={`w-5 h-5 ${
                streak >= 3 ? "text-warning animate-pulse" : "text-muted-foreground"
              }`}
            />
            <span>{streak}</span>
          </div>

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
