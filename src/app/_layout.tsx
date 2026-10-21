import '../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
  InterTight_800ExtraBold,
} from '@expo-google-fonts/inter-tight';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { DbProvider, FirstRunGate } from '@/features/app';
import { ExpensesProvider } from '@/features/expenses';
import { PeriodProvider } from '@/features/period';
import { TransactionFilterProvider } from '@/features/transactions';

// The splash stays up until FirstRunGate (or the database error screen) has decided the landing.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
  });

  if (!loaded && !error) return null;

  return (
    <DbProvider>
      <PeriodProvider>
        <ExpensesProvider>
          <TransactionFilterProvider>
            <StatusBar style="dark" />
            <FirstRunGate />
            <Stack
              screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}
            >
              <Stack.Screen
                name="sheets"
                options={{
                  presentation: 'transparentModal',
                  animation: 'slide_from_bottom',
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </Stack>
          </TransactionFilterProvider>
        </ExpensesProvider>
      </PeriodProvider>
    </DbProvider>
  );
}
