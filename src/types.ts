export type GameStatus = 'setup' | 'playing' | 'elimination' | 'winner';

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  isEliminated: boolean;
}

export interface GameState {
  players: Player[];
  currentTurnIndex: number;
  countryChain: string[];
  status: GameStatus;
}
