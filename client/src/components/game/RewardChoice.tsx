import { Footprints, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RewardChoiceProps {
  onMove: () => void;
  onReveal: () => void;
}

export function RewardChoice({ onMove, onReveal }: RewardChoiceProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-2 border-primary/30">
        <CardHeader className="text-center pb-4">
          <CardTitle className="font-display text-2xl sm:text-3xl">
            Choose Your Reward
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Great job! Pick how you want to progress.
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pb-8">
          <Button
            onClick={onMove}
            variant="default"
            className="w-full h-auto py-6 flex flex-col items-center gap-2"
            data-testid="button-reward-move"
          >
            <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Footprints className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-display text-xl font-bold">Move</div>
              <div className="text-sm opacity-90">Take up to 3 steps</div>
            </div>
          </Button>

          <Button
            onClick={onReveal}
            variant="secondary"
            className="w-full h-auto py-6 flex flex-col items-center gap-2"
            data-testid="button-reward-reveal"
          >
            <div className="w-12 h-12 rounded-full bg-secondary-foreground/20 flex items-center justify-center">
              <Eye className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-display text-xl font-bold">Reveal</div>
              <div className="text-sm opacity-90">See 5 tiles around you</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
