
export type CellType = 'EMPTY' | 'GOAL' | 'PIT';

export const GRID_SIZE = 20;

export interface State {
  x: number;
  y: number;
}

export type Action = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export const ACTIONS: Action[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

export class GridWorld {
  grid: CellType[][];
  startPos: State;

  constructor(size: number = GRID_SIZE) {
    this.grid = Array(size).fill(null).map(() => Array(size).fill('EMPTY'));
    this.startPos = { x: 0, y: 0 };

    // Initialize with some default layout
    this.grid[15][15] = 'GOAL';
    this.grid[10][10] = 'PIT';
    this.grid[5][15] = 'PIT';
    this.grid[15][5] = 'PIT';
  }

  setCell(x: number, y: number, type: CellType) {
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      this.grid[x][y] = type;
    }
  }

  getCell(x: number, y: number): CellType {
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
      return this.grid[x][y];
    }
    return 'EMPTY'; // Out of bounds treated as wall/neutral for now, logic handled in step
  }

  getReward(x: number, y: number): number {
    const cell = this.getCell(x, y);
    if (cell === 'GOAL') return 10;
    if (cell === 'PIT') return -10;
    return -0.1;
  }
}

export class QLearner {
  qTable: Float32Array; // Flattened 3D array: [x][y][action_index]
  size: number;
  alpha: number; // Learning rate
  gamma: number; // Discount factor
  epsilon: number; // Exploration rate

  constructor(size: number = GRID_SIZE, alpha = 0.1, gamma = 0.9, epsilon = 0.1) {
    this.size = size;
    this.alpha = alpha;
    this.gamma = gamma;
    this.epsilon = epsilon;
    // 4 actions per cell
    this.qTable = new Float32Array(size * size * 4);
  }

  getIndex(x: number, y: number, actionIdx: number): number {
    return (x * this.size + y) * 4 + actionIdx;
  }

  getQ(x: number, y: number, actionIdx: number): number {
    return this.qTable[this.getIndex(x, y, actionIdx)];
  }

  setQ(x: number, y: number, actionIdx: number, value: number) {
    this.qTable[this.getIndex(x, y, actionIdx)] = value;
  }

  getMaxQ(x: number, y: number): number {
    let maxQ = -Infinity;
    for (let i = 0; i < 4; i++) {
      const q = this.getQ(x, y, i);
      if (q > maxQ) maxQ = q;
    }
    // If all are 0 (initial), return 0
    return maxQ === -Infinity ? 0 : maxQ;
  }

  chooseAction(x: number, y: number): number {
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * 4);
    }

    let maxQ = -Infinity;
    let bestActions: number[] = [];

    for (let i = 0; i < 4; i++) {
      const q = this.getQ(x, y, i);
      if (q > maxQ) {
        maxQ = q;
        bestActions = [i];
      } else if (q === maxQ) {
        bestActions.push(i);
      }
    }

    return bestActions[Math.floor(Math.random() * bestActions.length)];
  }

  update(x: number, y: number, actionIdx: number, reward: number, nextX: number, nextY: number) {
    const currentQ = this.getQ(x, y, actionIdx);
    const maxNextQ = this.getMaxQ(nextX, nextY);

    // Q(s,a) = Q(s,a) + alpha * (R + gamma * max(Q(s',a')) - Q(s,a))
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    this.setQ(x, y, actionIdx, newQ);
  }

  reset() {
      this.qTable.fill(0);
  }
}
