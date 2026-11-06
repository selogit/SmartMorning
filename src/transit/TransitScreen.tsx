import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BackArrow from '../ui/BackArrow';
import { INK, PAPER, WHITE, LINE } from '../theme';
import { useTransit } from './TransitProvider';
import TripStatusList from './TripStatusList';
import TransitManager from './TransitManager';

export default function TransitScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { refresh } = useTransit();
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    refresh();
  }, []);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={s.title}>Dojazd</Text>
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 32 + bottomInset }]} keyboardShouldPersistTaps="handled">
        <TripStatusList />
        <View style={{ height: 16 }} />
        <TransitManager />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAPER, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: LINE, borderBottomColor: INK },
  backButton: { width: 44, height: 44, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { flex: 1, fontSize: 32, fontWeight: '900', color: INK, letterSpacing: -1 },
  body: { padding: 16 },
});
