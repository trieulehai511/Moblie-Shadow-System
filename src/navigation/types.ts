import { NavigatorScreenParams } from "@react-navigation/native";


export type MainTabParamList ={
    DailyQuest: undefined;
    Leaderboard: undefined;
    HistoryLog: undefined;
    HunterSearch: undefined;
    Profile: undefined;
}

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    MainApp: NavigatorScreenParams<MainTabParamList>;
}