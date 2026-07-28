import api from './api';
import {
  LeaderboardHunter,
  LeaderboardResponse,
} from '../models/LeaderboardModel';


export async function getLeaderboard(): Promise<LeaderboardHunter[]> {
    const response = await api.get<LeaderboardResponse>('/leaderboard');
    return response.data.result ?? [];

}