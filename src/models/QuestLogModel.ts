export interface QuestLogItem {
    id: string;
    hunterId: string;
    logDate: string;
    exerciseName: string;
    completedSets: number;
    completedReps: number;
    targetStat: string;
    createdAt: string;
    status: string;
}

export interface QuestLogPage {
    content: QuestLogItem[];
    totalElements: number;
    totalPages: number;
}

export interface QuestLogApiResponse {
    result: QuestLogPage;
}