import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Maze, Position } from "@shared/schema";

interface MazeGridProps {
  maze: Maze;
  playerPosition: Position;
  isMoving: boolean;
  remainingSteps: number;
  hasStepLimit?: boolean;
  pickupMarkers?: Record<string, "heart" | "potion" | "weapon">;
  onTileClick: (x: number, y: number) => void;
  onMove?: (direction: "up" | "down" | "left" | "right") => void;
}

export function MazeGrid({
  maze,
  playerPosition,
  isMoving,
  remainingSteps,
  hasStepLimit = true,
  pickupMarkers = {},
  onTileClick,
  onMove,
}: MazeGridProps) {
  const getTileClasses = (tile: typeof maze.tiles[0][0], isPlayer: boolean) => {
    const baseClasses = "relative flex items-center justify-center";

    if (tile.fog === "hidden") {
      return `${baseClasses} bg-maze-fog`;
    }

    if (tile.type === "wall") {
      return `${baseClasses} bg-maze-wall ${tile.fog === "seen" ? "opacity-70" : ""}`;
    }

    let bgClass = "bg-maze-path";
    if (tile.type === "entrance") {
      bgClass = "bg-maze-entrance/30";
    } else if (tile.type === "exit") {
      bgClass = "bg-maze-exit/30";
    }

    const visibilityClass = tile.fog === "seen" ? "opacity-80" : "";

    return `${baseClasses} ${bgClass} ${visibilityClass}`;
  };


  const getPickupDisplay = (kind: "heart" | "potion" | "weapon") => {
    switch (kind) {
      case "heart":
        return {
          icon: "❤",
          label: "Heart",
          badgeClass: "bg-red-500/95 text-white text-[10px]",
        };
      case "potion":
        return {
          icon: "🧪",
          label: "Potion",
          badgeClass: "bg-cyan-500/90 text-white",
        };
      case "weapon":
        return {
          icon: "⚔️",
          label: "Weapon",
          badgeClass: "bg-amber-500/90 text-zinc-950",
        };
    }
  };

  const canMoveInDirection = (direction: "up" | "down" | "left" | "right") => {
    if (!isMoving) return false;
    if (hasStepLimit && remainingSteps <= 0) return false;
    
    let newX = playerPosition.x;
    let newY = playerPosition.y;
    
    switch (direction) {
      case "up": newY -= 1; break;
      case "down": newY += 1; break;
      case "left": newX -= 1; break;
      case "right": newX += 1; break;
    }
    
    if (newX < 0 || newX >= maze.width || newY < 0 || newY >= maze.height) return false;
    
    const tile = maze.tiles[newY][newX];
    return tile.type !== "wall" && tile.fog !== "hidden";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Up arrow */}
      <Button
        size="icon"
        variant={canMoveInDirection("up") ? "default" : "outline"}
        disabled={!canMoveInDirection("up")}
        onClick={() => onMove?.("up")}
        data-testid="button-move-up"
        className="h-10 w-10"
      >
        <ChevronUp className="h-6 w-6" />
      </Button>

      <div className="flex items-center gap-2">
        {/* Left arrow */}
        <Button
          size="icon"
          variant={canMoveInDirection("left") ? "default" : "outline"}
          disabled={!canMoveInDirection("left")}
          onClick={() => onMove?.("left")}
          data-testid="button-move-left"
          className="h-10 w-10"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Maze grid - full size with tiny tiles */}
        <div className="relative w-[400px] h-[400px] rounded-lg overflow-hidden shadow-xl border-2 border-card">
          <div
            className="grid h-full w-full bg-maze-wall/50"
            style={{
              gridTemplateColumns: `repeat(${maze.width}, 1fr)`,
              gridTemplateRows: `repeat(${maze.height}, 1fr)`,
            }}
          >
            {maze.tiles.map((row, rowIndex) =>
              row.map((tile, colIndex) => {
                const isPlayer =
                  tile.x === playerPosition.x && tile.y === playerPosition.y;
                const isEntrance =
                  tile.x === maze.entrance.x && tile.y === maze.entrance.y;
                const isExit = tile.x === maze.exit.x && tile.y === maze.exit.y;
                const pickupKind = pickupMarkers[`${tile.x},${tile.y}`];

                return (
                  <div
                    key={`${tile.x}-${tile.y}`}
                    className={getTileClasses(tile, isPlayer)}
                    data-testid={`tile-${tile.x}-${tile.y}`}
                  >
                    {tile.fog !== "hidden" && (
                      <>
                        {isPlayer && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary rounded-sm z-10" />
                        )}
                        {pickupKind && !isPlayer && (() => {
                          const pickupDisplay = getPickupDisplay(pickupKind);
                          return (
                            <div
                              className="absolute inset-0 flex items-center justify-center z-[5]"
                              title={pickupDisplay.label}
                              aria-label={pickupDisplay.label}
                            >
                              <div className={`h-3.5 w-3.5 rounded-full text-[9px] leading-none flex items-center justify-center shadow-sm ${pickupDisplay.badgeClass}`}>
                                {pickupDisplay.icon}
                              </div>
                            </div>
                          );
                        })()}
                        {isEntrance && !isPlayer && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-maze-entrance rounded-full" />
                          </div>
                        )}
                        {isExit && !isPlayer && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-maze-exit rounded-full" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right arrow */}
        <Button
          size="icon"
          variant={canMoveInDirection("right") ? "default" : "outline"}
          disabled={!canMoveInDirection("right")}
          onClick={() => onMove?.("right")}
          data-testid="button-move-right"
          className="h-10 w-10"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Down arrow */}
      <Button
        size="icon"
        variant={canMoveInDirection("down") ? "default" : "outline"}
        disabled={!canMoveInDirection("down")}
        onClick={() => onMove?.("down")}
        data-testid="button-move-down"
        className="h-10 w-10"
      >
        <ChevronDown className="h-6 w-6" />
      </Button>

      {isMoving && hasStepLimit && remainingSteps > 0 && (
        <div className="mt-2">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-display font-bold text-sm shadow-lg">
            {remainingSteps} step{remainingSteps !== 1 ? "s" : ""} left
          </div>
        </div>
      )}
    </div>
  );
}
