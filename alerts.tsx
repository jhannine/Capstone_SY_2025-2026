import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getFarmId } from '../utils/authStorage'; // i-adjust ang path base sa lokasyon ng authStorage.ts sa project mo

type AlertStatus = 'active' | 'resolved' | 'deleted';
type ParamKey = 'temperature' | 'salinity' | 'sunlight' | 'ph';

interface AlertItem {
  id: number;
  paramKey: ParamKey;
  title: string;
  detail: string;
  status: AlertStatus;
  createdAt: string | null;
  resolvedAt: string | null;
  deletedAt: string | null;
}

// IMPORTANT: dapat parehas ito sa API_BASE_URL na ginagamit sa monitor.tsx
// (magkaiba ito dati -- 192.168.254.108 dito vs 192.168.1.6 sa monitor.tsx --
// kaya siguraduhing yung tamang LAN IP ng machine na nagpapatakbo ng
// server.py ang ilagay dito).
const API_BASE_URL = 'http://192.168.1.6:5000';
const SALINITY_URL = `${API_BASE_URL}/salinity`;
const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=13.83775&longitude=120.6190&current=temperature_2m,shortwave_radiation';

const FETCH_INTERVAL_MS = 300000; // 5 mins, parehas ng monitor.tsx

// Nagko-convert ng backend row (parameter, title, detail, status, created_at, ...)
// papuntang AlertItem na gamit ng UI.
const mapAlert = (row: any): AlertItem => ({
  id: row.id,
  paramKey: row.parameter,
  title: row.title,
  detail: row.detail,
  status: row.status,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
  deletedAt: row.deleted_at,
});

