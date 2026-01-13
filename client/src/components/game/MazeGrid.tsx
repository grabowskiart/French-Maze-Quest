import { Home, Trophy, User } from "lucide-react";
import type { Maze, Position } from "@shared/schema";

interface MazeGridProps {
  maze: Maze;
  playerPosition: Position;
  isMoving: boolean;
  remainingSteps: number;
  onTileClick: (x: number, y: number) => void;
}

export function MazeGrid({
  maze,
  playerPosition,
  isMoving,
  remainingSteps,
  onTileClick,
}: MazeGridProps) {
  const viewportSize = 7;
  const halfViewport = Math.floor(viewportSize / 2);

  const startX = Math.max(0, Math.min(playerPosition.x - halfViewport, maze.width - viewportSize));
  const startY = Math.max(0, Math.min(playerPosition.y - halfViewport, maze.height - viewportSize));
  const endX = Math.min(startX + viewportSize, maze.width);
  const endY = Math.min(startY + viewportSize, maze.height);

  const visibleTiles: typeof maze.tiles = [];
  for (let y = startY; y < endY; y++) {
    const row: typeof maze.tiles[0] = [];
    for (let x = startX; x < endX; x++) {
      row.push(maze.tiles[y][x]);
    }
    visibleTiles.push(row);
  }

  const isAdjacent = (x: number, y: number) => {
    const dx = Math.abs(x - playerPosition.x);
    const dy = Math.abs(y - playerPosition.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  };

  const getTileClasses = (tile: typeof maze.tiles[0][0], isPlayer: boolean) => {
    const baseClasses = "relative flex items-center justify-center transition-all duration-300";

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
    const clickableClass =
      isMoving && isAdjacent(tile.x, tile.y) && remainingSteps > 0
        ? "cursor-pointer ring-2 ring-primary ring-offset-2 ring-offset-background"
        : "";

    return `${baseClasses} ${bgClass} ${visibilityClass} ${clickableClass}`;
  };

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto">
      <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl border-4 border-card">
        <div
          className="grid h-full w-full gap-0.5 bg-maze-wall/50 p-0.5"
          style={{
            gridTemplateColumns: `repeat(${endX - startX}, 1fr)`,
            gridTemplateRows: `repeat(${endY - startY}, 1fr)`,
          }}
        >
          {visibleTiles.map((row, rowIndex) =>
            row.map((tile, colIndex) => {
              const isPlayer =
                tile.x === playerPosition.x && tile.y === playerPosition.y;
              const isEntrance =
                tile.x === maze.entrance.x && tile.y === maze.entrance.y;
              const isExit = tile.x === maze.exit.x && tile.y === maze.exit.y;
              const canClick =
                isMoving &&
                isAdjacent(tile.x, tile.y) &&
                tile.type !== "wall" &&
                tile.fog !== "hidden" &&
                remainingSteps > 0;

              return (
                <div
                  key={`${tile.x}-${tile.y}`}
                  className={getTileClasses(tile, isPlayer)}
                  onClick={() => canClick && onTileClick(tile.x, tile.y)}
                  data-testid={`tile-${tile.x}-${tile.y}`}
                  role={canClick ? "button" : undefined}
                  tabIndex={canClick ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (canClick && (e.key === "Enter" || e.key === " ")) {
                      onTileClick(tile.x, tile.y);
                    }
                  }}
                >
                  {tile.fog !== "hidden" && (
                    <>
                      {isPlayer && (
                        <div className="absolute inset-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg animate-bounce z-10">
                          <User className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                      )}
                      {isEntrance && !isPlayer && (
                        <Home className="w-4 h-4 sm:w-5 sm:h-5 text-maze-entrance" />
                      )}
                      {isExit && !isPlayer && (
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-maze-exit" />
                      )}
                    </>
                  )}

                  {tile.fog === "hidden" && (
                    <div className="absolute inset-0 bg-gradient-to-br from-maze-fog/90 to-maze-fog" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {isMoving && remainingSteps > 0 && (
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-display font-bold text-sm shadow-lg">
            {remainingSteps} step{remainingSteps !== 1 ? "s" : ""} left
          </div>
        </div>
      )}
    </div>
  );
}
