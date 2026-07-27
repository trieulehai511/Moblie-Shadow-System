import { NavigatorScreenParams } from "@react-navigation/native";


export type MainTabParamList ={
    DailyQuest: undefined;
    Leaderboard: undefined;
    HistoryLog: undefined;
    Exercise: undefined;
    Profile: undefined;
}

export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    MainApp: NavigatorScreenParams<MainTabParamList>;
}
