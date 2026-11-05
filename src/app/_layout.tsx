import { Stack } from 'expo-router';
import { AlarmProvider } from '../alarm/AlarmProvider';
import { MusicProvider } from '../music/MusicProvider';
import { NewsProvider } from '../news/NewsProvider';
import { NotesProvider } from '../notes/NotesProvider';
import { RoutineProvider } from '../routine/RoutineProvider';
import { BedtimeProvider } from '../sleep/BedtimeProvider';
import { WeatherProvider } from '../weather/WeatherProvider';
import { PAPER } from '../theme';

export default function RootLayout() {
  return (
    <RoutineProvider>
      <NotesProvider>
        <WeatherProvider>
          <NewsProvider>
            <MusicProvider>
              <AlarmProvider>
                <BedtimeProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      animation: 'slide_from_right',
                      contentStyle: { backgroundColor: PAPER },
                    }}
                  >
                    <Stack.Screen name="plan-run" options={{ animation: 'fade', gestureEnabled: false }} />
                  </Stack>
                </BedtimeProvider>
              </AlarmProvider>
            </MusicProvider>
          </NewsProvider>
        </WeatherProvider>
      </NotesProvider>
    </RoutineProvider>
  );
}
