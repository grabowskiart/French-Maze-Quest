import { useEffect } from "react";
import { CheckCircle, XCircle, ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import confetti from "canvas-confetti";
import type { AnswerResult } from "@shared/schema";

interface FeedbackModalProps {
  result: AnswerResult;
  onContinue: () => void;
  onRevealArea?: () => void;
}

export function FeedbackModal({ result, onContinue, onRevealArea }: FeedbackModalProps) {
  useEffect(() => {
    if (result.correct) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#7c3aed", "#10b981", "#f59e0b"],
      });
    }
  }, [result.correct]);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card
        className={`w-full max-w-md shadow-2xl border-2 ${
          result.correct ? "border-success/50" : "border-destructive/50"
        }`}
      >
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex flex-col items-center text-center space-y-4">
            {result.correct ? (
              <>
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle className="w-12 h-12 text-success" />
                </div>
                <h2 className="font-display text-3xl font-bold text-success">
                  Correct!
                </h2>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-in zoom-in duration-300">
                  <XCircle className="w-12 h-12 text-destructive" />
                </div>
                <h2 className="font-display text-3xl font-bold text-destructive">
                  Not quite!
                </h2>
              </>
            )}

            <p className="text-muted-foreground text-base leading-relaxed">
              {result.explanation}
            </p>

            {!result.correct && (
              <div className="w-full space-y-3 pt-2">
                <div className="flex items-center justify-center gap-2 text-foreground font-semibold">
                  <ArrowRight className="w-5 h-5 text-primary" />
                  <span>
                    Correct answer:{" "}
                    <span className="text-primary">{result.correctAnswer}</span>
                  </span>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-2">
                  <Lightbulb className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground text-left">
                    {result.hint}
                  </p>
                </div>
              </div>
            )}

            {result.correct && onRevealArea && (
              <Button
                onClick={onRevealArea}
                variant="secondary"
                className="w-full h-12 text-lg font-bold font-display mt-2"
                data-testid="button-reveal-area"
              >
                Reveal 5 Tiles
              </Button>
            )}

            <Button
              onClick={onContinue}
              className="w-full h-12 text-lg font-bold font-display mt-2"
              data-testid="button-continue"
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
