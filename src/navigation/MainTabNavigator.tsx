import React from 'react'
import { MainTabParamList } from './types';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DailyQuestScreen from '../screens/DailyQuestScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import HunterSearchScreen from '../screens/HunterSearchScreen';
import HistoryLogScreen from '../screens/HistoryLogScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { Feather } from '@expo/vector-icons';


const Tab = createBottomTabNavigator<MainTabParamList>();
function MainTabNavigator() {
    return (
        <Tab.Navigator
            initialRouteName="DailyQuest"
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#ffffff',
                tabBarInactiveTintColor: '#484f58',
                tabBarStyle: {
                    backgroundColor: '#0d1117',
                    borderTopColor: '#21262d',
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            }}
        >
            <Tab.Screen
                name="DailyQuest"
                component={DailyQuestScreen}
                options={{
                    // tabBarLabel: 'Quest',
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="check-square" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="HistoryLog"
                component={HistoryLogScreen}
                options={{
                    // tabBarLabel: 'History',
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="clock" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Leaderboard"
                component={LeaderboardScreen}
                options={{
                    // tabBarLabel: 'Ranking',
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="award" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="HunterSearch"
                component={HunterSearchScreen}
                options={{
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="search" size={size} color={color} />
                    ),
                }}
            />

            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="user" size={size-2} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    )
}

export default MainTabNavigator