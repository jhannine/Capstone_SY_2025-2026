import { API_BASE_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { clearSession } from '../utils/authStorage'; // i-adjust ang path base sa lokasyon ng authStorage.ts sa project mo

export default function ProfileScreen() {
  const router = useRouter();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [salinityAlerts, setSalinityAlerts] = useState(true);
  const [temperatureAlerts, setTemperatureAlerts] = useState(false);
  const [phSunlightAlerts, setPhSunlightAlerts] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [draftName, setDraftName] = useState(name);
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftContact, setDraftContact] = useState(contact);
  const [editVisible, setEditVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Nilabas mula sa useEffect papuntang component scope para magamit
  // din ng pull-to-refresh handler (handleRefresh) sa baba.
  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem('user');
      if (stored) {
        const user = JSON.parse(stored);
        setName(user.full_name ?? '');
        setEmail(user.email ?? '');
        setContact(user.contact_number ?? '');
      }
    } catch (err) {
      console.log('LOAD PROFILE ERROR:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Load the actual logged-in user (saved during login) instead of
  // showing hardcoded placeholder values.
  useEffect(() => {
    loadUser();
  }, []);

  const [showTooltip, setShowTooltip] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [savingToggleKey, setSavingToggleKey] = useState<string | null>(null);

  const toastAnim = useRef(new Animated.Value(-80)).current;
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Profile saved successfully!');

  const initials = (n: string) => {
    const trimmed = n.trim();
    if (!trimmed) return '?';
    return trimmed
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const openEdit = () => {
    setDraftName(name);
    setDraftEmail(email);
    setDraftContact(contact);
    setEditVisible(true);
  };

  const closeEdit = () => {
    if (savingProfile) return;
    setEditVisible(false);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.spring(toastAnim, {
      toValue: 18,
      useNativeDriver: false,
      friction: 7,
      tension: 60,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: -80,
          duration: 300,
          useNativeDriver: false,
        }).start(() => setToastVisible(false));
      }, 1800);
    });
  };

  const saveProfile = async () => {
    const trimmedName = draftName.trim();
    const trimmedEmail = draftEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const trimmedContact = draftContact.trim();

    setSavingProfile(true);
    try {
      // Need the logged-in user's id to know which database row to update.
      const stored = await AsyncStorage.getItem('user');
      const currentUser = stored ? JSON.parse(stored) : null;

      if (!currentUser?.id) {
        Alert.alert('Save Failed', 'No logged-in user found. Please log in again.');
        return;
      }

      // NOTE: backend is Flask (api_server.py), not PHP -- no ".php" suffix here.
      const response = await fetch(`${API_BASE_URL}/update_profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          full_name: trimmedName,
          email: trimmedEmail,
          contact_number: trimmedContact,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        Alert.alert('Save Failed', result.message || 'Unable to save profile right now.');
        return;
      }

      // Use the row the server sent back (source of truth), not just what we typed.
      setName(result.user.full_name ?? trimmedName);
      setEmail(result.user.email ?? trimmedEmail);
      setContact(result.user.contact_number ?? trimmedContact);

      // Keep AsyncStorage in sync so the edited values persist
      // even after closing/reopening the app. NOTE: this does NOT touch
      // farm_id, so it's safe to keep using AsyncStorage directly here --
      // update_profile never changes which farm the user belongs to.
      await AsyncStorage.setItem(
        'user',
        JSON.stringify({ ...currentUser, ...result.user })
      );

      setEditVisible(false);
      showToast('Profile saved successfully!');
    } catch (err) {
      console.log('SAVE PROFILE ERROR:', err);
      Alert.alert('Save Failed', 'Unable to connect to the server. Please check your connection.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveToggle = async (key: string, update: () => void) => {
    if (savingToggleKey) return;
    setSavingToggleKey(key);
    try {
      update();
      await new Promise((resolve) => setTimeout(resolve, 500));
      showToast('Notification setting updated.');
    } finally {
      setSavingToggleKey(null);
    }
  };

  const handleLogout = () => setLogoutVisible(true);

  const confirmLogout = async () => {
    setLogoutVisible(false);
    // Dati AsyncStorage.removeItem('user') lang -- naiiwan ang
    // 'lato_farm_id' sa storage, kaya kapag may susunod na mag-login
    // na hindi nakakumpleto ng saveSession(), pwedeng ma-stuck pa rin
    // sa farm_id ng dating user. clearSession() ang tumatanggal sa
    // 'user' AT 'lato_farm_id' nang sabay -- laging malinis simula.
    await clearSession();
    router.replace('/login');
  };

  // Pull-to-refresh handler -- kinukuha ulit ang saved user profile mula
  // sa AsyncStorage, pareho ng ginamit sa monitor.tsx.
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUser();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {toastVisible && (
        <Animated.View style={[styles.toast, { top: toastAnim }]}>
          <View style={styles.toastIcon}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Account and Notifications</Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={closeEdit}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeEdit}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeEdit} disabled={savingProfile}>
                <Ionicons name="close" size={15} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Full Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={draftName}
                onChangeText={setDraftName}
                editable={!savingProfile}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Email Address <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                value={draftEmail}
                onChangeText={setDraftEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!savingProfile}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Contact Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your contact number"
                value={draftContact}
                onChangeText={setDraftContact}
                keyboardType="phone-pad"
                editable={!savingProfile}
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={closeEdit} disabled={savingProfile}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSave, savingProfile && styles.btnDisabled]}
                onPress={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.btnSaveText}>Saving...</Text>
                  </>
                ) : (
                  <Text style={styles.btnSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={logoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLogoutVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.logoutModalBox}>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={24} color="#d9534f" />
            </View>
            <Text style={styles.logoutModalTitle}>Log Out</Text>
            <Text style={styles.logoutModalDesc}>
              Are you sure you want to log out of your account?
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setLogoutVisible(false)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnLogoutConfirm} onPress={confirmLogout}>
                <Text style={styles.btnLogoutConfirmText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2e8b57']}
            tintColor="#2e8b57"
          />
        }
      >
        <View style={[styles.card, styles.profileCard]}>
          {loadingProfile ? (
            <ActivityIndicator size="small" color="#2e8b57" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(name)}</Text>
              </View>
              <Text style={styles.name}>{name || 'Unknown User'}</Text>
              <Text style={styles.email}>{email}</Text>
              {!!contact && <Text style={styles.contact}>{contact}</Text>}

              <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <TouchableOpacity onPress={() => setShowTooltip((v) => !v)} style={styles.infoBtn}>
              <Ionicons name="information-circle-outline" size={15} color="#999" />
            </TouchableOpacity>
          </View>

          {showTooltip && (
            <View style={styles.tooltip}>
              <Text style={styles.tooltipText}>
                Manage which alerts you receive on your device.
              </Text>
            </View>
          )}

          <SettingRow
            title="Push Notifications"
            subtitle="Alerts sent to your phone"
            value={pushNotifications}
            onToggle={(v) => saveToggle('push', () => setPushNotifications(v))}
            saving={savingToggleKey === 'push'}
          />
          <SettingRow
            title="Salinity Alerts"
            subtitle="Warn when salinity is above threshold"
            value={salinityAlerts}
            onToggle={(v) => saveToggle('salinity', () => setSalinityAlerts(v))}
            saving={savingToggleKey === 'salinity'}
          />
          <SettingRow
            title="Temperature Alerts"
            subtitle="Warn when temp is above threshold"
            value={temperatureAlerts}
            onToggle={(v) => saveToggle('temp', () => setTemperatureAlerts(v))}
            saving={savingToggleKey === 'temp'}
          />
          <SettingRow
            title="pH & Sunlight"
            subtitle="Warn when out of range"
            value={phSunlightAlerts}
            onToggle={(v) => saveToggle('phsun', () => setPhSunlightAlerts(v))}
            saving={savingToggleKey === 'phsun'}
            isLast
          />
        </View>

        <View style={[styles.card, { paddingVertical: 4 }]}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Sensor Setup', 'Manage your ESP32 device.')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="settings-outline" size={17} color="#2e8b57" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Sensor Setup</Text>
              <Text style={styles.actionSubtitle}>Manage ESP32 device</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { borderBottomWidth: 0 }]}
            onPress={() => router.push('/history')}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="download-outline" size={17} color="#2e8b57" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Export Data</Text>
              <Text style={styles.actionSubtitle}>Download CSV and PDF report</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#999" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.card, styles.logoutBtn]} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={17} color="#d9534f" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerApp}>LatoMonitorPH</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
          <Text style={styles.footerTagline}>IoT Lato Seaweed Monitoring System</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingRowProps {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  saving?: boolean;
  isLast?: boolean;
}

function SettingRow({ title, subtitle, value, onToggle, saving, isLast }: SettingRowProps) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder]}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
        {saving && <Text style={styles.savingText}>Saving...</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#ccc', true: '#2e8b57' }}
        thumbColor="#fff"
        disabled={!!saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6f7' },
  scroll: { paddingBottom: 34 },

  header:{
  backgroundColor:'#2e8b57',
  paddingTop:55,
  paddingBottom:35,
  paddingHorizontal:22,
  borderBottomLeftRadius:35,
  borderBottomRightRadius:35,
},

headerTitle:{
  color:'#fff',
  fontSize:26,
  fontWeight:'900',
},

headerSubtitle:{
  color:'#d8f0e1',
  fontSize:13,
  marginTop:8,
},

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  profileCard: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 20,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#e7f5ec',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: { fontSize: 21, fontWeight: '800', color: '#2e8b57' },
  name: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  email: { fontSize: 12, marginTop: 2, marginBottom: 4, color: '#2e8b57' },
  contact: { fontSize: 11, color: '#666', marginBottom: 12 },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e8b57',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 12,
  },

  editBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  infoBtn: { marginLeft: 6, padding: 2 },

  tooltip: {
    backgroundColor: '#2d4a35',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  tooltipText: { color: '#fff', fontSize: 11, lineHeight: 16 },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: '#eee' },
  settingTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  settingSubtitle: { fontSize: 11, marginTop: 2, color: '#777' },
  savingText: { fontSize: 10, color: '#2e8b57', marginTop: 4, fontWeight: '600' },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginVertical: 4,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#e7f5ec',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTitle: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  actionSubtitle: { fontSize: 11, marginTop: 2, color: '#777' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#f6c7c7',
    borderRadius: 16,
    paddingVertical: 14,
  },
  logoutText: { color: '#d9534f', fontWeight: '800', fontSize: 14 },

  footer: { alignItems: 'center', marginTop: 20 },
  footerApp: { fontSize: 12, fontWeight: '700', color: '#777' },
  footerVersion: { fontSize: 11, marginTop: 3, color: '#777' },
  footerTagline: { fontSize: 11, marginTop: 2, color: '#777' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 330,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#1a1a1a', marginBottom: 6 },
  required: { color: '#dc2626' },
  input: {
    borderWidth: 1.2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },

  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f1',
    paddingVertical: 10,
    borderRadius: 14,
  },

  btnCancelText: {
    color: '#555',
    fontWeight: '700',
    fontSize: 12,
  },

  btnSave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e8b57',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },

  btnSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  btnDisabled: {
    opacity: 0.75,
  },

  logoutModalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
    maxWidth: 310,
    alignItems: 'center',
  },
  logoutIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoutModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  logoutModalDesc: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  btnLogoutConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9534f',
    paddingVertical: 10,
    borderRadius: 14,
  },

  btnLogoutConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  toast: {
    position: 'absolute',
    left: '50%',
    marginLeft: -125,
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.2,
    borderColor: '#d0f0dc',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 999,
  },
  toastIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2e8b57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { color: '#1a5c32', fontWeight: '600', fontSize: 12 },
});
