import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

const STORAGE_KEY = '@activesense_notifications_list';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type NotificationCategory =
  | 'HEALTH TIP'
  | 'MOTIVATION'
  | 'POSTURE AI'
  | 'HABIT'
  | 'ANALYTICS';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  category: NotificationCategory;
  actionText?: string;
  iconName: React.ComponentProps<typeof Feather>['name'];
  accentColor: string;
}

const REALISTIC_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'The 20-20-20 Screen Rule 👁️',
    message: 'Every 20 mins, look 20 feet away for 20 seconds. It eases eye fatigue and stops forward head tilt.',
    time: '10m ago',
    read: false,
    category: 'HEALTH TIP',
    actionText: 'Start 60s Reset',
    iconName: 'eye',
    accentColor: '#10B981',
  },
  {
    id: '2',
    title: 'We Miss Your Alignment Streak! ✨',
    message: "You're only 1 quick session away from hitting your Weekly Mobility Goal. Jump back in for 2 minutes!",
    time: '1h ago',
    read: false,
    category: 'MOTIVATION',
    actionText: 'Resume Session',
    iconName: 'zap',
    accentColor: '#F59E0B',
  },
  {
    id: '3',
    title: 'Decompress Your Spinal Discs 💧',
    message: 'Long sitting compresses intervertebral discs. Grab a glass of water and try a 1-minute thoracic stretch.',
    time: '3h ago',
    read: false,
    category: 'HEALTH TIP',
    actionText: 'Open Stretch Guide',
    iconName: 'droplet',
    accentColor: '#06B6D4',
  },
  {
    id: '4',
    title: 'Diaphragmatic Core Reset 🫁',
    message: 'Shallow chest breathing locks up shoulder muscles. Take 3 guided deep belly breaths on ActiveSense.',
    time: 'Yesterday',
    read: true,
    category: 'HABIT',
    actionText: 'Start 1-Min Breathe',
    iconName: 'wind',
    accentColor: '#8B5CF6',
  },
  {
    id: '5',
    title: 'Desk Geometry Check 🪑',
    message: 'To eliminate lower back strain, ensure your hips sit slightly higher than your knees while seated.',
    time: '2d ago',
    read: true,
    category: 'POSTURE AI',
    actionText: 'Check Camera Setup',
    iconName: 'compass',
    accentColor: colors.primary.teal,
  },
];

