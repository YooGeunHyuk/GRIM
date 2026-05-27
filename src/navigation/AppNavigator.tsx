import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { RootStackParamList } from '../types';
import WriteScreen from '../screens/WriteScreen';
import CalendarScreen from '../screens/CalendarScreen';
import DetailScreen from '../screens/DetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabItem({
  iconName,
  label,
  focused,
}: {
  iconName: keyof typeof Feather.glyphMap;
  label: string;
  focused: boolean;
}) {
  const color = focused ? '#C97B4A' : '#9B8979';
  return (
    <View style={styles.tabItem}>
      <Feather name={iconName} size={20} color={color} />
      <Text style={[styles.tabLabel, { color }, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Write"
        component={WriteScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem iconName="edit-3" label="쓰기" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabItem iconName="book-open" label="목록" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFDF8',
    borderTopWidth: 1,
    borderTopColor: '#ECE2D3',
    height: 96,
    paddingBottom: 24,
    paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  tabLabelFocused: {
    fontWeight: '700',
  },
});
