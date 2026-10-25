import notifee from '@notifee/react-native';
import 'expo-router/entry';

// Musi być zarejestrowane przy starcie aplikacji, poza drzewem Reacta.
notifee.onBackgroundEvent(async ({ type }) => {
  console.log('Background event:', type);
});