export default function NotificationsScreen() {
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const unreadCount = notifications.filter((item) => !item.read).length;

  // 1. Load saved notifications on mount (or seed initial defaults)
  useEffect(() => {
    const loadStoredNotifications = async () => {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData !== null) {
          setNotifications(JSON.parse(savedData));
        } else {
          // First time opening the app: save defaults
          setNotifications(REALISTIC_NOTIFICATIONS);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(REALISTIC_NOTIFICATIONS));
        }
      } catch (e) {
        setNotifications(REALISTIC_NOTIFICATIONS);
      } finally {
        setIsLoaded(true);
      }
    };

    loadStoredNotifications();
    checkInitialPermissions();

    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      const newNotif: NotificationItem = {
        id: Date.now().toString(),
        title: title || 'Posture Reset Time 🧘',
        message: body || 'Time to jump back on ActiveSense for a quick stretch!',
        time: 'Just now',
        read: false,
        category: 'HEALTH TIP',
        actionText: 'Open App',
        iconName: 'heart',
        accentColor: colors.primary.teal,
      };

      setNotifications((prev) => {
        const updated = [newNotif, ...prev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    });

    return () => notificationSubscription.remove();
  }, []);

  // Helper to update state and storage simultaneously
  const updateNotificationsState = async (newList: NotificationItem[]) => {
    setNotifications(newList);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save notifications', e);
    }
  };

  const checkInitialPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      setWorkoutReminders(true);
      setWeeklyReports(true);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (!Device.isDevice) {
      Alert.alert('Notice', 'Must use a physical device for full notification functionality.');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please enable notifications in your device settings to receive reminders.'
      );
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: colors.primary.teal,
      });
    }

    return true;
  };

  const handleWorkoutReminderToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestPermissions();
      if (granted) {
        setWorkoutReminders(true);
        await scheduleSampleNotification();
      } else {
        setWorkoutReminders(false);
      }
    } else {
      setWorkoutReminders(false);
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const handleWeeklyReportsToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestPermissions();
      if (granted) {
        setWeeklyReports(true);
      } else {
        setWeeklyReports(false);
      }
    } else {
      setWeeklyReports(false);
    }
  };

  const scheduleSampleNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for a 60-Second Posture Break! 🧘‍♂️',
        body: 'Roll your shoulders back and open ActiveSense for a quick alignment check.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 4,
      },
    });
  };

  const markAllAsRead = () => {
    const updated = notifications.map((item) => ({ ...item, read: true }));
    updateNotificationsState(updated);
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
    updateNotificationsState(updated);
  };

  const clearAllNotifications = () => {
    updateNotificationsState([]);
  };

  const handleActionPress = (item: NotificationItem) => {
    markAsRead(item.id);
    Alert.alert('ActiveSense Action', `Opening: ${item.actionText || 'Feature'}`);
  };

  if (!isLoaded) {
    return null; // Or a subtle loading spinner
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        {/* Preference Controls */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>Posture & Workout Reminders</Text>
              <Text style={styles.rowSubtitle}>Smart alerts for sitting breaks & posture checks</Text>
            </View>
            <Switch
              value={workoutReminders}
              onValueChange={handleWorkoutReminderToggle}
              trackColor={{ false: '#D1D5DB', true: colors.primary.teal }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.rowTitle}>Weekly Insights Summary</Text>
              <Text style={styles.rowSubtitle}>Personalized neck angle & alignment reports</Text>
            </View>
            <Switch
              value={weeklyReports}
              onValueChange={handleWeeklyReportsToggle}
              trackColor={{ false: '#D1D5DB', true: colors.primary.teal }}
              thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            />
          </View>
        </View>

        {/* History Header */}
        <View style={styles.historyHeader}>
          <View style={styles.historyTitleContainer}>
            <Text style={styles.sectionHeader}>RECENT NOTIFICATIONS</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {notifications.length > 0 && (
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead}>
                  <Text style={styles.markReadText}>Mark all as read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={clearAllNotifications} style={{ marginLeft: 12 }}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Notifications History List */}
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="bell-off" size={32} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptySubtitle}>You don't have any pending alerts or reminders.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => markAsRead(item.id)}
              style={[styles.notificationCard, !item.read && styles.unreadCard]}
            >
              <View style={styles.notificationLeft}>
                <View style={[styles.iconBg, { backgroundColor: item.accentColor + '18' }]}>
                  <Feather name={item.iconName} size={16} color={item.accentColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.metaRow}>
                    <View style={[styles.categoryPill, { backgroundColor: item.accentColor + '15' }]}>
                      <Text style={[styles.categoryText, { color: item.accentColor }]}>
                        {item.category}
                      </Text>
                    </View>
                    <Text style={styles.notifTime}>{item.time}</Text>
                  </View>

                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.notifTitle, !item.read && styles.unreadTitleText]}>
                      {item.title}
                    </Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifMessage}>{item.message}</Text>

                  {item.actionText && (
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: item.accentColor }]}
                      onPress={() => handleActionPress(item)}
                    >
                      <Text style={[styles.actionButtonText, { color: item.accentColor }]}>
                        {item.actionText}
                      </Text>
                      <Feather name="arrow-right" size={12} color={item.accentColor} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base },
  content: { flex: 1, padding: 16, gap: 12 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: colors.text.secondary, marginLeft: 4 },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  rowSubtitle: { fontSize: 11, color: colors.text.secondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  historyHeader: {
	flexDirection: 'row',
	justifyContent: 'space-between',
	alignItems: 'center',
	marginTop: 10,
},
  historyTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    backgroundColor: colors.primary.teal,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  markReadText: { fontSize: 12, fontWeight: '600', color: colors.primary.teal },
  clearText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  notificationCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unreadCard: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  notificationLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary.teal,
  },
  unreadTitleText: { fontWeight: '800' },
  notifTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  notifMessage: { fontSize: 12, color: colors.text.secondary, marginTop: 3, lineHeight: 17 },
  notifTime: { fontSize: 10, color: colors.text.tertiary },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: { fontSize: 11, fontWeight: '700' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginTop: 8 },
  emptySubtitle: { fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
});