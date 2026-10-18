import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Switch, TouchableOpacity, Alert, Platform, Modal, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { TriggerType, AndroidImportance, EventType, TimestampTrigger, AndroidCategory } from '@notifee/react-native';

notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Background event:', type);
});

interface Alarm {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
}

export default function App() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [alarmLabel, setAlarmLabel] = useState('');
  
  // Stan przechowujący dzwoniący alarm
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);

  useEffect(() => {
    setupPermissions().catch(console.error);
    loadAlarms().catch(console.error);

    const checkActiveAlarms = async () => {
      const displayed = await notifee.getDisplayedNotifications();
      const alarmNotif = displayed.find(n => n.notification.data?.alarmId);
      if (alarmNotif && alarmNotif.notification.data?.alarmId) {
        triggerAlarmScreen(alarmNotif.notification.data.alarmId as string);
      }
    };

    checkActiveAlarms();

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkActiveAlarms();
      }
    });

    // 3. Zabezpieczenie na wypadek ręcznego kliknięcia (gdyby telefon był odblokowany)
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.ACTION_PRESS) {
        if (detail.notification?.data?.alarmId) {
          triggerAlarmScreen(detail.notification.data.alarmId as string);
        }
      }
    });

    return () => {
      appStateSubscription.remove();
      unsubscribe();
    };
  }, [alarms]);

  // Sprawdza czy aplikacja została zimno "wybudzona" przez Full Screen Intent
  const checkIfOpenedByAlarm = async () => {
    const initialNotification = await notifee.getInitialNotification();
    if (initialNotification?.notification?.data?.alarmId) {
      triggerAlarmScreen(initialNotification.notification.data.alarmId as string);
    }
  };

  const triggerAlarmScreen = (alarmId: string) => {
    const triggeredAlarm = alarms.find(a => a.id === alarmId);
    if (triggeredAlarm) {
      setActiveAlarm(triggeredAlarm);
    } else {
      // Zabezpieczenie (gdyby alarm został usunięty, ale zadzwonił)
      setActiveAlarm({ id: alarmId, time: '??:??', enabled: true, label: 'Pobudka!' });
    }
  };

  const setupPermissions = async () => {
    await notifee.requestPermission();
  };

  const loadAlarms = async () => {
    try {
      const stored = await AsyncStorage.getItem('alarms');
      if (stored) setAlarms(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  };

  const saveAlarms = async (newAlarms: Alarm[]) => {
    await AsyncStorage.setItem('alarms', JSON.stringify(newAlarms));
    setAlarms(newAlarms);
  };

  const scheduleNotification = async (timeStr: string, label: string, alarmId: string) => {
    try {
      const channelId = await notifee.createChannel({
        id: 'urgent_alarm',
        name: 'Budzik Pełnoekranowy',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });

      const [hours, minutes] = timeStr.split(':').map(Number);
      const triggerDate = new Date();
      triggerDate.setHours(hours, minutes, 0, 0);

      if (triggerDate <= new Date()) {
        triggerDate.setDate(triggerDate.getDate() + 1);
      }

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        alarmManager: {
          allowWhileIdle: true,
        },
      };

      await notifee.createTriggerNotification({
        id: alarmId,
        title: label || 'Pobudka!',
        body: 'Kliknij, aby wyłączyć',
        data: { alarmId },
        android: {
          channelId,
          category: AndroidCategory.ALARM,
          autoCancel: false,
          ongoing: true,
          fullScreenAction: {
            id: 'default',
          },
          pressAction: {
            id: 'default',
          },
        },
      }, trigger);
    } catch (error: any) {
      if (error.message && error.message.includes('exact_alarm_not_permitted')) {
        Alert.alert(
          'Wymagane uprawnienia',
          'Aby budzik wybudzał ekran punktualnie, musisz zezwolić aplikacji na "Ustawianie dokładnych alarmów" w ustawieniach systemu.',
          [
            { text: 'Anuluj' },
            { text: 'Otwórz Ustawienia', onPress: async () => await notifee.openAlarmPermissionSettings() }
          ]
        );
      } else {
        console.error('Błąd tworzenia alarmu:', error);
      }
    }
  };

  const addAlarm = async () => {
    if (!alarmLabel.trim()) {
      Alert.alert('Błąd', 'Wpisz nazwę alarmu');
      return;
    }

    const newAlarmId = Date.now().toString();
    const timeStr = formatTime(selectedTime);
    
    await scheduleNotification(timeStr, alarmLabel, newAlarmId);

    const newAlarm: Alarm = {
      id: newAlarmId,
      time: timeStr,
      enabled: true,
      label: alarmLabel,
    };

    const updatedAlarms = [...alarms, newAlarm];
    await saveAlarms(updatedAlarms);
    
    setAlarmLabel('');
    setShowTimePicker(false);
  };

  const toggleAlarm = async (id: string) => {
    const updated = [...alarms];
    const index = updated.findIndex(a => a.id === id);
    if (index === -1) return;

    const alarm = updated[index];
    alarm.enabled = !alarm.enabled;

    if (alarm.enabled) {
      await scheduleNotification(alarm.time, alarm.label, alarm.id);
    } else {
      await notifee.cancelNotification(alarm.id);
    }

    await saveAlarms(updated);
  };

  const deleteAlarm = async (id: string) => {
    await notifee.cancelNotification(id);
    const updated = alarms.filter(a => a.id !== id);
    await saveAlarms(updated);
  };

  const turnOffAlarm = async () => {
    if (activeAlarm) {
      // Usuwa wnerwiające powiadomienie systemowe i chowa ekran
      await notifee.cancelNotification(activeAlarm.id);
      setActiveAlarm(null);
    }
  };

  const formatTime = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Budzik Natywny</Text>

      <Modal visible={activeAlarm !== null} animationType="slide">
        <View style={styles.activeAlarmContainer}>
          <Text style={styles.activeAlarmTitle}>{activeAlarm?.time}</Text>
          <Text style={styles.activeAlarmLabel}>{activeAlarm?.label}</Text>
          
          <TouchableOpacity style={styles.stopButton} onPress={turnOffAlarm}>
            <Text style={styles.stopButtonText}>WYŁĄCZ (Tymczasowe)</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {showTimePicker && (
        <View style={styles.timePickerContainer}>
          <View style={styles.timePickerRow}>
            <View style={styles.timeColumn}>
              <TouchableOpacity onPress={() => setSelectedTime(new Date(selectedTime.setHours((selectedTime.getHours() + 1) % 24)))} style={styles.timeButton}><Text style={styles.timeButtonText}>+</Text></TouchableOpacity>
              <Text style={styles.timeDisplay}>{selectedTime.getHours().toString().padStart(2, '0')}</Text>
              <TouchableOpacity onPress={() => setSelectedTime(new Date(selectedTime.setHours((selectedTime.getHours() - 1 + 24) % 24)))} style={styles.timeButton}><Text style={styles.timeButtonText}>−</Text></TouchableOpacity>
            </View>
            <Text style={styles.timeSeparator}>:</Text>
            <View style={styles.timeColumn}>
              <TouchableOpacity onPress={() => setSelectedTime(new Date(selectedTime.setMinutes((selectedTime.getMinutes() + 1) % 60)))} style={styles.timeButton}><Text style={styles.timeButtonText}>+</Text></TouchableOpacity>
              <Text style={styles.timeDisplay}>{selectedTime.getMinutes().toString().padStart(2, '0')}</Text>
              <TouchableOpacity onPress={() => setSelectedTime(new Date(selectedTime.setMinutes((selectedTime.getMinutes() - 1 + 60) % 60)))} style={styles.timeButton}><Text style={styles.timeButtonText}>−</Text></TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.confirmButton} onPress={() => setShowTimePicker(false)}>
            <Text style={styles.confirmButtonText}>Gotowe</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={() => setShowTimePicker(!showTimePicker)}>
        <Text style={styles.buttonText}>Wybrany czas: {formatTime(selectedTime)}</Text>
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <TextInput style={styles.input} value={alarmLabel} onChangeText={setAlarmLabel} placeholder="Nazwa alarmu..." />
      </View>

      <TouchableOpacity style={styles.addButton} onPress={addAlarm}>
        <Text style={styles.addButtonText}>Dodaj alarm</Text>
      </TouchableOpacity>

      <FlatList
        data={alarms}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.alarmItem}>
            <View style={styles.alarmInfo}>
              <Text style={styles.alarmTime}>{item.time}</Text>
              <Text style={styles.alarmLabel}>{item.label}</Text>
            </View>
            <Switch value={item.enabled} onValueChange={() => toggleAlarm(item.id)} />
            <TouchableOpacity onPress={() => deleteAlarm(item.id)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Usuń</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 40, backgroundColor: '#f5f5f5' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  timePickerContainer: { backgroundColor: 'white', padding: 20, borderRadius: 8, marginBottom: 15 },
  timePickerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  timeColumn: { alignItems: 'center' },
  timeButton: { backgroundColor: '#007AFF', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginVertical: 5 },
  timeButtonText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  timeDisplay: { fontSize: 40, fontWeight: 'bold', color: '#333', minWidth: 60, textAlign: 'center' },
  timeSeparator: { fontSize: 40, fontWeight: 'bold', marginHorizontal: 10, color: '#333' },
  confirmButton: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, marginBottom: 15 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  inputContainer: { marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: 'white' },
  addButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, marginBottom: 20 },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  alarmItem: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 10, alignItems: 'center' },
  alarmInfo: { flex: 1 },
  alarmTime: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  alarmLabel: { fontSize: 14, color: '#666', marginTop: 5 },
  deleteButton: { backgroundColor: '#f44336', padding: 8, borderRadius: 5, marginLeft: 15 },
  deleteText: { color: 'white', fontSize: 12 },
  
  activeAlarmContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 20 },
  activeAlarmTitle: { fontSize: 72, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  activeAlarmLabel: { fontSize: 24, color: '#ccc', marginBottom: 50 },
  stopButton: { backgroundColor: '#ff3b30', paddingVertical: 20, paddingHorizontal: 40, borderRadius: 100, width: '100%', alignItems: 'center' },
  stopButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' }
});