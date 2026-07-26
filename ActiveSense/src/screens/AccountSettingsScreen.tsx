import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { clearUserProfile, getUserProfile, saveUserProfile } from '../services/storage';
import { RootStackParamList } from '../navigation/types';
import { UserProfile } from '../types';
import { updateUserPassword } from '../services/supabase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AccountSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isPrivateMode, setIsPrivateMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal & Password State
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Load user profile on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const profile = await getUserProfile();
        if (profile) {
          setUser(profile);
          setName(profile.name || '');
          setEmail(profile.email || '');
          setIsPrivateMode(profile.privacyMode === 'Avatar');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load user settings.');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // In-App Password Update Logic
  const handleUpdatePasswordInApp = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Validation Error', 'Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    try {
      setUpdatingPassword(true);
      await updateUserPassword(newPassword);
      Alert.alert('Success', 'Your password has been updated!');
      setIsPasswordModalVisible(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Save profile changes
  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const updatedProfile: UserProfile = {
        ...user,
        name,
        email,
        privacyMode: isPrivateMode ? 'Avatar' : 'Camera',
      };

      await saveUserProfile(updatedProfile);
      setUser(updatedProfile);
      Alert.alert('Success', 'Account details updated successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update account details.');
    } finally {
      setSaving(false);
    }
  };

  // Delete account handler
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearUserProfile();
              navigation.reset({ index: 0, routes: [{ name: 'AuthLanding' }] });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PERSONAL INFORMATION</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter full name"
            />

            <View style={styles.divider} />

            {/* Email Address Field */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Enter email address"
            />
          </View>
        </View>

        {/* Security & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & SECURITY</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.rowTitle}>Avatar-Only Workout Mode</Text>
                <Text style={styles.rowSubtitle}>
                  Hide live video feed during workouts and replace it with a 3D avatar powered by real-time AI pose tracking.
                </Text>
              </View>
              <Switch
                value={isPrivateMode}
                onValueChange={setIsPrivateMode}
                trackColor={{ false: '#D1D5DB', true: colors.primary.teal }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
              />
            </View>

            <View style={styles.divider} />

            {/* Triggers Modal */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.row}
              onPress={() => setIsPasswordModalVisible(true)}
            >
              <Text style={styles.rowTitle}>Change Password</Text>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Save & Delete Buttons */}
        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
          <Feather name="trash-2" size={18} color="#EF4444" />
          <Text style={styles.dangerButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={isPasswordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Password</Text>
              <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)}>
                <Feather name="x" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 6 characters"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="Re-enter new password"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => {
                  setIsPasswordModalVisible(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalButton, updatingPassword && { opacity: 0.7 }]}
                onPress={handleUpdatePasswordInApp}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveModalButtonText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.base },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, gap: 20 },
  section: { gap: 8 },
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
  label: { fontSize: 12, color: colors.text.secondary, marginBottom: 4 },
  input: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    paddingVertical: 6,
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  rowSubtitle: { fontSize: 11, color: colors.text.secondary, marginTop: 2, lineHeight: 15 },
  saveButton: {
    backgroundColor: colors.primary.teal,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  dangerButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.background.card,
    borderRadius: 20,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelModalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelModalButtonText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  saveModalButton: {
    backgroundColor: colors.primary.teal,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  saveModalButtonText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});