import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import LockGate from './src/screens/LockGate';
import { useAppFonts } from './src/lib/useAppFonts';

export default function App() {
  const fontsLoaded = useAppFonts();
  if (!fontsLoaded) return null; // Splash screen 유지 (expo-splash-screen 자동)

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
