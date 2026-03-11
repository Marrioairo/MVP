export interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
  isActive: boolean; // True si está convocado para el partido (max 12)
  isStarter: boolean; // True si es titular (max 5)
  height?: string;
  weight?: string;
  age?: string;
  teamId?: string;
}

export interface MatchEvent {
  id?: string;
  type: string;
  playerId: string;
  playerName?: string;
  team: "home" | "away";
  quarter: number;
  time: string;
  timestamp: any;
}

export interface TeamRoster {
  id: string;
  name: string;
  players: Player[]; // Max 24
}
