import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getFarmId } from '../utils/authStorage'; // i-adjust ang path base sa lokasyon ng authStorage.ts sa project mo

type Status = 'normal' | 'warning' | 'critical' | 'no-data';

interface MonitorRowProps {
  emoji: string;
  label: string;
  value: number;
  unit: string;
  safeRange: string;
  status?: Status;
}

// IMPORTANT: dapat parehas ito sa API_BASE_URL na ginagamit sa alerts.tsx
// (magkaiba ang mga ito noon -- 192.168.1.6 dito vs 192.168.254.108 sa
// alerts.tsx -- kaya siguraduhing yung tamang LAN IP ng machine na
// nagpapatakbo ng server.py ang ilagay dito).
const API_BASE_URL = 'http://192.168.1.6:5000';

const STATUS_COLORS: Record<Status, string> = {
  normal: '#2e8b57',
  warning: '#e6a817',
  critical: '#d9534f',
  'no-data': '#b0b0b0',
};

const STATUS_LABELS: Record<Status, string> = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
  'no-data': 'No Data',
};

function MonitorCard({
  emoji,
  label,
  value,
  unit,
  safeRange,
  status = 'no-data',
}: MonitorRowProps) {
  const color = STATUS_COLORS[status];

  let progress = 0;

  if (label === 'Temperature') {
    progress = Math.min((value / 40) * 100, 100);
  } else if (label === 'Salinity') {
    progress = Math.min((value / 45) * 100, 100);
  } else if (label === 'pH Level') {
    progress = Math.min((value / 14) * 100, 100);
  } else if (label === 'Sunlight') {
    progress = Math.min((value / 1200) * 100, 100);
  }

  const showInfo = () => {
    Alert.alert(label, `Safe range: ${safeRange}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <Text style={styles.emoji}>{emoji}</Text>

        <View style={{ flex: 1 }}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{label}</Text>

            <TouchableOpacity onPress={showInfo}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color="#999"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.safeRangeText}>
            Safe range: {safeRange}
          </Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: color + '22',
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color,
              },
            ]}
          >
            {STATUS_LABELS[status]}
          </Text>
        </View>
      </View>

      <View style={styles.valueRow}>
        <View style={styles.bigValueRow}>
          <Text style={styles.bigValue}>
            {value.toFixed(1)}
          </Text>

          <Text style={styles.unit}>
            {' '}
            {unit}
          </Text>
        </View>

        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>
            Current
          </Text>

          <Text style={styles.currentValue}>
            {value.toFixed(1)} {unit}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

// Parehong salinity band logic na ginagamit sa home.tsx at alerts.tsx
function getSalinityStatus(value: number): Status {
  if (value === 0) return 'no-data';
  if (value >= 28 && value <= 36) return 'normal';
  if ((value >= 25 && value < 28) || (value > 36 && value <= 38)) return 'warning';
  return 'critical';
}

export default function MonitorScreen() {
  const [refreshing, setRefreshing] =
    useState(false);

  const [temperature, setTemperature] =
    useState(0);

  const [salinity, setSalinity] =
    useState(0);

  const [sunlight, setSunlight] =
    useState(0);

  const [phLevel, setPhLevel] =
    useState<number | null>(null);

  // farm_id ng naka-login na user -- kinukuha mula sa AsyncStorage
  // (naka-save doon nung nag-login/register siya). null hangga't
  // hindi pa ito nalo-load, para hindi tayo makapag-fetch nang mali.
  const [farmId, setFarmId] = useState<number | null>(null);

  // Kumuha ng snapshot mula sa Flask /monitor endpoint. Ang endpoint na
  // ito (perform_monitor_refresh sa server.py) ang siyang kumukuha ng
  // Open-Meteo + salinity file, nagko-compute ng status, TAPOS
  // nagsa-save (INSERT/UPSERT) sa `monitor` AT `sensor_readings` tables.
  // Dati, dito mismo tumatawag ang screen sa Open-Meteo/salinity direkta,
  // kaya lumalabas lang sa app pero hindi kailanman naisusulat sa DB.
  const fetchData = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/monitor?farm_id=${id}`);
      const data = await res.json();

      console.log('MONITOR:', data);

      if (data.success) {
        const m = data.monitor;
        setTemperature(Number(m.water_temp ?? 0));
        setSalinity(Number(m.salinity ?? 0));
        setSunlight(Number(m.sunlight ?? 0));
        setPhLevel(m.ph_level != null ? Number(m.ph_level) : null);
      }
    } catch (e) {
      console.log('MONITOR FETCH ERROR:', e);
    }
  };

  // Unang i-load ang farm_id ng naka-login na user
  useEffect(() => {
    (async () => {
      const id = await getFarmId();
      setFarmId(id);
    })();
  }, []);

  // Saka lang mag-fetch/mag-interval kapag alam na natin ang farmId
  useEffect(() => {
    if (farmId == null) return;

    fetchData(farmId);

    const interval =
      setInterval(
        () => fetchData(farmId),
        300000
      );

    return () =>
      clearInterval(interval);

  }, [farmId]);

  const rows: MonitorRowProps[] = [
    {
      emoji: '🌡️',
      label: 'Temperature',
      value: temperature,
      unit: '°C',
      safeRange: '25-30 °C',
      status:
        temperature === 0
          ? 'no-data'
          : temperature >= 25 &&
            temperature <= 30
          ? 'normal'
          : 'warning',
    },

    {
      emoji: '💧',
      label: 'Salinity',
      value: salinity,
      unit: 'ppt',
      safeRange: '28-36 ppt',
      status: getSalinityStatus(salinity),
    },

    {
      emoji: '🧪',
      label: 'pH Level',
      // wala pang pH sensor kaya laging NULL ang ph_level mula sa backend --
      // ipapakita bilang "No Data" hangga't hindi pa naikokonekta ang sensor
      value: phLevel ?? 0,
      unit: 'pH',
      safeRange: '7.5-8.5',
      status: phLevel == null ? 'no-data' : phLevel >= 7.5 && phLevel <= 8.5 ? 'normal' : 'warning',
    },

    {
      emoji: '☀️',
      label: 'Sunlight',
      value: sunlight,
      unit: 'lux',
      safeRange: '400-800 lux',
      status:
        sunlight === 0
          ? 'no-data'
          : sunlight >= 400 &&
            sunlight <= 800
          ? 'normal'
          : 'warning',
    },
  ];

  // Pull-to-refresh handler — ito na ang tinatawag ng RefreshControl
  // kapag hinila-baba ng user ang screen mula sa itaas.
  const handleRefresh =
    async () => {

      setRefreshing(true);

      try {

        if (farmId != null) {
          await fetchData(farmId);
        }

      } catch {

        Alert.alert(
          'Error',
          'Unable to refresh.'
        );

      } finally {

        setRefreshing(false);

      }
    };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          🌱 Farm Monitoring
        </Text>

        <Text style={styles.headerSubtitle}>
          Real-time Lato Farm Water Conditions
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.scroll
        }
        showsVerticalScrollIndicator={
          false
        }
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

          <View
            style={
              styles.sectionHeaderRow
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Current Levels
            </Text>
          </View>

          {rows.map((row) => (
            <MonitorCard
              key={row.label}
              {...row}
            />
          ))}

          {/* Safe Range Guide */}
          <View style={styles.guideCard}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: '#111',
                }}
              >
                Safe Range Guide
              </Text>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Safe Range Guide',
                    'Recommended water quality values for healthy Lato farming.'
                  )
                }
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color="#777"
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            </View>

            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <Text
                style={[
                  styles.tableHeaderText,
                  { flex: 1.3 },
                ]}
              >
                Parameter
              </Text>

              <Text
                style={[
                  styles.tableHeaderText,
                  {
                    flex: 1,
                    textAlign: 'center',
                  },
                ]}
              >
                Current
              </Text>

              <Text
                style={[
                  styles.tableHeaderText,
                  {
                    flex: 1,
                    textAlign: 'right',
                  },
                ]}
              >
                Safe Range
              </Text>
            </View>

            {rows.map((item) => (
              <View
                key={`guide-${item.label}`}
                style={styles.tableRow}
              >
                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1.3,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {item.label}
                </Text>

                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {item.value.toFixed(1)} {item.unit}
                </Text>

                <Text
                  style={[
                    styles.tableCell,
                    {
                      flex: 1,
                      textAlign: 'right',
                      color: '#2e8b57',
                      fontWeight: '700',
                    },
                  ]}
                >
                  {item.safeRange}
                </Text>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 24 },
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
  body: { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#1a1a1a' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  emoji: { fontSize: 22, marginRight: 10, marginTop: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  safeRangeText: { fontSize: 12, color: '#999', marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  bigValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bigValue: { fontSize: 32, fontWeight: '800', color: '#111' },
  unit: { fontSize: 14, color: '#555', marginBottom: 4 },
  currentBox: { alignItems: 'flex-end' },
  currentLabel: { fontSize: 11, color: '#999' },
  currentValue: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 2 },
  progressTrack: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginTop: 6,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeaderText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
  },

  tableCell: {
    fontSize: 14,
    color: '#222',
  },
});
