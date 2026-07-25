import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

type ViewMode = 'graph' | 'table';
type RangeMode = '7' | '30';
type Status = 'Normal' | 'Warning' | 'Critical';
type ExportType = 'csv' | 'pdf';

const labels7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const temp7 = [29, 24, 24, 28, 18, 23, 26];
const sal7 = [18, 22, 22, 15, 20, 16, 22];

const labels30 = ['W1', 'W2', 'W3', 'W4'];
const temp30 = [27, 28, 26, 29];
const sal30 = [21, 19, 23, 20];

const TABLE_ROWS = [
  { time: '7:30 AM', temp: '28.4°', sal: '38.2ppt', ph: '8.1', status: 'Warning' as Status },
  { time: '7:00 AM', temp: '27.6°', sal: '35.8ppt', ph: '8.0', status: 'Normal' as Status },
  { time: '6:30 AM', temp: '36.6°', sal: '35.3ppt', ph: '8.0', status: 'Critical' as Status },
];

export default function HistoryScreen() {
  const [range, setRange] = useState<RangeMode>('7');
  const [mode, setMode] = useState<ViewMode>('graph');
  const [exportType, setExportType] = useState<ExportType>('csv');
  const { width } = useWindowDimensions();

  const tempData = range === '7' ? temp7 : temp30;
  const salData = range === '7' ? sal7 : sal30;
  const xLabels = range === '7' ? labels7 : labels30;

  // responsive width to prevent overlap/cutoff
  const chartWidth = useMemo(() => {
    // screen padding (12*2) + card padding (12*2) + breathing room
    return Math.max(260, width - 12 * 2 - 12 * 2 - 10);
  }, [width]);

  const chartConfigGreen = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: () => '#1f8f5f',
    labelColor: () => '#6f6f6f',
    propsForDots: { r: '3', strokeWidth: '1', stroke: '#1f8f5f' },
    propsForBackgroundLines: { stroke: '#efefef', strokeDasharray: '' },
    propsForLabels: { fontSize: 10 },
  };

  const chartConfigYellow = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    decimalPlaces: 0,
    color: () => '#d4a019',
    labelColor: () => '#6f6f6f',
    propsForDots: { r: '3', strokeWidth: '1', stroke: '#d4a019' },
    propsForBackgroundLines: { stroke: '#efefef', strokeDasharray: '' },
    propsForLabels: { fontSize: 10 },
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>Lato Farm - Brgy. Uno, Calatagan, Batangas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.topControls}>
            <View style={styles.rangeTabs}>
              <TouchableOpacity
                style={[styles.tabBtn, range === '7' && styles.tabBtnActive]}
                onPress={() => setRange('7')}
              >
                <Text style={[styles.tabText, range === '7' && styles.tabTextActive]}>Last 7 days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, range === '30' && styles.tabBtnActive]}
                onPress={() => setRange('30')}
              >
                <Text style={[styles.tabText, range === '30' && styles.tabTextActive]}>30 days</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modeBtn}
              onPress={() => setMode((m) => (m === 'graph' ? 'table' : 'graph'))}
            >
              <Ionicons
                name={mode === 'graph' ? 'grid-outline' : 'analytics-outline'}
                size={14}
                color="#111"
              />
              <Text style={styles.modeBtnText}>{mode === 'graph' ? 'Table' : 'Graph'}</Text>
            </TouchableOpacity>
          </View>

          {mode === 'graph' ? (
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Water Temperature (°C)</Text>
                <Ionicons name="information-circle-outline" size={15} color="#999" />
              </View>

              <View style={styles.chartWrap}>
                <LineChart
                  data={{ labels: xLabels, datasets: [{ data: tempData }] }}
                  width={chartWidth}
                  height={170}
                  withInnerLines
                  withOuterLines={false}
                  withVerticalLines={false}
                  withShadow={false}
                  bezier
                  fromZero
                  yAxisInterval={1}
                  chartConfig={chartConfigGreen}
                  style={styles.chart}
                  formatYLabel={(v) => `${Math.round(Number(v))}`}
                  horizontalLabelRotation={0}
                  verticalLabelRotation={0}
                  segments={4}
                />
              </View>
              <Text style={styles.captionGreen}>Temperature (°C)</Text>

              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Salinity (ppt)</Text>
                <Ionicons name="information-circle-outline" size={15} color="#999" />
              </View>

              <View style={styles.chartWrap}>
                <LineChart
                  data={{ labels: xLabels, datasets: [{ data: salData }] }}
                  width={chartWidth}
                  height={170}
                  withInnerLines
                  withOuterLines={false}
                  withVerticalLines={false}
                  withShadow={false}
                  bezier
                  fromZero
                  yAxisInterval={1}
                  chartConfig={chartConfigYellow}
                  style={styles.chart}
                  formatYLabel={(v) => `${Math.round(Number(v))}`}
                  horizontalLabelRotation={0}
                  verticalLabelRotation={0}
                  segments={4}
                />
              </View>
              <Text style={styles.captionYellow}>Salinity (ppt)</Text>

              <View style={styles.summaryStrip}>
                <Text style={styles.summaryTitle}>Weekly Summary</Text>
                <View style={styles.summaryRow}>
                  <View>
                    <Text style={styles.summaryLabel}>Avg Temp</Text>
                    <Text style={styles.summaryValue}>27.8°C</Text>
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Avg Salinity</Text>
                    <Text style={styles.summaryValue}>35.4ppt</Text>
                  </View>
                  <View>
                    <Text style={styles.summaryLabel}>Avg pH</Text>
                    <Text style={styles.summaryValue}>8.0</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Sensor Log Records</Text>
                <Ionicons name="information-circle-outline" size={15} color="#999" />
              </View>

              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1.2 }]}>Time</Text>
                <Text style={[styles.th, { flex: 1 }]}>Temp.</Text>
                <Text style={[styles.th, { flex: 1 }]}>Sal.</Text>
                <Text style={[styles.th, { flex: 0.8 }]}>pH</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Status</Text>
              </View>

              {TABLE_ROWS.map((r) => (
                <View key={r.time} style={styles.tableRow}>
                  <Text style={[styles.td, { flex: 1.2 }]}>{r.time}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{r.temp}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{r.sal}</Text>
                  <Text style={[styles.td, { flex: 0.8 }]}>{r.ph}</Text>
                  <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                    <View
                      style={[
                        styles.statusPill,
                        r.status === 'Normal'
                          ? styles.normalPill
                          : r.status === 'Warning'
                          ? styles.warningPill
                          : styles.criticalPill,
                      ]}
                    >
                      <Text style={styles.statusPillText}>{r.status}</Text>
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.loadMoreBtn}>
                <Text style={styles.loadMoreText}>Load more records</Text>
                <Ionicons name="arrow-down" size={16} color="#1f8f5f" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Export Data</Text>
              <Ionicons name="information-circle-outline" size={15} color="#999" />
            </View>

            <Text style={styles.exportLabel}>Export Format</Text>
            <View style={styles.formatRow}>
              <TouchableOpacity
                style={[styles.formatBtn, styles.csvBtn, exportType === 'csv' && styles.formatBtnActive]}
                onPress={() => setExportType('csv')}
              >
                <MaterialCommunityIcons name="file-delimited-outline" size={16} color="#1f8f5f" />
                <Text style={styles.csvText}>CSV</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.formatBtn, styles.pdfBtn, exportType === 'pdf' && styles.formatBtnActive]}
                onPress={() => setExportType('pdf')}
              >
                <MaterialCommunityIcons name="file-pdf-box" size={16} color="#d9534f" />
                <Text style={styles.pdfText}>PDF</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.downloadBtn}>
              <Ionicons name="download-outline" size={15} color="#fff" />
              <Text style={styles.downloadBtnText}>Download Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f5f5' },
  scroll: { paddingBottom: 24 },

  header: {
  backgroundColor: '#2e8b57',
  paddingTop: 45,
  paddingBottom: 38,
  paddingHorizontal: 20,
},
headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
headerSubtitle: { color: '#e3f3ea', fontSize: 13, marginTop: 4 },

  body: { paddingHorizontal: 12, paddingTop: 10 },

  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  rangeTabs: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    backgroundColor: '#ececec',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: '#22a06b' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#222' },
  tabTextActive: { color: '#fff' },

  modeBtn: {
    backgroundColor: '#ececec',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: '#111' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 12,
    marginBottom: 10,
  },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111' },

  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 8,
    marginTop: 2,
  },
  chart: {
    borderRadius: 8,
    paddingRight: 16,
  },
  captionGreen: {
    textAlign: 'center',
    fontSize: 10,
    color: '#1f8f5f',
    marginTop: 2,
    marginBottom: 8,
  },
  captionYellow: {
    textAlign: 'center',
    fontSize: 10,
    color: '#b38811',
    marginTop: 2,
    marginBottom: 8,
  },

  summaryStrip: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 10,
    padding: 10,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', color: '#333', marginBottom: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 10, color: '#777' },
  summaryValue: { fontSize: 12, fontWeight: '800', color: '#111', marginTop: 2 },

  tableHead: {
    marginTop: 10,
    flexDirection: 'row',
    backgroundColor: '#f5f7f6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  th: { fontSize: 11, fontWeight: '700', color: '#4f5f56' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  td: { fontSize: 12, color: '#222', fontWeight: '600' },

  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: '700', color: '#333' },
  normalPill: { backgroundColor: '#d9f3e3' },
  warningPill: { backgroundColor: '#fde9a9' },
  criticalPill: { backgroundColor: '#f8d3d2' },

  loadMoreBtn: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  loadMoreText: { fontSize: 12, fontWeight: '700', color: '#1f8f5f' },

  exportLabel: { marginTop: 4, fontSize: 14, fontWeight: '700', color: '#111' },
  formatRow: { flexDirection: 'row', gap: 10, marginTop: 8 },

  formatBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.2,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  csvBtn: { backgroundColor: '#eaffea', borderColor: '#7fd49b' },
  pdfBtn: { backgroundColor: '#fff1f1', borderColor: '#efb3b1' },
  csvText: { color: '#1f8f5f', fontWeight: '800', fontSize: 14 },
  pdfText: { color: '#c93d3a', fontWeight: '800', fontSize: 14 },
  formatBtnActive: { opacity: 0.9 },

  downloadBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#22a06b',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  downloadBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
