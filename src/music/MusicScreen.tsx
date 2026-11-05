import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BackArrow from '../ui/BackArrow';
import { INK, PAPER, WHITE, LINE } from '../theme';
import MusicSettings from './MusicSettings';

export default function MusicScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={s.title}>Muzyka</Text>
      </View>
      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 32 + bottomInset }]} keyboardShouldPersistTaps="handled">
        <MusicSettings />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: { flex: 1, fontSize: 32, fontWeight: '900', color: INK, letterSpacing: -1 },
  body: { padding: 16 },
});
