import { Stack } from "expo-router";
import { AlarmProvider } from "../alarm/AlarmProvider";
import { MusicProvider } from "../music/MusicProvider";
import { NewsProvider } from "../news/NewsProvider";
import { NotesProvider } from "../notes/NotesProvider";
import { RoutineProvider } from "../routine/RoutineProvider";
import { BedtimeProvider } from "../sleep/BedtimeProvider";
import { TransitProvider } from "../transit/TransitProvider";
import { WeatherProvider } from "../weather/WeatherProvider";
import { PAPER } from "../theme";
import { ThemeProvider } from "../themeRuntime";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RoutineProvider>
        <NotesProvider>
          <WeatherProvider>
            <NewsProvider>
              <MusicProvider>
                <TransitProvider>
                  <AlarmProvider>
                    <BedtimeProvider>
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          animation: "slide_from_right",
                          contentStyle: { backgroundColor: PAPER },
                        }}
                      >
                        <Stack.Screen
                          name="plan-run"
                          options={{ animation: "fade", gestureEnabled: false }}
                        />
                      </Stack>
                    </BedtimeProvider>
                  </AlarmProvider>
                </TransitProvider>
              </MusicProvider>
            </NewsProvider>
          </WeatherProvider>
        </NotesProvider>
      </RoutineProvider>
    </ThemeProvider>
  );
}
