import type { Maze, Tile, Position } from "@shared/schema";

export function generateMaze(width: number, height: number): Maze {
  const tiles: Tile[][] = [];

  for (let y = 0; y < height; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        type: "wall",
        fog: "hidden",
        x,
        y,
      });
    }
    tiles.push(row);
  }

  const startX = 1;
  const startY = 1;

  function carvePath(x: number, y: number) {
    tiles[y][x].type = "path";

    const directions = [
      { dx: 0, dy: -2 },
      { dx: 2, dy: 0 },
      { dx: 0, dy: 2 },
      { dx: -2, dy: 0 },
    ];

    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    for (const { dx, dy } of directions) {
      const newX = x + dx;
      const newY = y + dy;

      if (
        newX > 0 &&
        newX < width - 1 &&
        newY > 0 &&
        newY < height - 1 &&
        tiles[newY][newX].type === "wall"
      ) {
        tiles[y + dy / 2][x + dx / 2].type = "path";
        carvePath(newX, newY);
      }
    }
  }

  carvePath(startX, startY);

  const entrance: Position = { x: startX, y: startY };
  tiles[entrance.y][entrance.x].type = "entrance";

  let exit: Position = { x: startX, y: startY };
  let maxDistance = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x].type === "path") {
        const distance = Math.abs(x - entrance.x) + Math.abs(y - entrance.y);
        if (distance > maxDistance) {
          maxDistance = distance;
          exit = { x, y };
        }
      }
    }
  }

  tiles[exit.y][exit.x].type = "exit";

  return {
    width,
    height,
    tiles,
    entrance,
    exit,
  };
}

export function revealTiles(
  maze: Maze,
  center: Position,
  radius: number,
  setVisible: boolean = true
): Maze {
  const newTiles = maze.tiles.map((row) =>
    row.map((tile) => ({ ...tile }))
  );

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = center.x + dx;
      const y = center.y + dy;

      if (x >= 0 && x < maze.width && y >= 0 && y < maze.height) {
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= radius) {
          if (setVisible) {
            newTiles[y][x].fog = "visible";
          } else if (newTiles[y][x].fog === "hidden") {
            newTiles[y][x].fog = "seen";
          }
        }
      }
    }
  }

  return {
    ...maze,
    tiles: newTiles,
  };
}

export function updateVisibility(maze: Maze, playerPos: Position, visibilityRadius: number): Maze {
  const newTiles = maze.tiles.map((row) =>
    row.map((tile) => ({
      ...tile,
      fog: tile.fog === "visible" ? ("seen" as const) : tile.fog,
    }))
  );

  for (let dy = -visibilityRadius; dy <= visibilityRadius; dy++) {
    for (let dx = -visibilityRadius; dx <= visibilityRadius; dx++) {
      const x = playerPos.x + dx;
      const y = playerPos.y + dy;

      if (x >= 0 && x < maze.width && y >= 0 && y < maze.height) {
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= visibilityRadius) {
          newTiles[y][x].fog = "visible";
        }
      }
    }
  }

  return {
    ...maze,
    tiles: newTiles,
  };
}
