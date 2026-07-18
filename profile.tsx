import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [salinityAlerts, setSalinityAlerts] = useState(true);
  const [temperatureAlerts, setTemperatureAlerts] = useState(false);
  const [phSunlightAlerts, setPhSunlightAlerts] = useState(true);

  const [name, setName] = useState('Lato Farmer');
  const [email, setEmail] = useState('farmer@latomonitor.ph');
  const [contact, setContact] = useState('');

  const [draftName, setDraftName] = useState(name);
  const [draftEmail, setDraftEmail] = useState(email);
  const [draftContact, setDraftContact] = useState(contact);
  const [editVisible, setEditVisible] = useState(false);

  const [showTooltip, setShowTooltip] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const toastAnim = useRef(new Animated.Value(-80)).current;
  const [toastVisible, setToastVisible] = useState(false);

  const initials = (n: string) =>
    n
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const openEdit = () => {
    setDraftName(name);
    setDraftEmail(email);
    setDraftContact(contact);
    setEditVisible(true);
  };

  const closeEdit = () => setEditVisible(false);

  const showToast = () => {
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

  const saveProfile = () => {
    const trimmedName = draftName.trim();
    const trimmedEmail = draftEmail.trim();

    if (!trimmedName || !trimmedEmail) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setName(trimmedName);
    setEmail(trimmedEmail);
    setContact(draftContact.trim());
    setEditVisible(false);
    showToast();
  };

  const handleLogout = () => setLogoutVisible(true);

  const confirmLogout = () => {
    setLogoutVisible(false);
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {toastVisible && (
        <Animated.View style={[styles.toast, { top: toastAnim }]}>
          <View style={styles.toastIcon}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
          <Text style={styles.toastText}>Profile saved successfully!</Text>
        </Animated.View>
      )}

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={closeEdit}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeEdit}>
          <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={closeEdit}>
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
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.btnCancel} onPress={closeEdit}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSave} onPress={saveProfile}>
                <Text style={styles.btnSaveText}>Save Changes</Text>
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

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Account and Notifications</Text>
        </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* same compact style as alerts/history */}

        <View style={[styles.card, styles.profileCard]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>

          <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
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
            onValueChange={setPushNotifications}
          />
          <SettingRow
            title="Salinity Alerts"
            subtitle="Warn when salinity is above threshold"
            value={salinityAlerts}
            onValueChange={setSalinityAlerts}
          />
          <SettingRow
            title="Temperature Alerts"
            subtitle="Warn when temp is above threshold"
            value={temperatureAlerts}
            onValueChange={setTemperatureAlerts}
          />
          <SettingRow
            title="pH & Sunlight"
            subtitle="Warn when out of range"
            value={phSunlightAlerts}
            onValueChange={setPhSunlightAlerts}
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
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}

function SettingRow({ title, subtitle, value, onValueChange, isLast }: SettingRowProps) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ccc', true: '#2e8b57' }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f6f7' },
  scroll: { paddingBottom: 34 },

  // compact header (same family as alerts/history recent)
  header: {
  backgroundColor: '#2e8b57',
  paddingTop: 45,
  paddingBottom: 38,
  paddingHorizontal: 20,
},
headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
headerSubtitle: { color: '#e3f3ea', fontSize: 13, marginTop: 4 },


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
  email: { fontSize: 12, marginTop: 2, marginBottom: 14, color: '#2e8b57' },

  editBtn: {
    borderWidth: 1.2,
    borderColor: '#e9e9e9',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  editBtnText: { fontWeight: '700', fontSize: 13, color: '#1a1a1a' },

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

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    paddingVertical: 14,
  },
  logoutText: { color: '#d9534f', fontWeight: '800', fontSize: 14 },

  footer: { alignItems: 'center', marginTop: 20 },
  footerApp: { fontSize: 12, fontWeight: '700', color: '#777' },
  footerVersion: { fontSize: 11, marginTop: 3, color: '#777' },
  footerTagline: { fontSize: 11, marginTop: 2, color: '#777' },

  // Modal
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
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  btnCancelText: { color: '#555', fontWeight: '600', fontSize: 13 },
  btnSave: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#2e8b57',
    alignItems: 'center',
  },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Logout modal
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
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: '#d9534f',
    alignItems: 'center',
  },
  btnLogoutConfirmText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Toast
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
