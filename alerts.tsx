import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type AlertStatus = 'active' | 'resolved' | 'deleted';

interface AlertItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  status: AlertStatus;
}

const INITIAL_ALERTS: AlertItem[] = [
  {
    id: '1',
    title: 'Salinity too high',
    detail: '38.2 ppt - above 36 ppt threshold',
    time: '3 mins ago',
    status: 'active',
  },
  {
    id: '2',
    title: 'Temperature rising',
    detail: '29.4°C - approaching 30°C limit',
    time: '32 mins ago',
    status: 'active',
  },
  {
    id: '3',
    title: 'pH restored to normal',
    detail: '8.1 pH - back in range (7.5-8.5)',
    time: '7:00 AM',
    status: 'resolved',
  },
  {
    id: '4',
    title: 'Sunlight back in range',
    detail: '642 lux - restored at 7:30 AM',
    time: '7:30 AM',
    status: 'resolved',
  },
];

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [salinityMax, setSalinityMax] = useState(36);
  const [temperatureMax, setTemperatureMax] = useState(30);
  const [pushEnabled, setPushEnabled] = useState(true);

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<'resolve' | 'delete' | null>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(-80)).current;

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts]);
  const resolvedAlerts = useMemo(() => alerts.filter((a) => a.status === 'resolved'), [alerts]);
  const deletedAlerts = useMemo(() => alerts.filter((a) => a.status === 'deleted'), [alerts]);

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
          duration: 280,
          useNativeDriver: false,
        }).start(() => setToastVisible(false));
      }, 1700);
    });
  };

  const saveSettings = async () => {
    if (savingSettings) return;
    setSavingSettings(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setSettingsVisible(false);
      showToast('Alert settings saved.');
    } catch {
      Alert.alert('Save Failed', 'Unable to save settings right now.');
    } finally {
      setSavingSettings(false);
    }
  };

  const closeSettings = () => {
    if (savingSettings) return;
    setSettingsVisible(false);
  };

  const handleResolve = async (item: AlertItem) => {
    if (processingId) return;

    setProcessingId(item.id);
    setProcessingAction('resolve');
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: 'resolved', time: 'Just now' } : a
        )
      );
      showToast('Alert marked as resolved.');
    } catch {
      Alert.alert('Error', 'Could not resolve alert.');
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleDelete = async (item: AlertItem) => {
    if (processingId) return;

    setProcessingId(item.id);
    setProcessingAction('delete');
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, status: 'deleted', time: 'Just now' } : a
        )
      );
      showToast('Alert moved to deleted list.');
    } catch {
      Alert.alert('Error', 'Could not delete alert.');
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <Text style={styles.headerSubtitle}>Lato Farm - Brgy. Uno, Calatagan, Batangas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Alerts</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{activeAlerts.length} active</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.iconBtn} onPress={() => setSettingsVisible(true)}>
              <Ionicons name="settings-sharp" size={17} color="#111" />
            </TouchableOpacity>
          </View>

          {/* Active */}
          <View style={styles.subHeaderRow}>
            <Text style={styles.subHeaderText}>Active</Text>
            <Ionicons name="information-circle-outline" size={14} color="#777" />
          </View>

          {activeAlerts.map((item) => {
            const isResolving = processingId === item.id && processingAction === 'resolve';
            const isDeleting = processingId === item.id && processingAction === 'delete';
            const isBusy = processingId === item.id;

            return (
              <View key={item.id} style={[styles.card, styles.activeCard]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.titleWrap}>
                    <Ionicons name="warning-outline" size={16} color="#1a1a1a" style={{ marginRight: 6 }} />
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardTime}>{item.time}</Text>
                </View>

                <Text style={styles.cardDetail}>{item.detail}</Text>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.resolveBtn, isBusy && styles.actionBtnDisabled]}
                    onPress={() => handleResolve(item)}
                    disabled={isBusy}
                  >
                    {isResolving ? (
                      <>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.resolveBtnText}>Resolving...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text style={styles.resolveBtnText}>Resolve</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.deleteBtn, isBusy && styles.actionBtnDisabled]}
                    onPress={() => handleDelete(item)}
                    disabled={isBusy}
                  >
                    {isDeleting ? (
                      <>
                        <ActivityIndicator size="small" color="#555" />
                        <Text style={styles.deleteBtnText}>Deleting...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={13} color="#555" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* Resolved */}
          <View style={[styles.subHeaderRow, { marginTop: 6 }]}>
            <Text style={styles.subHeaderText}>Resolved Today</Text>
            <Ionicons name="information-circle-outline" size={14} color="#777" />
          </View>

          {resolvedAlerts.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.titleWrap}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#2e8b57" style={{ marginRight: 6 }} />
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
                <Text style={styles.cardTime}>{item.time}</Text>
              </View>
              <Text style={styles.cardDetail}>{item.detail}</Text>
            </View>
          ))}

          {/* Deleted */}
          <View style={[styles.subHeaderRow, { marginTop: 6 }]}>
            <Text style={styles.subHeaderText}>Deleted Today</Text>
            <Ionicons name="information-circle-outline" size={14} color="#777" />
          </View>

          {deletedAlerts.length === 0 ? (
            <View style={styles.emptyDeletedCard}>
              <Text style={styles.emptyDeletedText}>No deleted alerts yet.</Text>
            </View>
          ) : (
            deletedAlerts.map((item) => (
              <View key={item.id} style={[styles.card, styles.deletedCard]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.titleWrap}>
                    <Ionicons name="trash-outline" size={16} color="#6b7280" style={{ marginRight: 6 }} />
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardTime}>{item.time}</Text>
                </View>
                <Text style={styles.cardDetail}>{item.detail}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal transparent visible={settingsVisible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.settingsCard}>
            <TouchableOpacity
              style={[styles.modalClose, savingSettings && { opacity: 0.4 }]}
              onPress={closeSettings}
              disabled={savingSettings}
            >
              <Ionicons name="close" size={16} color="#111" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Alert Thresholds</Text>
            <Text style={styles.modalSubtitle}>Set custom alert levels for your farm parameters</Text>

            <View style={styles.settingHeader}>
              <View style={styles.settingLabelWrap}>
                <Text style={styles.settingLabel}>Salinity Max</Text>
                <Ionicons name="information-circle-outline" size={13} color="#777" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.settingValue}>{salinityMax} ppt</Text>
            </View>

            <Slider
              minimumValue={28}
              maximumValue={40}
              step={1}
              value={salinityMax}
              onValueChange={setSalinityMax}
              minimumTrackTintColor="#111"
              maximumTrackTintColor="#ddd"
              thumbTintColor="#fff"
              style={styles.slider}
              disabled={savingSettings}
            />
            <Text style={styles.rangeText}>Range: 28-40 ppt</Text>

            <View style={[styles.settingHeader, { marginTop: 10 }]}>
              <View style={styles.settingLabelWrap}>
                <Text style={styles.settingLabel}>Temperature Max</Text>
                <Ionicons name="information-circle-outline" size={13} color="#777" style={{ marginLeft: 4 }} />
              </View>
              <Text style={styles.settingValue}>{temperatureMax}°C</Text>
            </View>

            <Slider
              minimumValue={25}
              maximumValue={35}
              step={1}
              value={temperatureMax}
              onValueChange={setTemperatureMax}
              minimumTrackTintColor="#111"
              maximumTrackTintColor="#ddd"
              thumbTintColor="#fff"
              style={styles.slider}
              disabled={savingSettings}
            />
            <Text style={styles.rangeText}>Range: 25-35°C</Text>

            <View style={styles.divider} />

            <View style={styles.pushRow}>
              <View style={styles.settingLabelWrap}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Ionicons name="information-circle-outline" size={13} color="#777" style={{ marginLeft: 4 }} />
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: '#D9D9D9', true: '#111' }}
                thumbColor="#fff"
                ios_backgroundColor="#D9D9D9"
                disabled={savingSettings}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, savingSettings && styles.saveBtnDisabled]}
              onPress={saveSettings}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.saveBtnText}>Saving...</Text>
                </>
              ) : (
                <Text style={styles.saveBtnText}>Save Settings</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 24 },

  header: {
    backgroundColor: '#2e8b57',
    paddingTop: 45,
    paddingBottom: 38,
    paddingHorizontal: 20,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSubtitle: { color: '#e3f3ea', fontSize: 13, marginTop: 4 },

  body: { paddingHorizontal: 16, paddingTop: 16 },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#1a1a1a' },

  countBadge: {
    marginLeft: 8,
    backgroundColor: '#fde8e8',
    borderColor: '#f6c7c7',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#c53030' },

  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  subHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  subHeaderText: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  activeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#e6a817',
  },
  deletedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9ca3af',
    backgroundColor: '#fafafa',
  },
  emptyDeletedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    backgroundColor: '#fafafa',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  emptyDeletedText: {
    fontSize: 12,
    color: '#888',
  },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', flexShrink: 1 },
  cardTime: { fontSize: 11, color: '#888' },
  cardDetail: { fontSize: 13, color: '#666', marginLeft: 22 },

  actionsRow: { flexDirection: 'row', marginTop: 10, marginLeft: 22, gap: 8 },
  actionBtnDisabled: { opacity: 0.75 },

  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e8b57',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  resolveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  deleteBtnText: { color: '#555', fontWeight: '700', fontSize: 12 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  settingsCard: {
    width: '100%',
    maxWidth: 330,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  modalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    padding: 2,
  },

  modalTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 2,
  },
  modalSubtitle: {
    textAlign: 'center',
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    marginBottom: 10,
  },

  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabelWrap: { flexDirection: 'row', alignItems: 'center' },
  settingLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2e8b57',
  },

  slider: {
    width: '100%',
    height: 26,
    marginTop: 0,
  },
  rangeText: {
    fontSize: 11,
    color: '#777',
    marginTop: -2,
  },

  divider: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginVertical: 10,
  },
  pushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  saveBtn: {
    backgroundColor: '#2e8b57',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.75,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },

  toast: {
    position: 'absolute',
    left: '50%',
    marginLeft: -120,
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 22,
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
