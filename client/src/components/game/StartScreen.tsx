import { Swords, Shield, Gem, Flame, Save, UserRound, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { ChildProfile } from "@/lib/saveGame";

interface StartScreenProps {
  onStart: () => void;
  hasSave?: boolean;
  onContinue?: () => void;
  profiles: ChildProfile[];
  activeProfileId: string | null;
  onSelectProfile: (id: string) => void;
}

export function StartScreen({
  onStart,
  hasSave = false,
  onContinue,
  profiles,
  activeProfileId,
  onSelectProfile,
}: StartScreenProps) {
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  const handleNewAdventureClick = () => {
    if (hasSave) {
      const who = activeProfile ? activeProfile.name : "this player";
      const confirmed = window.confirm(
        `${who} has a saved adventure in progress. Starting a new one will erase it. Continue?`,
      );
      if (!confirmed) return;
    }
    onStart();
  };

  const hasProfiles = profiles.length > 0;

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

        <div className="w-full space-y-3 pt-2" data-testid="profile-picker">
          {hasProfiles ? (
            <div className="rounded-xl p-4 bg-black/50 backdrop-blur-sm border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
                <UserRound className="w-4 h-4" />
                <span>Who's playing?</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {profiles.map((profile) => {
                  const isActive = profile.id === activeProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => onSelectProfile(profile.id)}
                      className={
                        isActive
                          ? "px-3 py-2 rounded-lg border-2 border-emerald-400 bg-emerald-700/60 text-white text-sm font-semibold"
                          : "px-3 py-2 rounded-lg border border-white/30 bg-black/40 text-white/80 hover:bg-white/10 text-sm font-medium"
                      }
                      data-testid={`button-select-profile-${profile.id}`}
                    >
                      {profile.name}
                    </button>
                  );
                })}
              </div>
              {!activeProfile && (
                <p className="text-xs text-orange-200/80" data-testid="text-pick-profile-prompt">
                  Tap a name to choose who is playing.
                </p>
              )}
            </div>
          ) : (
            <div
              className="rounded-xl p-4 bg-black/50 backdrop-blur-sm border border-white/10 text-white/80 text-sm space-y-3"
              data-testid="text-no-profiles"
            >
              <p>No child profiles yet. Ask a parent to add one in the dashboard so each kid keeps their own saved adventure.</p>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  className="w-full bg-black/40 border border-white/30 text-white hover:bg-white/10"
                  data-testid="button-go-dashboard-no-profiles"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Open Parent Dashboard
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="w-full space-y-3 pt-2">
          {hasSave && onContinue && activeProfile && (
            <Button
              onClick={onContinue}
              size="lg"
              className="w-full h-14 text-xl font-bold font-display bg-emerald-700 border border-emerald-500 text-white hover:bg-emerald-600"
              data-testid="button-continue-game"
            >
              <Save className="w-6 h-6 mr-2" />
              Continue {activeProfile.name}'s Adventure
            </Button>
          )}

          {activeProfile && (
            <Button
              onClick={handleNewAdventureClick}
              size="lg"
              variant={hasSave ? "outline" : "default"}
              className={
                hasSave
                  ? "w-full h-14 text-xl font-bold font-display bg-black/40 border border-orange-500/60 text-orange-100 hover:bg-orange-900/40"
                  : "w-full h-14 text-xl font-bold font-display bg-orange-700 border border-orange-500 text-white"
              }
              data-testid="button-start-game"
            >
              <Swords className="w-6 h-6 mr-2" />
              {hasSave ? "New Adventure" : "Enter the Dungeon"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
