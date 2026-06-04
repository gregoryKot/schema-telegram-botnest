export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  frame: number;
  frameTimer: number;
}

export interface EnemyInstance {
  id: string;
  x: number;
  y: number;
  patrolMin: number;
  patrolMax: number;
  dir: 1 | -1;
  understood: boolean;
  alpha: number; // fades to 0.3 after understood
}

export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameState {
  player: Player;
  enemies: EnemyInstance[];
  platforms: Platform[];
  phase: 'playing' | 'paused' | 'victory';
  hitEnemyId: string | null;
  world: 1 | 2 | 3;
  cameraX: number;
  doorX: number;
  levelW: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean; // edge trigger
}
