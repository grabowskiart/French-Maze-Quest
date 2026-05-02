import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Maze, Position } from "@shared/schema";
import { getPickupVisual, getPickupImage, type PickupMarker } from "./PickupIcon";

const WALL_TEXTURE_URL = "/images/maze/wall-texture.png";
const PATH_TEXTURE_URL = "/images/maze/path-texture.png";
const ENTRANCE_SPRITE_URL = "/images/maze/entrance-portal.png";
const EXIT_SPRITE_URL = "/images/maze/exit-portal.png";
const PLAYER_SPRITE_URL = "/images/maze/player-hero.png";

interface MazeGridProps {
  maze: Maze;
  playerPosition: Position;
  isMoving: boolean;
  remainingSteps: number;
  hasStepLimit?: boolean;
  pickupMarkers?: Record<string, PickupMarker>;
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
  const getTileBackground = (
    tile: typeof maze.tiles[0][0],
  ): { className: string; style?: React.CSSProperties } => {
    const baseClasses = "relative flex items-center justify-center";

    if (tile.fog === "hidden") {
      return { className: `${baseClasses} bg-maze-fog` };
    }

    if (tile.type === "wall") {
      const visibilityClass = tile.fog === "seen" ? "opacity-70" : "";
      return {
        className: `${baseClasses} bg-maze-wall ${visibilityClass}`,
        style: {
          backgroundImage: `url(${WALL_TEXTURE_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        },
      };
    }

    const visibilityClass = tile.fog === "seen" ? "opacity-80" : "";
    return {
      className: `${baseClasses} bg-maze-path ${visibilityClass}`,
      style: {
        backgroundImage: `url(${PATH_TEXTURE_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
    };
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
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Maze grid - responsive square that scales down on small screens */}
      <div className="relative w-full max-w-[400px] aspect-square rounded-lg overflow-hidden shadow-xl border-2 border-card">
        <div
          className="grid h-full w-full bg-maze-wall/50"
          style={{
            gridTemplateColumns: `repeat(${maze.width}, 1fr)`,
            gridTemplateRows: `repeat(${maze.height}, 1fr)`,
          }}
        >
          {maze.tiles.map((row) =>
            row.map((tile) => {
              const isPlayer =
                tile.x === playerPosition.x && tile.y === playerPosition.y;
              const isEntrance =
                tile.x === maze.entrance.x && tile.y === maze.entrance.y;
              const isExit = tile.x === maze.exit.x && tile.y === maze.exit.y;
              const pickup = pickupMarkers[`${tile.x},${tile.y}`];
              const tileBg = getTileBackground(tile);

              return (
                <div
                  key={`${tile.x}-${tile.y}`}
                  className={tileBg.className}
                  style={tileBg.style}
                  data-testid={`tile-${tile.x}-${tile.y}`}
                >
                  {tile.fog !== "hidden" && (
                    <>
                      {isEntrance && (
                        <img
                          src={ENTRANCE_SPRITE_URL}
                          alt="Entrance"
                          className="absolute inset-0 m-auto h-[90%] w-[90%] object-contain pointer-events-none drop-shadow-sm z-[2]"
                        />
                      )}
                      {isExit && (
                        <img
                          src={EXIT_SPRITE_URL}
                          alt="Exit"
                          className="absolute inset-0 m-auto h-[90%] w-[90%] object-contain pointer-events-none drop-shadow-sm z-[2]"
                        />
                      )}
                      {pickup && !isPlayer && (
                        <img
                          src={getPickupImage(pickup.kind, pickup.weaponName)}
                          alt={getPickupVisual(pickup.kind).label}
                          title={
                            pickup.kind === "weapon" && pickup.weaponName
                              ? pickup.weaponName
                              : getPickupVisual(pickup.kind).label
                          }
                          className="absolute inset-0 m-auto h-[95%] w-[95%] object-contain pointer-events-none drop-shadow z-[5]"
                        />
                      )}
                      {isPlayer && (
                        <img
                          src={PLAYER_SPRITE_URL}
                          alt="You"
                          title="You"
                          className="absolute inset-0 m-auto h-full w-full object-contain pointer-events-none drop-shadow z-10 animate-pulse"
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* D-pad controls below the maze (true 3x3 cross, mobile-friendly) */}
      <div className="grid grid-cols-3 gap-1.5" data-testid="dpad-controls">
        <div />
        <Button
          size="icon"
          variant={canMoveInDirection("up") ? "default" : "outline"}
          disabled={!canMoveInDirection("up")}
          onClick={() => onMove?.("up")}
          data-testid="button-move-up"
          className="h-11 w-11"
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
        <div />
        <Button
          size="icon"
          variant={canMoveInDirection("left") ? "default" : "outline"}
          disabled={!canMoveInDirection("left")}
          onClick={() => onMove?.("left")}
          data-testid="button-move-left"
          className="h-11 w-11"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div />
        <Button
          size="icon"
          variant={canMoveInDirection("right") ? "default" : "outline"}
          disabled={!canMoveInDirection("right")}
          onClick={() => onMove?.("right")}
          data-testid="button-move-right"
          className="h-11 w-11"
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
        <div />
        <Button
          size="icon"
          variant={canMoveInDirection("down") ? "default" : "outline"}
          disabled={!canMoveInDirection("down")}
          onClick={() => onMove?.("down")}
          data-testid="button-move-down"
          className="h-11 w-11"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
        <div />
      </div>

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
