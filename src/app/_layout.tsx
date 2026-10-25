import { Stack } from 'expo-router';
import { AlarmProvider } from '../alarm/AlarmProvider';
import { NotesProvider } from '../notes/NotesProvider';
import { RoutineProvider } from '../routine/RoutineProvider';
import { WeatherProvider } from '../weather/WeatherProvider';
import { PAPER } from '../theme';

export default function RootLayout() {
  return (
    <RoutineProvider>
      <NotesProvider>
        <WeatherProvider>
          <AlarmProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: PAPER },
              }}
            >
              <Stack.Screen name="plan-run" options={{ animation: 'fade', gestureEnabled: false }} />
            </Stack>
          </AlarmProvider>
        </WeatherProvider>
      </NotesProvider>
    </RoutineProvider>
  );
}