// Kinukuha kung anong timestamp ang ipapakita depende sa status ng alert.
const displayTimestamp = (item: AlertItem) => {
  if (item.status === 'deleted') return item.deletedAt;
  if (item.status === 'resolved') return item.resolvedAt;
  return item.createdAt;
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// =========================
// RangeSetting
// Reusable min/max slider pair para sa isang parameter sa Settings
// modal (hal. Salinity, Temperature, pH, Sunlight). Simple lang ang
// layout (parehas ng dati), pero ang bawat slider ay may makapal na
// custom track sa likod (hindi na yung manipis na default), kaya mas
// madali siyang makita at ma-drag.
// =========================
function RangeSetting({
  label,
  unit,
  color,
  decimals = 0,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  minSliderFloor,
  minSliderCeil,
  maxSliderFloor,
  maxSliderCeil,
  step,
  disabled,
}: {
  label: string;
  unit: string;
  color: string;
  decimals?: number;
  minValue: number;
  maxValue: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  minSliderFloor: number;
  minSliderCeil: number;
  maxSliderFloor: number;
  maxSliderCeil: number;
  step: number;
  disabled: boolean;
}) {
  const fmt = (v: number) => v.toFixed(decimals);

  // Para sa bawat slider, kinukuha ang % position ng current value sa
  // loob ng sarili nitong floor-ceil range, tapos ginagamit lang ito
  // para i-fill yung custom (mas makapal) na track na nasa likod ng
  // native Slider. Ang native Slider mismo ang tunay na nagha-handle
  // ng dragging -- transparent lang ang track niya, thumb lang ang
  // ipinapakita, kaya kelangan tugma ang laki ng custom track sa mata.
  const fillPct = (value: number, floor: number, ceil: number) =>
    Math.max(0, Math.min(100, ((value - floor) / Math.max(ceil - floor, 0.0001)) * 100));

  return (
    <View style={styles.rangeGroup}>
      <View style={styles.settingHeader}>
        <View style={styles.settingLabelWrap}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Ionicons name="information-circle-outline" size={13} color="#777" style={{ marginLeft: 4 }} />
        </View>
        <Text style={[styles.settingValue, { color }]}>
          {fmt(minValue)}{unit} - {fmt(maxValue)}{unit}
        </Text>
      </View>

      <Text style={styles.sliderCaption}>Min</Text>
      <View style={styles.sliderTrackWrap}>
        <View style={styles.sliderTrackBg} />
        <View
          style={[
            styles.sliderTrackFill,
            { width: `${fillPct(minValue, minSliderFloor, minSliderCeil)}%`, backgroundColor: color },
          ]}
        />
        <Slider
          minimumValue={minSliderFloor}
          maximumValue={minSliderCeil}
          step={step}
          value={minValue}
          onValueChange={onMinChange}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor={color}
          style={styles.slider}
          disabled={disabled}
        />
      </View>

      <Text style={styles.sliderCaption}>Max</Text>
      <View style={styles.sliderTrackWrap}>
        <View style={styles.sliderTrackBg} />
        <View
          style={[
            styles.sliderTrackFill,
            { width: `${fillPct(maxValue, maxSliderFloor, maxSliderCeil)}%`, backgroundColor: color },
          ]}
        />
        <Slider
          minimumValue={maxSliderFloor}
          maximumValue={maxSliderCeil}
          step={step}
          value={maxValue}
          onValueChange={onMaxChange}
          minimumTrackTintColor="transparent"
          maximumTrackTintColor="transparent"
          thumbTintColor={color}
          style={styles.slider}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Mga threshold na kontrolado ng user sa Settings modal, isa-isa
  // per parameter (min at max). Ito ang naka-save sa alert_settings
  // table -- kinukuha (GET) pagbukas ng modal, ise-save (POST) pag
  // tapos mag-adjust ng user.
  const [salinityMin, setSalinityMin] = useState(28);
  const [salinityMax, setSalinityMax] = useState(36);
  const [temperatureMin, setTemperatureMin] = useState(25);
  const [temperatureMax, setTemperatureMax] = useState(30);
  const [phMin, setPhMin] = useState(7.5);
  const [phMax, setPhMax] = useState(8.5);
  const [sunlightMin, setSunlightMin] = useState(400);
  const [sunlightMax, setSunlightMax] = useState(800);
  const [pushEnabled, setPushEnabled] = useState(true);

  const [processingId, setProcessingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // farm_id ng naka-login na user -- kinukuha mula sa AsyncStorage
  // (naka-save doon nung nag-login/register siya).
  const [farmId, setFarmId] = useState<number | null>(null);

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

  // Kunin ang kasalukuyang laman ng `alerts` table sa DB (active/resolved/deleted).
  const fetchAlerts = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts?farm_id=${id}`);
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts.map(mapAlert));
      }
    } catch (e) {
      console.log('FETCH ALERTS ERROR:', e);
    }
  };

  // Kunin ang naka-save na thresholds/toggles ng farm mula sa
  // alert_settings table, para populated agad ang mga slider ng
  // Settings modal (hindi na laging naka-default values).
  const fetchAlertSettings = async (id: number) => {
    setLoadingSettings(true);
    try {
      const res = await fetch(`${API_BASE_URL}/alert_settings?farm_id=${id}`);
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setSalinityMin(s.salinity_min);
        setSalinityMax(s.salinity_max);
        setTemperatureMin(s.temperature_min);
        setTemperatureMax(s.temperature_max);
        setPhMin(s.ph_min);
        setPhMax(s.ph_max);
        setSunlightMin(s.sunlight_min);
        setSunlightMax(s.sunlight_max);
        setPushEnabled(s.push_enabled);
      }
    } catch (e) {
      console.log('FETCH ALERT SETTINGS ERROR:', e);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Kumuha ng latest sensor readings, ipasa sa /alerts/evaluate para doon mag-decide
  // ang server kung mag-i-insert, mag-u-update, o mag-re-resolve ng alert sa DB.
  // (Ang thresholds mismo ay hindi na kailangang ipasa dito -- kinukuha na ito ng
  // server sa alert_settings table, single source of truth == DB.)
  const evaluateAndSync = async (id: number) => {
    let salinityValue: number | null = null;
    try {
      const res = await fetch(SALINITY_URL);
      const data = await res.json();
      const parsed = Number(data.salinity);
      salinityValue = Number.isNaN(parsed) ? null : parsed;
    } catch (e) {
      console.log('SALINITY ERROR:', e);
    }

    let tempValue: number | null = null;
    let sunValue: number | null = null;
    try {
      const res = await fetch(OPEN_METEO_URL);
      const data = await res.json();
      tempValue =
        data.current?.temperature_2m != null ? Number(data.current.temperature_2m) : null;
      sunValue =
        data.current?.shortwave_radiation != null ? Number(data.current.shortwave_radiation) : null;
    } catch (e) {
      console.log('OPEN METEO ERROR:', e);
    }

    // Wala pang pH sensor kaya laging null ito -- server.py naman ang
    // bahala mag-"skip" (walang gagawing alert) hangga't null pa rin.
    // Sandaling maikonekta na ang totoong pH sensor, dito na lang palitan
    // ng totoong reading (hal. galing sa isa pang fetch/endpoint).
    const phValue: number | null = null;

    try {
      const res = await fetch(`${API_BASE_URL}/alerts/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: id,
          temperature: tempValue,
          salinity: salinityValue,
          sunlight: sunValue,
          ph: phValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(data.alerts.map(mapAlert));
      }
    } catch (e) {
      console.log('EVALUATE ALERTS ERROR:', e);
    }
  };

  // Unang i-load ang farm_id ng naka-login na user
  useEffect(() => {
    (async () => {
      const id = await getFarmId();
      setFarmId(id);
    })();
  }, []);

  useEffect(() => {
    if (farmId == null) return;

    fetchAlerts(farmId);
    fetchAlertSettings(farmId);
    evaluateAndSync(farmId);
    const interval = setInterval(() => evaluateAndSync(farmId), FETCH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [farmId]);

  // Pull-to-refresh handler — kinukuha ulit ang alerts list saka nag-e-evaluate
  // laban sa latest sensor readings, pareho ng ginamit sa monitor.tsx.
  const handleRefresh = async () => {
    if (farmId == null) return;
    setRefreshing(true);
    try {
      await fetchAlerts(farmId);
      await evaluateAndSync(farmId);
    } finally {
      setRefreshing(false);
    }
  };

  // I-save ang thresholds + toggles papunta sa alert_settings table
  // (POST /alert_settings), tapos agad na mag-evaluate ulit para
  // maipakita kaagad ang epekto ng bagong settings sa alerts list.
  const saveSettings = async () => {
    if (savingSettings || farmId == null) return;
    setSavingSettings(true);

    try {
      const res = await fetch(`${API_BASE_URL}/alert_settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          salinity_min: salinityMin,
          salinity_max: salinityMax,
          temperature_min: temperatureMin,
          temperature_max: temperatureMax,
          ph_min: phMin,
          ph_max: phMax,
          sunlight_min: sunlightMin,
          sunlight_max: sunlightMax,
          push_enabled: pushEnabled,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSettingsVisible(false);
        showToast('Alert settings saved.');
        evaluateAndSync(farmId);
      } else {
        showToast(data.message || 'Failed to save alert settings.');
      }
    } catch (e) {
      console.log('SAVE ALERT SETTINGS ERROR:', e);
      showToast('Failed to save alert settings.');
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

    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${item.id}/resolve`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setAlerts((prev) => prev.map((a) => (a.id === item.id ? mapAlert(data.alert) : a)));
        showToast('Alert marked as resolved.');
      } else {
        showToast(data.message || 'Failed to resolve alert.');
      }
    } catch (e) {
      console.log('RESOLVE ERROR:', e);
      showToast('Failed to resolve alert.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (item: AlertItem) => {
    if (processingId) return;
    setProcessingId(item.id);

    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${item.id}/delete`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setAlerts((prev) => prev.map((a) => (a.id === item.id ? mapAlert(data.alert) : a)));
        showToast('Alert moved to deleted list.');
      } else {
        showToast(data.message || 'Failed to delete alert.');
      }
    } catch (e) {
      console.log('DELETE ERROR:', e);
      showToast('Failed to delete alert.');
    } finally {
      setProcessingId(null);
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
        <Text style={styles.headerTitle}>🚨 Farm Alerts</Text>
        <Text style={styles.headerSubtitle}>Monitor abnormal farm conditions</Text>
      </View>

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
        <View style={styles.body}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Alerts</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{activeAlerts.length} active</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setSettingsVisible(true);
                if (farmId != null) fetchAlertSettings(farmId);
              }}
            >
              <Ionicons name="settings-sharp" size={17} color="#111" />
            </TouchableOpacity>
          </View>

          {/* Active */}
          <View style={styles.subHeaderRow}>
            <Text style={styles.subHeaderText}>Active</Text>
            <Ionicons name="information-circle-outline" size={14} color="#777" />
          </View>

          {activeAlerts.length === 0 ? (
            <View style={styles.emptyDeletedCard}>
              <Text style={styles.emptyDeletedText}>All parameters within safe range.</Text>
            </View>
          ) : (
            activeAlerts.map((item) => {
              const isBusy = processingId === item.id;

              return (
                <View key={item.id} style={[styles.card, styles.activeCard]}>
                  <View style={styles.cardTopRow}>
                    <View style={styles.titleWrap}>
                      <Ionicons name="warning" size={18} color="#d9534f" style={{ marginRight: 6 }} />
                      <Text style={styles.cardTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.cardTime}>{formatDateTime(displayTimestamp(item))}</Text>
                  </View>

                  <Text style={styles.cardDetail}>{item.detail}</Text>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.resolveBtn, isBusy && styles.actionBtnDisabled]}
                      onPress={() => handleResolve(item)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
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
                      <Ionicons name="trash-outline" size={13} color="#555" />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {/* Resolved Today */}
          <View style={[styles.subHeaderRow, { marginTop: 6 }]}>
            <Text style={styles.subHeaderText}>Resolved</Text>
            <Ionicons name="information-circle-outline" size={14} color="#777" />
          </View>

          {resolvedAlerts.length === 0 ? (
            <View style={styles.emptyDeletedCard}>
              <Text style={styles.emptyDeletedText}>No resolved alerts yet.</Text>
            </View>
          ) : (
            resolvedAlerts.map((item) => (
              <View key={item.id} style={[styles.card, styles.resolvedCard]}>
                <View style={styles.cardTopRow}>
                  <View style={styles.titleWrap}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color="#2e8b57"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.cardTime}>{formatDateTime(displayTimestamp(item))}</Text>
                </View>
                <Text style={styles.cardDetail}>{item.detail}</Text>
              </View>
            ))
          )}

          {/* Deleted Today */}
          <View style={[styles.subHeaderRow, { marginTop: 6 }]}>
            <Text style={styles.subHeaderText}>Deleted</Text>
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
                  <Text style={styles.cardTime}>{formatDateTime(displayTimestamp(item))}</Text>
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
            <Text style={styles.modalSubtitle}>Set custom alert ranges for your farm parameters</Text>

            {loadingSettings ? (
              <View style={styles.settingsLoading}>
                <ActivityIndicator size="small" color="#2e8b57" />
              </View>
            ) : (
              <ScrollView
                style={styles.settingsScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <RangeSetting
                  label="Salinity"
                  unit=" ppt"
                  color="#2e8b57"
                  minValue={salinityMin}
                  maxValue={salinityMax}
                  onMinChange={setSalinityMin}
                  onMaxChange={setSalinityMax}
                  minSliderFloor={15}
                  minSliderCeil={32}
                  maxSliderFloor={30}
                  maxSliderCeil={45}
                  step={1}
                  disabled={savingSettings}
                />

                <RangeSetting
                  label="Temperature"
                  unit="°C"
                  color="#2e8b57"
                  minValue={temperatureMin}
                  maxValue={temperatureMax}
                  onMinChange={setTemperatureMin}
                  onMaxChange={setTemperatureMax}
                  minSliderFloor={18}
                  minSliderCeil={28}
                  maxSliderFloor={27}
                  maxSliderCeil={38}
                  step={1}
                  disabled={savingSettings}
                />

                <RangeSetting
                  label="pH Level"
                  unit=""
                  color="#2e8b57"
                  decimals={1}
                  minValue={phMin}
                  maxValue={phMax}
                  onMinChange={setPhMin}
                  onMaxChange={setPhMax}
                  minSliderFloor={6}
                  minSliderCeil={8}
                  maxSliderFloor={7.5}
                  maxSliderCeil={9.5}
                  step={0.1}
                  disabled={savingSettings}
                />

                <RangeSetting
                  label="Sunlight"
                  unit=" lux"
                  color="#2e8b57"
                  minValue={sunlightMin}
                  maxValue={sunlightMax}
                  onMinChange={setSunlightMin}
                  onMaxChange={setSunlightMax}
                  minSliderFloor={100}
                  minSliderCeil={500}
                  maxSliderFloor={500}
                  maxSliderCeil={1000}
                  step={10}
                  disabled={savingSettings}
                />

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
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, savingSettings && styles.saveBtnDisabled]}
              onPress={saveSettings}
              disabled={savingSettings || loadingSettings}
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
    paddingTop: 55,
    paddingBottom: 35,
    paddingHorizontal: 22,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  headerSubtitle: { color: '#d8f0e1', fontSize: 13, marginTop: 8 },

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
  activeCard: { borderLeftWidth: 5, borderLeftColor: '#d9534f', backgroundColor: '#fffafa' },
  resolvedCard: { backgroundColor: '#f5fbf7', borderLeftWidth: 5, borderLeftColor: '#2e8b57' },
  deletedCard: { borderLeftWidth: 4, borderLeftColor: '#9ca3af', backgroundColor: '#fafafa' },

  emptyDeletedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    backgroundColor: '#fafafa',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  emptyDeletedText: { fontSize: 12, color: '#888' },

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
    maxHeight: '86%',
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

  settingsScroll: {
    maxHeight: 440,
  },
  settingsLoading: {
    paddingVertical: 30,
    alignItems: 'center',
  },

  rangeGroup: { marginBottom: 18 },

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
    fontSize: 13,
    fontWeight: '800',
  },

  sliderCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    marginTop: 6,
  },

  // Custom, thicker track drawn behind the native Slider (which is set to
  // fully transparent tracks) so the control reads as a bold, easy-to-grab
  // bar instead of the native hairline-thin default.
  sliderTrackWrap: {
    justifyContent: 'center',
    height: 34,
  },
  sliderTrackBg: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e9e9e9',
  },
  sliderTrackFill: {
    position: 'absolute',
    left: 8,
    height: 10,
    borderRadius: 5,
  },
  slider: {
    width: '100%',
    height: 34,
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
    marginTop: 12,
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
