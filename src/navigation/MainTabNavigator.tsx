import React from 'react'
import { MainTabParamList } from './types';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DailyQuestScreen from '../screens/DailyQuestScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ExerciseScreen from '../screens/ExerciseScreen';
import HistoryLogScreen from '../screens/HistoryLogScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';


const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconProps = {
    inactiveName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    activeName: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    color: string;
    size: number;
    focused: boolean;
};

function TabIcon({
    inactiveName,
    activeName,
    color,
    size,
    focused,
}: TabIconProps) {
    return (
        <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
            <MaterialCommunityIcons
                name={focused ? activeName : inactiveName}
                size={focused ? size + 2 : size}
                color={color}
            />
        </View>
    );
}

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
                    tabBarIcon: ({ color, size, focused }) => (
                        <TabIcon
                            inactiveName="clipboard-check-outline"
                            activeName="clipboard-check"
                            size={size}
                            color={color}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="HistoryLog"
                component={HistoryLogScreen}
                options={{
                    // tabBarLabel: 'History',
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size, focused }) => (
                        <TabIcon
                            inactiveName="clock-outline"
                            activeName="clock"
                            size={size}
                            color={color}
                            focused={focused}
                        />
                    ),
                }}
            />
             <Tab.Screen
                name="Exercise"
                component={ExerciseScreen}
                options={{
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size, focused }) => (
                        <TabIcon
                            inactiveName="dumbbell"
                            activeName="weight-lifter"
                            size={size}
                            color={color}
                            focused={focused}
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Leaderboard"
                component={LeaderboardScreen}
                options={{
                    // tabBarLabel: 'Ranking',
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size, focused }) => (
                        <TabIcon
                            inactiveName="medal-outline"
                            activeName="medal"
                            size={size}
                            color={color}
                            focused={focused}
                        />
                    ),
                }}
            />

           

            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarShowLabel: false,
                    tabBarIcon: ({ color, size, focused }) => (
                        <TabIcon
                            inactiveName="account-circle-outline"
                            activeName="account-circle"
                            size={size}
                            color={color}
                            focused={focused}
                        />
                    ),
                }}
            />
        </Tab.Navigator>
    )
}

const styles = StyleSheet.create({
    iconContainer: {
        width: 46,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeIconContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.11)',
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
});

export default MainTabNavigator
