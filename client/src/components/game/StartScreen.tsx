import { Play, Map, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl border-2 border-primary/20">
        <CardContent className="pt-10 pb-8 px-6 sm:px-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex items-center gap-3">
              <span className="text-5xl" role="img" aria-label="French flag">🇫🇷</span>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Map className="w-9 h-9 text-primary" />
              </div>
            </div>

            <div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-3">
                French Maze
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Answer French questions to navigate through a mysterious maze!
              </p>
            </div>

            <div className="w-full space-y-4 pt-4">
              <div className="flex items-start gap-4 text-left bg-muted/50 rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Learn French</h3>
                  <p className="text-sm text-muted-foreground">
                    Answer vocabulary, conjugation, and fill-in questions
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left bg-muted/50 rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Map className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Explore the Maze</h3>
                  <p className="text-sm text-muted-foreground">
                    Correct answers let you move or reveal hidden paths
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left bg-muted/50 rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Find the Exit</h3>
                  <p className="text-sm text-muted-foreground">
                    Reach the golden trophy to win the game!
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={onStart}
              size="lg"
              className="w-full h-14 text-xl font-bold font-display mt-4"
              data-testid="button-start-game"
            >
              <Play className="w-6 h-6 mr-2" />
              Start Adventure
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
