export interface HunterProfileResponse {
    userName: string;
    hunterCode: string;
    fullName: string;
    age: number;
    currentRp: number;
    rankTier: string;
    currentStreak: number;
    maxStreak: number;
    shieldCount: number;
    strength: number;
    agility: number;
    vitality: number;
    avatar?: string;
    rpToNextRank: number;
    nextRankTier: string | null;
    rankProgressPercent: number;
}
