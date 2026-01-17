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

  // Use iterative DFS with a stack to avoid recursion issues and ensure proper branching
  function carveMaze() {
    const stack: Position[] = [];
    const visited = new Set<string>();
    
    const getKey = (x: number, y: number) => `${x},${y}`;
    
    // Start from the entrance
    tiles[startY][startX].type = "path";
    stack.push({ x: startX, y: startY });
    visited.add(getKey(startX, startY));
    
    const directions = [
      { dx: 0, dy: -2 }, // up
      { dx: 2, dy: 0 },  // right
      { dx: 0, dy: 2 },  // down
      { dx: -2, dy: 0 }, // left
    ];
    
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      
      // Get unvisited neighbors
      const unvisitedNeighbors: { x: number; y: number; wallX: number; wallY: number }[] = [];
      
      for (const { dx, dy } of directions) {
        const newX = current.x + dx;
        const newY = current.y + dy;
        const wallX = current.x + dx / 2;
        const wallY = current.y + dy / 2;
        
        if (
          newX > 0 &&
          newX < width - 1 &&
          newY > 0 &&
          newY < height - 1 &&
          !visited.has(getKey(newX, newY))
        ) {
          unvisitedNeighbors.push({ x: newX, y: newY, wallX, wallY });
        }
      }
      
      if (unvisitedNeighbors.length > 0) {
        // Randomly choose a neighbor
        const randomIndex = Math.floor(Math.random() * unvisitedNeighbors.length);
        const chosen = unvisitedNeighbors[randomIndex];
        
        // Carve path to the chosen neighbor
        tiles[chosen.wallY][chosen.wallX].type = "path";
        tiles[chosen.y][chosen.x].type = "path";
        
        visited.add(getKey(chosen.x, chosen.y));
        stack.push({ x: chosen.x, y: chosen.y });
      } else {
        // Backtrack
        stack.pop();
      }
    }
  }

  carveMaze();

  // Add extra loops/connections to create multiple paths (about 5-10% of walls between paths)
  const loopChance = 0.08;
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y][x].type === "wall") {
        // Check if this wall separates two path cells (horizontally or vertically)
        const horizontalPaths = 
          x > 0 && x < width - 1 &&
          tiles[y][x - 1].type === "path" && 
          tiles[y][x + 1].type === "path";
        const verticalPaths = 
          y > 0 && y < height - 1 &&
          tiles[y - 1][x].type === "path" && 
          tiles[y + 1][x].type === "path";
        
        if ((horizontalPaths || verticalPaths) && Math.random() < loopChance) {
          tiles[y][x].type = "path";
        }
      }
    }
  }

  const entrance: Position = { x: startX, y: startY };
  tiles[entrance.y][entrance.x].type = "entrance";

  // Find exit using BFS to get actual path distance, not just Manhattan distance
  let exit: Position = { x: startX, y: startY };
  let maxDistance = 0;
  
  // BFS to find distances from entrance
  const distances = new Map<string, number>();
  const queue: Position[] = [entrance];
  distances.set(`${entrance.x},${entrance.y}`, 0);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = distances.get(`${current.x},${current.y}`)!;
    
    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ];
    
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (
        neighbor.x >= 0 && neighbor.x < width &&
        neighbor.y >= 0 && neighbor.y < height &&
        tiles[neighbor.y][neighbor.x].type === "path" &&
        !distances.has(key)
      ) {
        distances.set(key, currentDist + 1);
        queue.push(neighbor);
        
        if (currentDist + 1 > maxDistance) {
          maxDistance = currentDist + 1;
          exit = neighbor;
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
  const newTiles: Tile[][] = maze.tiles.map((row) =>
    row.map((tile) => ({
      ...tile,
      fog: tile.fog === "visible" ? "seen" : tile.fog,
    } as Tile))
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
