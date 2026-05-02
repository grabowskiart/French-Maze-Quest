import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Crown, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BOSS_CREATURE, CREATURE_ROSTER, type CreatureTemplate } from "@/lib/creatures";
import { getActiveProfileId, loadProfiles } from "@/lib/saveGame";

interface BestiaryResponse {
  defeatedCreatureIds: string[];
}

interface CreatureCardProps {
  creature: CreatureTemplate;
  unlocked: boolean;
  highlighted?: boolean;
}

function CreatureCard({ creature, unlocked, highlighted = false }: CreatureCardProps) {
  return (
    <Card
      className={
        highlighted
          ? "overflow-hidden border-2 border-amber-500/70 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 shadow-lg"
          : "overflow-hidden"
      }
      data-testid={`card-bestiary-${creature.id}`}
    >
      <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center gap-2">
        <div
          className={
            highlighted
              ? "relative w-full aspect-square rounded-lg border-2 border-amber-400/70 bg-black/40 overflow-hidden"
              : "relative w-full aspect-square rounded-lg border bg-black/30 overflow-hidden"
          }
        >
          {unlocked ? (
            <img
              src={creature.image}
              alt={creature.name}
              className="absolute inset-0 w-full h-full object-contain"
              data-testid={`img-bestiary-${creature.id}`}
            />
          ) : (
            <>
              <img
                src={creature.image}
                alt="Unknown creature silhouette"
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-contain opacity-100 brightness-0"
                data-testid={`img-bestiary-silhouette-${creature.id}`}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <HelpCircle className="w-10 h-10 text-white/70 drop-shadow" aria-hidden="true" />
              </div>
            </>
          )}
          {highlighted && unlocked && (
            <div className="absolute top-1 right-1 rounded-full bg-amber-500 text-white p-1 shadow">
              <Crown className="w-4 h-4" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="min-h-[2.5rem] flex flex-col items-center justify-center">
          <p
            className={
              highlighted
                ? "font-display font-bold text-amber-800 dark:text-amber-200"
                : "font-display font-semibold text-foreground"
            }
            data-testid={`text-bestiary-name-${creature.id}`}
          >
            {unlocked ? creature.name : "???"}
          </p>
          {highlighted && (
            <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
              Boss
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Bestiary() {
  const profiles = useMemo(() => loadProfiles(), []);
  const activeProfileId = useMemo(() => getActiveProfileId(), []);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  const queryKey = activeProfileId
    ? ["/api/bestiary", activeProfileId]
    : ["/api/bestiary"];

  const { data, isLoading } = useQuery<BestiaryResponse>({
    queryKey,
    staleTime: 0,
  });

  const defeatedSet = useMemo(
    () => new Set(data?.defeatedCreatureIds ?? []),
    [data?.defeatedCreatureIds],
  );

  const totalRosterUnlocked = CREATURE_ROSTER.reduce(
    (acc, c) => acc + (defeatedSet.has(c.id) ? 1 : 0),
    0,
  );
  const bossUnlocked = defeatedSet.has(BOSS_CREATURE.id);
  const totalCreatures = CREATURE_ROSTER.length + 1;
  const totalUnlocked = totalRosterUnlocked + (bossUnlocked ? 1 : 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-bestiary-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-xl font-display font-bold text-foreground">Bestiary</h1>
                <p className="text-sm text-muted-foreground">
                  {activeProfile
                    ? `${activeProfile.name}'s creature collection`
                    : "Defeat creatures to unlock their portraits"}
                </p>
              </div>
            </div>
          </div>
          <div
            className="text-right"
            data-testid="text-bestiary-progress"
          >
            <p className="font-display text-2xl font-bold text-foreground">
              {totalUnlocked}
              <span className="text-muted-foreground text-base font-medium"> / {totalCreatures}</span>
            </p>
            <p className="text-xs text-muted-foreground">Unlocked</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {isLoading && (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-bestiary-loading">
            Loading bestiary…
          </div>
        )}

        {!isLoading && (
          <>
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-lg font-bold">Dungeon Creatures</h2>
                <p className="text-sm text-muted-foreground" data-testid="text-bestiary-roster-count">
                  {totalRosterUnlocked} / {CREATURE_ROSTER.length} discovered
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {CREATURE_ROSTER.map((creature) => (
                  <CreatureCard
                    key={creature.id}
                    creature={creature}
                    unlocked={defeatedSet.has(creature.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-bold flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Dungeon Boss
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                <CreatureCard
                  creature={BOSS_CREATURE}
                  unlocked={bossUnlocked}
                  highlighted
                />
              </div>
            </section>

            {!activeProfile && (
              <p
                className="text-sm text-muted-foreground text-center"
                data-testid="text-bestiary-no-profile"
              >
                Pick a player on the start screen to track unlocks per child.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
