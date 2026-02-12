import { Swords, Shield, Gem, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/dungeon-entrance.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

      <div className="relative z-10 w-full max-w-lg px-6 py-8 flex flex-col items-center text-center space-y-6">
        <div className="flex items-center gap-2">
          <Flame className="w-8 h-8 text-orange-400 animate-pulse" />
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-white drop-shadow-lg tracking-tight">
            French Dungeon
          </h1>
          <Flame className="w-8 h-8 text-orange-400 animate-pulse" />
        </div>

        <p className="text-orange-200/90 text-lg sm:text-xl leading-relaxed max-w-md font-medium drop-shadow">
          A dark dungeon awaits. Answer French questions to fight your way through, defeat the creatures within, and claim the treasure beyond.
        </p>

        <div className="w-full space-y-3 pt-2">
          <div className="flex items-center gap-4 text-left rounded-xl p-4 bg-black/50 backdrop-blur-sm border border-white/10">
            <div className="w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center flex-shrink-0 border border-red-500/30">
              <Swords className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Battle Creatures</h3>
              <p className="text-xs text-white/60">
                Answer French questions to strike monsters blocking your path
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-left rounded-xl p-4 bg-black/50 backdrop-blur-sm border border-white/10">
            <div className="w-10 h-10 rounded-full bg-blue-900/60 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Collect Weapons & Potions</h3>
              <p className="text-xs text-white/60">
                Find swords, potions, and hearts hidden throughout the dungeon
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-left rounded-xl p-4 bg-black/50 backdrop-blur-sm border border-white/10">
            <div className="w-10 h-10 rounded-full bg-amber-900/60 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
              <Gem className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Defeat the Dragon & Claim the Treasure</h3>
              <p className="text-xs text-white/60">
                Slay the Dragon Warden at the dungeon's end and emerge victorious
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={onStart}
          size="lg"
          className="w-full h-14 text-xl font-bold font-display mt-4 bg-orange-700 border border-orange-500 text-white"
          data-testid="button-start-game"
        >
          <Swords className="w-6 h-6 mr-2" />
          Enter the Dungeon
        </Button>
      </div>
    </div>
  );
}
