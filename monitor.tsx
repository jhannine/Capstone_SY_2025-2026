import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Status = 'normal' | 'warning' | 'critical' | 'no-data';

interface MonitorRowProps {
  emoji: string;
  label: string;
  value: number;
  unit: string;
  safeRange: string;
  status?: Status;
}

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

function MonitorCard({ emoji, label, value, unit, safeRange, status = 'no-data' }: MonitorRowProps) {
  const color = STATUS_COLORS[status];

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
              <Ionicons name="information-circle-outline" size={15} color="#999" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <Text style={styles.safeRangeText}>Safe range: {safeRange}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[status]}</Text>
        </View>
      </View>

      <View style={styles.valueRow}>
        <View style={styles.bigValueRow}>
          <Text style={styles.bigValue}>{value}</Text>
          <Text style={styles.unit}> {unit}</Text>
        </View>
        <View style={styles.currentBox}>
          <Text style={styles.currentLabel}>Current</Text>
          <Text style={styles.currentValue}>
            {value} {unit}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '0%', backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function MonitorScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const rows: MonitorRowProps[] = [
    { emoji: '🌡️', label: 'Temperature', value: 0, unit: '°C', safeRange: '25-30 °C', status: 'no-data' },
    { emoji: '💧', label: 'Salinity', value: 0, unit: 'ppt', safeRange: '28-36 ppt', status: 'no-data' },
    { emoji: '🧪', label: 'pH Level', value: 0, unit: 'pH', safeRange: '7.5-8.5', status: 'no-data' },
    { emoji: '☀️', label: 'Sunlight', value: 0, unit: 'lux', safeRange: '400-800 lux', status: 'no-data' },
  ];

  const handleRefresh = async () => {
    if (refreshing) return;

    setRefreshing(true);
    try {
      // replace with real API/sensor fetch
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Updated', 'Sensor data refreshed.');
    } catch (e) {
      Alert.alert('Refresh Failed', 'Unable to refresh data right now.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monitoring</Text>
        <Text style={styles.headerSubtitle}>Lato Farm - Brgy. Uno, Calatagan, Batangas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Current Levels</Text>
              <TouchableOpacity onPress={() => Alert.alert('Current Levels', 'Live readings from your pond sensors.')}>
                <Ionicons name="information-circle-outline" size={16} color="#999" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="refresh" size={15} color="#fff" />
              )}
              <Text style={styles.refreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>

          {rows.map((row) => (
            <MonitorCard key={row.label} {...row} />
          ))}

          <View style={styles.guideCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Safe Range Guide</Text>
              <TouchableOpacity onPress={() => Alert.alert('Safe Range Guide', 'Reference values for optimal pond conditions.')}>
                <Ionicons name="information-circle-outline" size={16} color="#999" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Parameter</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Current</Text>
              <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'right' }]}>Safe range</Text>
            </View>

            {rows.map((row) => (
              <View key={row.label} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '600', color: '#222' }]}>{row.label}</Text>
                <Text style={[styles.tableCell, { flex: 1, color: '#999' }]}>
                  {row.value} {row.unit}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', color: '#2e8b57', fontWeight: '700' }]}>
                  {row.safeRange}
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
    marginBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#1a1a1a' },

  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e8b57',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    minWidth: 120,
    justifyContent: 'center',
  },
  refreshBtnDisabled: {
    opacity: 0.75,
  },
  refreshText: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 4 },

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
    height: 6,
    backgroundColor: '#eee',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 10,
  },
  tableHeaderText: { fontSize: 12, fontWeight: '700', color: '#999' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  tableCell: { fontSize: 13 },
});
