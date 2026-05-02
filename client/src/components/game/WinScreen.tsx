import { useEffect } from "react";
import { Trophy, Star, Clock, Target, RotateCcw, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import confetti from "canvas-confetti";
import { getWeaponImage } from "./PickupIcon";

interface WinScreenProps {
  questionsAnswered: number;
  correctAnswers: number;
  sessionTime: number;
  streak: number;
  onPlayAgain: () => void;
  showDragonVictoryScene?: boolean;
  equippedWeapon?: { name: string; damage: number };
}

export function WinScreen({
  questionsAnswered,
  correctAnswers,
  sessionTime,
  streak,
  onPlayAgain,
  showDragonVictoryScene = false,
  equippedWeapon,
}: WinScreenProps) {
  const weaponImage = equippedWeapon ? getWeaponImage(equippedWeapon.name) : null;
  const accuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;

  useEffect(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#7c3aed", "#ec4899", "#f59e0b", "#10b981"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#7c3aed", "#ec4899", "#f59e0b", "#10b981"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <Card className={`w-full shadow-2xl border-2 border-warning/50 ${showDragonVictoryScene ? "max-w-4xl" : "max-w-md"}`}>
        <CardContent className="pt-10 pb-8 px-6">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-warning/20 flex items-center justify-center animate-in zoom-in duration-500">
                <Trophy className="w-14 h-14 text-warning" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center animate-bounce">
                <Star className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>

            <div>
              <h2 className="font-display text-4xl font-bold text-warning mb-2">
                You Won!
              </h2>
              <p className="text-muted-foreground text-lg">
                Amazing work reaching the exit!
              </p>
            </div>


            {showDragonVictoryScene && (
              <div className="w-full overflow-hidden rounded-xl border border-border bg-black/40">
                <img
                  src="/images/creatures/victory-scene.png"
                  alt="Chest of gold, fallen dragon, and dungeon exit"
                  className="h-[200px] sm:h-[240px] lg:h-[260px] w-full object-contain bg-black/50"
                />
              </div>
            )}
            {equippedWeapon && weaponImage && (
              <div
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
                data-testid="win-equipped-weapon"
              >
                <img
                  src={weaponImage}
                  alt={equippedWeapon.name}
                  className="h-14 w-14 object-contain shrink-0 drop-shadow"
                />
                <div className="text-left">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Final weapon</p>
                  <p className="font-display text-lg font-bold text-foreground" data-testid="text-win-weapon-name">
                    {equippedWeapon.name}
                  </p>
                  <p className="text-xs text-muted-foreground">Damage {equippedWeapon.damage}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 w-full pt-4">
              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Time</span>
                </div>
                <div className="font-display text-2xl font-bold text-foreground">
                  {formatTime(sessionTime)}
                </div>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                  <Target className="w-4 h-4" />
                  <span className="text-sm">Accuracy</span>
                </div>
                <div className="font-display text-2xl font-bold text-foreground">
                  {accuracy}%
                </div>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                  <Star className="w-4 h-4" />
                  <span className="text-sm">Questions</span>
                </div>
                <div className="font-display text-2xl font-bold text-foreground">
                  {correctAnswers}/{questionsAnswered}
                </div>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                  <Trophy className="w-4 h-4" />
                  <span className="text-sm">Best Streak</span>
                </div>
                <div className="font-display text-2xl font-bold text-foreground">
                  {streak}
                </div>
              </div>
            </div>

            <Button
              onClick={onPlayAgain}
              className="w-full h-14 text-xl font-bold font-display mt-4"
              data-testid="button-play-again"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Play Again
            </Button>

            <Link href="/bestiary" className="w-full">
              <Button
                variant="outline"
                className="w-full h-12 text-base font-display"
                data-testid="button-win-open-bestiary"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                View Bestiary
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
