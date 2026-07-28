export interface LeaderboardHunter {
  position: number;
  hunterCode: string;
  fullName: string;
  avatar: string | null;
  currentRp: number;
  rankTier: string;
  currentStreak: number;
}

export interface LeaderboardResponse {
  code: number;
  result: LeaderboardHunter[];
}