import { TOPICS } from './constants';

export type GameStatus = 'setup' | 'playing' | 'elimination' | 'winner';

export type TopicKey = keyof typeof TOPICS;

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  isEliminated: boolean;
}

export interface GameState {
  players: Player[];
  currentTurnIndex: number;
  chain: string[];
  status: GameStatus;
  topic: TopicKey;
}

