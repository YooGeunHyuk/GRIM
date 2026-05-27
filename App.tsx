import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import LockGate from './src/screens/LockGate';

export default function App() {
  return (
    <SafeAreaProvider>
      <LockGate>
        <NavigationContainer>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </LockGate>
    </SafeAreaProvider>
  );
}
