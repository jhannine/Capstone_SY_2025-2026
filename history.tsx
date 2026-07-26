import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
// NOTE: sa mas bagong expo-file-system (SDK 52+), ang mga lumang function
// tulad ng `documentDirectory` at `downloadAsync` ay inilipat na sa
// '/legacy' subpath -- ang default import na ngayon ay yung bagong
// File/Directory API. Ginagamit dito ang legacy path para gumana pa rin
// ang parehong downloadAsync() na ginamit sa handleDownload() sa baba.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
// i-adjust ang path base sa lokasyon ng authStorage.ts sa project mo.
// Kung wala ka pang `getUserId`, idagdag ito sa authStorage.ts kaparehas
// ng `getFarmId` (dapat naka-save ang user.id sa AsyncStorage nung
// nag-login/register, tulad ng ginagawa na sa farm_id).
import { getFarmId, getUserId } from '../utils/authStorage';

type ViewMode = 'graph' | 'table';
type RangeMode = '7' | '30';
type Status = 'Normal' | 'Warning' | 'Critical';
type ExportType = 'csv' | 'pdf';

// IMPORTANT: dapat parehas ito sa API_BASE_URL na ginagamit sa
// monitor.tsx / home.tsx / alerts.tsx -- ilagay ang tamang LAN IP ng
// machine na nagpapatakbo ng server.py.
const API_BASE_URL = 'http://192.168.1.6:5000';

interface HistoryDay {
  date: string; // "YYYY-MM-DD"
  label: string; // "Mon", "Tue", ...
  temperature: number | null;
  salinity: number | null;
  ph: number | null;
  sunlight: number | null;
}

interface HistorySummary {
  avg_temp: number | null;
  avg_salinity: number | null;
  avg_ph: number | null;
  avg_sunlight: number | null;
}

// tumutugma sa row shape ng GET /export_logs sa server.py
interface ExportLog {
  id: number;
  user_id: number;
  farm_id: number;
  export_type: ExportType;
  range_days: number;
  file_path: string;
  created_at: string | null; // ISO string
}

// tumutugma sa row shape ng GET /history/logs sa server.py (raw per-reading logs)
interface SensorLogRow {
  id: number;
  time: string; // "7:30 AM"
  recorded_at: string;
  water_temp: number | null;
  salinity: number | null;
  ph_level: number | null;
  sunlight: number | null;
  status: 'normal' | 'warning' | 'critical';
}

// Safe / optimal operating ranges per sensor. Each chart draws its own pair
// of flat reference lines (min & max) so the actual readings can be compared
// against the safe band at a glance, plus a small badge showing the numbers.
const SAFE_RANGES = {
  temp: { min: 25, max: 30, unit: '°C' },
  sal: { min: 28, max: 36, unit: 'ppt' },
  sun: { min: 400, max: 800, unit: 'W/m²' },
  ph: { min: 7.5, max: 8.5, unit: '' },
};

function formatDateShort(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateLong(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// "YYYY-MM-DD" -> "July 26, 2026"
function formatIsoDateLong(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return formatDateLong(new Date(y, m - 1, d));
}

// "YYYY-MM-DD" -> Date sa local time (iwas timezone shift ng `new Date(iso)`)
function isoToLocalDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date -> "YYYY-MM-DD" sa LOCAL time (iwas ang UTC shift ng toISOString(),
// na pwedeng lumipat ng isang araw paatras depende sa timezone ng phone).
function toLocalIsoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ISO datetime (mula MySQL created_at) -> "July 26, 2026 · 4:56 PM"
function formatExportedAt(iso: string | null) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

type SafeRangeChartProps = {
  data: (number | null)[];
  labels: string[];
  dates: string[];
  color: string;
  min: number;
  max: number;
  axisMax: number;
  axisStep: number;
  width: number;
  decimals?: number;
  unit: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
};

// Custom Y-axis look (thin line, arrowhead, per-unit tick numbers) instead of
// chart-kit's built-in full-width gridlines. Dots are tappable -- tapping a
// dot shows the actual date (and value) for that day below the chart.
function SafeRangeChart({
  data,
  labels,
  dates,
  color,
  min,
  max,
  axisMax,
  axisStep,
  width,
  decimals = 0,
  unit,
  selectedIndex,
  onSelect,
}: SafeRangeChartProps) {
  const leftMargin = 30;
  const rightMargin = 10;
  const topMargin = 18;
  const bottomMargin = 22;

  const tickCount = Math.floor(axisMax / axisStep) + 1;
  const minRowHeight = 13; // px needed per label so text doesn't collide
  const innerHeight = Math.max(150, tickCount * minRowHeight);
  const height = topMargin + bottomMargin + innerHeight;

  const innerWidth = width - leftMargin - rightMargin;

  const yFor = (v: number) => topMargin + innerHeight - (v / axisMax) * innerHeight;
  const xFor = (i: number) =>
    labels.length > 1 ? leftMargin + (i / (labels.length - 1)) * innerWidth : leftMargin;

  const yTicks: number[] = [];
  for (let v = 0; v <= axisMax + 0.0001; v += axisStep) {
    yTicks.push(Math.round(v * 100) / 100);
  }

  // hatiin sa magkakahiwalay na segments para hindi kumonekta ang linya
  // sa mga araw na walang datos (null)
  const segments: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  data.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ i, v });
    }
  });
  if (current.length) segments.push(current);

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Y axis ticks + numbers, one per unit — no skipping */}
        {yTicks.map((v) => (
          <React.Fragment key={`yt-${v}`}>
            <Line x1={leftMargin - 4} y1={yFor(v)} x2={leftMargin} y2={yFor(v)} stroke="#9aa0a6" strokeWidth={1} />
            <SvgText x={leftMargin - 7} y={yFor(v) + 3} fontSize={9} fill="#6f6f6f" textAnchor="end">
              {v.toFixed(decimals)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Y axis line + arrowhead + "Y" label */}
        <Line x1={leftMargin} y1={topMargin - 6} x2={leftMargin} y2={topMargin + innerHeight} stroke="#222" strokeWidth={1.2} />
        <Polygon
          points={`${leftMargin - 3},${topMargin - 6} ${leftMargin + 3},${topMargin - 6} ${leftMargin},${topMargin - 12}`}
          fill="#222"
        />
        <SvgText x={leftMargin + 6} y={topMargin - 8} fontSize={10} fontWeight="700" fill="#222">
          Y
        </SvgText>

        {/* X axis line (content/labels unchanged) */}
        <Line
          x1={leftMargin}
          y1={topMargin + innerHeight}
          x2={leftMargin + innerWidth}
          y2={topMargin + innerHeight}
          stroke="#222"
          strokeWidth={1.2}
        />
        {labels.map((l, i) => (
          <SvgText
            key={`xl-${l}-${i}`}
            x={xFor(i)}
            y={topMargin + innerHeight + 14}
            fontSize={9}
            fill={i === selectedIndex ? color : '#6f6f6f'}
            fontWeight={i === selectedIndex ? '800' : '400'}
            textAnchor="middle"
          >
            {l}
          </SvgText>
        ))}

        {/* safe range boundaries — dashed */}
        <Line x1={leftMargin} y1={yFor(min)} x2={leftMargin + innerWidth} y2={yFor(min)} stroke="rgba(217,83,79,0.65)" strokeWidth={1} strokeDasharray="4,3" />
        <Line x1={leftMargin} y1={yFor(max)} x2={leftMargin + innerWidth} y2={yFor(max)} stroke="rgba(217,83,79,0.65)" strokeWidth={1} strokeDasharray="4,3" />

        {/* data line(s) — split kung may gaps (no-data days) */}
        {segments.map((seg, si) => (
          <Polyline
            key={`seg-${si}`}
            points={seg.map((p) => `${xFor(p.i)},${yFor(p.v)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />
        ))}

        {/* tappable dots — bigger + ring kapag selected, para makita agad
            ang petsa/value nito sa caption sa ibaba */}
        {data.map((d, i) =>
          d === null ? null : (
            <React.Fragment key={`dot-${i}`}>
              {i === selectedIndex && (
                <Circle cx={xFor(i)} cy={yFor(d)} r={7} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
              )}
              <Circle
                cx={xFor(i)}
                cy={yFor(d)}
                r={i === selectedIndex ? 4 : 2.5}
                fill={color}
                onPress={() => onSelect(selectedIndex === i ? null : i)}
              />
            </React.Fragment>
          )
        )}
      </Svg>

      {selectedIndex !== null && data[selectedIndex] !== null && (
        <View style={[styles.dotTooltip, { borderColor: color }]}>
          <Ionicons name="calendar-outline" size={12} color={color} />
          <Text style={[styles.dotTooltipText, { color }]}>
            {formatIsoDateLong(dates[selectedIndex])} · {data[selectedIndex]!.toFixed(decimals)}{unit}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const [range, setRange] = useState<RangeMode>('7');
  const [mode, setMode] = useState<ViewMode>('graph');
  const [exportType, setExportType] = useState<ExportType>('csv');
  const { width } = useWindowDimensions();

  const [farmId, setFarmId] = useState<number | null>(null);
  const [userId, setUserId] = useState<number | null>(null);

  const [historyDays, setHistoryDays] = useState<HistoryDay[]>([]);
  const [summary, setSummary] = useState<HistorySummary>({
    avg_temp: null,
    avg_salinity: null,
    avg_ph: null,
    avg_sunlight: null,
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // per-chart na selected dot index (para magkahiwalay ang tooltip ng bawat parameter)
  const [selected, setSelected] = useState<{ temp: number | null; sal: number | null; sun: number | null; ph: number | null }>({
    temp: null,
    sal: null,
    sun: null,
    ph: null,
  });

  const [downloading, setDownloading] = useState(false);

  // export date range (Export Data card)
  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);
  const [fromDate, setFromDate] = useState<Date>(weekAgo);
  const [toDate, setToDate] = useState<Date>(today);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // graph date filter (Filter by Date card, ibang-iba sa export range)
  const [graphFilterEnabled, setGraphFilterEnabled] = useState(false);
  const [graphFromDate, setGraphFromDate] = useState<Date>(weekAgo);
  const [graphToDate, setGraphToDate] = useState<Date>(today);
  const [showGraphFromPicker, setShowGraphFromPicker] = useState(false);
  const [showGraphToPicker, setShowGraphToPicker] = useState(false);

  // Sensor Log Records (Table view) -- single-day filter + pagination
  const [logDate, setLogDate] = useState<Date>(today);
  const [showLogDatePicker, setShowLogDatePicker] = useState(false);
  const [logs, setLogs] = useState<SensorLogRow[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsOffset, setLogsOffset] = useState(0);
  const [logsHasMore, setLogsHasMore] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);
  const LOGS_PAGE_SIZE = 10;

  // Recent Exports list (mula sa GET /export_logs)
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [loadingExportLogs, setLoadingExportLogs] = useState(false);

  const onChangeFromDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowFromPicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      // keep range valid: from can't be after to
      setFromDate(selectedDate > toDate ? toDate : selectedDate);
    }
  };

  const onChangeToDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowToPicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      // keep range valid: to can't be before from
      setToDate(selectedDate < fromDate ? fromDate : selectedDate);
    }
  };

  const onChangeGraphFromDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowGraphFromPicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setGraphFromDate(selectedDate > graphToDate ? graphToDate : selectedDate);
    }
  };

  const onChangeGraphToDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowGraphToPicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setGraphToDate(selectedDate < graphFromDate ? graphFromDate : selectedDate);
    }
  };

  const onChangeLogDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowLogDatePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      setLogDate(selectedDate);
    }
  };

  // Load farm_id + user_id ng naka-login na user (parehong pattern ng monitor.tsx)
  useEffect(() => {
    (async () => {
      const fId = await getFarmId();
      const uId = await getUserId();
      setFarmId(fId);
      setUserId(uId);
    })();
  }, []);

  // Kumuha ng aggregated na daily data mula sa Flask /history endpoint.
  // Ito ang gumagawa ng AVG per day mula sa `sensor_readings` -- kaya
  // totoong datos na mula sa database ang nakikita sa graph, hindi na
  // hardcoded array.
  const fetchHistory = async (fId: number, days: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/history?farm_id=${fId}&days=${days}`);
      const data = await res.json();

      if (data.success) {
        setHistoryDays(data.days);
        setSummary(data.summary);
      }
    } catch (e) {
      console.log('HISTORY FETCH ERROR:', e);
    }
  };

  // Kumuha ng RAW per-reading logs (Sensor Log Records table) para sa
  // isang piniling araw lang (`logDate`), gamit ang bagong Flask endpoint
  // na `/history/logs` -- limit/offset ang pagination, kaya "Load more
  // records" ay dagdag na fetch lang na iaappend sa dulo ng listahan.
  // `reset=true` (bagong petsa napili, o unang load) -> palitan ang buong
  // listahan simula offset 0. `reset=false` (Load more button) -> idugtong
  // sa umiiral na listahan.
  const fetchLogs = async (fId: number, date: Date, reset: boolean) => {
    const offset = reset ? 0 : logsOffset;

    if (reset) {
      setLoadingLogs(true);
    } else {
      setLoadingMoreLogs(true);
    }

    try {
      const dateStr = toLocalIsoDate(date);
      const res = await fetch(
        `${API_BASE_URL}/history/logs?farm_id=${fId}&date=${dateStr}&limit=${LOGS_PAGE_SIZE}&offset=${offset}`
      );
      const data = await res.json();

      if (data.success) {
        setLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]));
        setLogsTotal(data.total);
        setLogsHasMore(data.has_more);
        setLogsOffset(offset + data.logs.length);
      }
    } catch (e) {
      console.log('HISTORY LOGS FETCH ERROR:', e);
    } finally {
      setLoadingLogs(false);
      setLoadingMoreLogs(false);
    }
  };

  const handleLoadMoreLogs = () => {
    if (farmId == null || loadingMoreLogs || !logsHasMore) return;
    fetchLogs(farmId, logDate, false);
  };

  // Kumuha ng recent export records mula sa Flask /export_logs endpoint --
  // ito yung audit trail na naisusulat na ng /history/export tuwing
  // may successful download. Tinatawag ito sa unang load at pagkatapos
  // ng bawat successful export, para laging updated ang listahan.
  const fetchExportLogs = async (fId: number) => {
    setLoadingExportLogs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/export_logs?farm_id=${fId}`);
      const data = await res.json();

      if (data.success) {
        setExportLogs(data.logs);
      }
    } catch (e) {
      console.log('EXPORT LOGS FETCH ERROR:', e);
    } finally {
      setLoadingExportLogs(false);
    }
  };

  useEffect(() => {
    if (farmId == null) return;

    setLoadingHistory(true);
    setSelected({ temp: null, sal: null, sun: null, ph: null });

    fetchHistory(farmId, range === '7' ? 7 : 30).finally(() => setLoadingHistory(false));
  }, [farmId, range]);

  useEffect(() => {
    if (farmId == null) return;
    fetchExportLogs(farmId);
  }, [farmId]);

  // Ire-refresh ang Sensor Log Records tuwing magpalit ng araw ang user
  // (calendar) o tuwing una itong ma-mount (may farmId na). Laging
  // "reset" mode ito -- babalik sa offset 0.
  useEffect(() => {
    if (farmId == null) return;
    fetchLogs(farmId, logDate, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId, logDate]);

  const handleRefresh = async () => {
    if (farmId == null) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetchHistory(farmId, range === '7' ? 7 : 30),
        fetchExportLogs(farmId),
        fetchLogs(farmId, logDate, true),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownload = async () => {
    if (farmId == null || userId == null) {
      Alert.alert('Error', 'Unable to identify your account. Please log in again.');
      return;
    }

    const from = toLocalIsoDate(fromDate);
    const to = toLocalIsoDate(toDate);
    const filename = `lato_report_${from}_to_${to}.${exportType}`;
    const fileUri = FileSystem.documentDirectory + filename;

    const url =
      `${API_BASE_URL}/history/export` +
      `?farm_id=${farmId}&user_id=${userId}&from=${from}&to=${to}&format=${exportType}`;

    setDownloading(true);
    try {
      const result = await FileSystem.downloadAsync(url, fileUri);

      if (result.status !== 200) {
        Alert.alert('Error', 'Unable to generate the report for that range.');
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri);
      } else {
        Alert.alert('Downloaded', `Report saved to:\n${result.uri}`);
      }

      // na-log na ito sa export_logs ng /history/export sa backend --
      // i-refresh lang natin yung listahan dito para makita agad ng user
      // yung bagong entry nang hindi na kailangan mag pull-to-refresh.
      fetchExportLogs(farmId);
    } catch (e) {
      console.log('EXPORT DOWNLOAD ERROR:', e);
      Alert.alert('Error', 'Failed to download report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // i-reorder papuntang laging Mon -> Sun ang pagkakasunod-sunod ng mga araw
  // sa 7-day view, kahit "last 7 days" (rolling window) pa rin ang tinatawag
  // sa backend -- para laging Monday ang unang column sa chart.
  const orderedHistoryDays = useMemo(() => {
    if (range !== '7') return historyDays;
    const mondayIndex = (iso: string) => {
      const day = isoToLocalDate(iso).getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      return day === 0 ? 6 : day - 1; // Mon=0, Tue=1, ..., Sun=6
    };
    return [...historyDays].sort((a, b) => mondayIndex(a.date) - mondayIndex(b.date));
  }, [historyDays, range]);

  // kung naka-enable ang "Filter by Date", i-narrow pa yung nakikitang
  // points papuntang nasa loob lang ng graphFromDate–graphToDate.
  // Client-side lang ito -- galing pa rin sa totoong data na na-fetch
  // na (max 30 days paatras), walang bagong query sa backend.
  const graphDays = useMemo(() => {
    if (!graphFilterEnabled) return orderedHistoryDays;
    const fromIso = toLocalIsoDate(graphFromDate);
    const toIso = toLocalIsoDate(graphToDate);
    return historyDays
      .filter((d) => d.date >= fromIso && d.date <= toIso)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [graphFilterEnabled, graphFromDate, graphToDate, historyDays, orderedHistoryDays]);

  const tempData = graphDays.map((d) => d.temperature);
  const salData = graphDays.map((d) => d.salinity);
  const sunData = graphDays.map((d) => d.sunlight);
  const phData = graphDays.map((d) => d.ph);
  const xLabels = graphDays.map((d) => d.label);
  const xDates = graphDays.map((d) => d.date);

  // para sa 30-day view (kapag walang date filter): "Week 1, Week 2..."
  // na lang sa bawat 7th day instead of pinagsiksik na daily weekday
  // labels, para hindi magkapatong-patong yung text sa x-axis. Kapag
  // naka-filter o 7-day view, actual per-day labels na lang.
  const displayLabels = useMemo(() => {
    if (graphFilterEnabled || range === '7') return xLabels;
    return graphDays.map((_, i) => (i % 7 === 0 ? `Week ${Math.floor(i / 7) + 1}` : ''));
  }, [range, graphFilterEnabled, graphDays, xLabels]);

  // responsive width to prevent overlap/cutoff
  const chartWidth = useMemo(() => {
    // screen padding (12*2) + card padding (12*2) + breathing room
    return Math.max(260, width - 12 * 2 - 12 * 2 - 10);
  }, [width]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Analytics</Text>
        <Text style={styles.headerSubtitle}>Historical Farm Sensor Data</Text>
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
                size={15}
                color="#fff"
              />
              <Text style={styles.modeBtnText}>{mode === 'graph' ? 'Table' : 'Graph'}</Text>
            </TouchableOpacity>
          </View>

          {mode === 'graph' && (
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Filter by Date</Text>
                <TouchableOpacity onPress={() => setGraphFilterEnabled((v) => !v)}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: graphFilterEnabled ? '#c9302c' : '#1f8f5f',
                    }}
                  >
                    {graphFilterEnabled ? 'Clear filter' : 'Enable filter'}
                  </Text>
                </TouchableOpacity>
              </View>

              {graphFilterEnabled && (
                <>
                  <View style={styles.dateRow}>
                    <View style={styles.dateField}>
                      <Text style={styles.dateLabel}>From</Text>
                      <TouchableOpacity
                        style={styles.dateInputBox}
                        onPress={() => setShowGraphFromPicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dateInputText}>{formatDateShort(graphFromDate)}</Text>
                        <Ionicons name="calendar-outline" size={14} color="#888" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dateField}>
                      <Text style={styles.dateLabel}>To</Text>
                      <TouchableOpacity
                        style={styles.dateInputBox}
                        onPress={() => setShowGraphToPicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dateInputText}>{formatDateShort(graphToDate)}</Text>
                        <Ionicons name="calendar-outline" size={14} color="#888" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.filterHint}>
                    Note: kasama lang dito ang datos sa loob ng kasalukuyang na-load na window
                    ({range === '7' ? 'last 7 days' : 'last 30 days'}). Piliin ang "30 days" tab kung
                    kailangan mo ng mas malawak na range.
                  </Text>

                  {showGraphFromPicker && (
                    <DateTimePicker
                      value={graphFromDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      maximumDate={graphToDate}
                      onChange={onChangeGraphFromDate}
                    />
                  )}
                  {showGraphToPicker && (
                    <DateTimePicker
                      value={graphToDate}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      minimumDate={graphFromDate}
                      onChange={onChangeGraphToDate}
                    />
                  )}
                </>
              )}
            </View>
          )}

          {mode === 'graph' ? (
            <View style={styles.card}>
              {loadingHistory ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#2e8b57" />
                  <Text style={styles.loadingText}>Loading sensor history...</Text>
                </View>
              ) : graphDays.length === 0 ? (
                <View style={styles.loadingBox}>
                  <Ionicons name="calendar-outline" size={22} color="#aaa" />
                  <Text style={styles.loadingText}>No data in the selected date range.</Text>
                </View>
              ) : (
                <>
                  {/* ===== Water Temperature ===== */}
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Water Temperature (°C)</Text>
                    <View style={styles.rangeBadge}>
                      <Text style={styles.rangeBadgeText}>
                        Safe: {SAFE_RANGES.temp.min}–{SAFE_RANGES.temp.max}{SAFE_RANGES.temp.unit}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chartWrap}>
                    <SafeRangeChart
                      data={tempData}
                      labels={displayLabels}
                      dates={xDates}
                      color="#1f8f5f"
                      min={SAFE_RANGES.temp.min}
                      max={SAFE_RANGES.temp.max}
                      axisMax={50}
                      axisStep={5}
                      width={chartWidth}
                      unit={SAFE_RANGES.temp.unit}
                      decimals={1}
                      selectedIndex={selected.temp}
                      onSelect={(i) => setSelected((s) => ({ ...s, temp: i }))}
                    />
                  </View>
                  <Text style={styles.captionGreen}>Temperature (°C) · tap a dot to see its date</Text>

                  {/* ===== Salinity ===== */}
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Salinity (ppt)</Text>
                    <View style={styles.rangeBadge}>
                      <Text style={styles.rangeBadgeText}>
                        Safe: {SAFE_RANGES.sal.min}–{SAFE_RANGES.sal.max}{SAFE_RANGES.sal.unit}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chartWrap}>
                    <SafeRangeChart
                      data={salData}
                      labels={displayLabels}
                      dates={xDates}
                      color="#d4a019"
                      min={SAFE_RANGES.sal.min}
                      max={SAFE_RANGES.sal.max}
                      axisMax={40}
                      axisStep={5}
                      width={chartWidth}
                      unit={SAFE_RANGES.sal.unit}
                      decimals={1}
                      selectedIndex={selected.sal}
                      onSelect={(i) => setSelected((s) => ({ ...s, sal: i }))}
                    />
                  </View>
                  <Text style={styles.captionYellow}>Salinity (ppt) · tap a dot to see its date</Text>

                  {/* ===== Sunlight ===== */}
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>Sunlight Intensity (W/m²)</Text>
                    <View style={styles.rangeBadge}>
                      <Text style={styles.rangeBadgeText}>
                        Safe: {SAFE_RANGES.sun.min}–{SAFE_RANGES.sun.max}{SAFE_RANGES.sun.unit}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chartWrap}>
                    <SafeRangeChart
                      data={sunData}
                      labels={displayLabels}
                      dates={xDates}
                      color="#2b7de9"
                      min={SAFE_RANGES.sun.min}
                      max={SAFE_RANGES.sun.max}
                      axisMax={1000}
                      axisStep={100}
                      width={chartWidth}
                      unit={SAFE_RANGES.sun.unit}
                      decimals={0}
                      selectedIndex={selected.sun}
                      onSelect={(i) => setSelected((s) => ({ ...s, sun: i }))}
                    />
                  </View>
                  <Text style={styles.captionBlue}>Sunlight Intensity (W/m²) · tap a dot to see its date</Text>

                  {/* ===== pH ===== */}
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionTitle}>pH Level</Text>
                    <View style={styles.rangeBadge}>
                      <Text style={styles.rangeBadgeText}>
                        Safe: {SAFE_RANGES.ph.min}–{SAFE_RANGES.ph.max}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.chartWrap}>
                    <SafeRangeChart
                      data={phData}
                      labels={displayLabels}
                      dates={xDates}
                      color="#8e5fd1"
                      min={SAFE_RANGES.ph.min}
                      max={SAFE_RANGES.ph.max}
                      axisMax={9}
                      axisStep={1}
                      width={chartWidth}
                      unit=""
                      decimals={2}
                      selectedIndex={selected.ph}
                      onSelect={(i) => setSelected((s) => ({ ...s, ph: i }))}
                    />
                  </View>
                  <Text style={styles.captionPurple}>
                    pH Level · tap a dot to see its date{phData.every((v) => v === null) ? ' (no pH sensor data yet)' : ''}
                  </Text>

                  <View style={styles.summaryStrip}>
                    <Text style={styles.summaryTitle}>
                      {graphFilterEnabled ? 'Filtered' : range === '7' ? 'Weekly' : '30-Day'} Summary
                    </Text>
                    <View style={styles.summaryRow}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Avg Temp</Text>
                        <Text style={styles.summaryValue}>
                          {summary.avg_temp !== null ? `${summary.avg_temp}°C` : '--'}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Avg Salinity</Text>
                        <Text style={styles.summaryValue}>
                          {summary.avg_salinity !== null ? `${summary.avg_salinity}ppt` : '--'}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Avg Sunlight</Text>
                        <Text style={styles.summaryValue}>
                          {summary.avg_sunlight !== null ? `${summary.avg_sunlight}W/m²` : '--'}
                        </Text>
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Avg pH</Text>
                        <Text style={styles.summaryValue}>
                          {summary.avg_ph !== null ? summary.avg_ph : '--'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Sensor Log Records</Text>
                <Ionicons name="information-circle-outline" size={15} color="#999" />
              </View>

              {/* Petsa na pipiliin -- default: ngayong araw. Bawat palit ng
                  petsa dito ay nagre-reset ng listahan (offset 0) at
                  nagkukuha ng bagong batch mula sa /history/logs. */}
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.dateInputBox}
                  onPress={() => setShowLogDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateInputText}>{formatDateLong(logDate)}</Text>
                  <Ionicons name="calendar-outline" size={14} color="#888" />
                </TouchableOpacity>
              </View>

              {showLogDatePicker && (
                <DateTimePicker
                  value={logDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  maximumDate={new Date()}
                  onChange={onChangeLogDate}
                />
              )}

              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1.1 }]}>Time</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Temp.</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Sal.</Text>
                <Text style={[styles.th, { flex: 0.9 }]}>Sun.</Text>
                <Text style={[styles.th, { flex: 0.6 }]}>pH</Text>
                <Text style={[styles.th, { flex: 1.1, textAlign: 'right' }]}>Status</Text>
              </View>

              {loadingLogs ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#2e8b57" />
                  <Text style={styles.loadingText}>Loading sensor logs...</Text>
                </View>
              ) : logs.length === 0 ? (
                <View style={styles.loadingBox}>
                  <Ionicons name="document-text-outline" size={22} color="#aaa" />
                  <Text style={styles.loadingText}>No sensor readings for this date.</Text>
                </View>
              ) : (
                logs.map((r) => (
                  <View key={r.id} style={styles.tableRow}>
                    <Text style={[styles.td, { flex: 1.1 }]}>{r.time}</Text>
                    <Text style={[styles.td, { flex: 0.9 }]}>
                      {r.water_temp !== null ? `${r.water_temp.toFixed(1)}°` : '--'}
                    </Text>
                    <Text style={[styles.td, { flex: 0.9 }]}>
                      {r.salinity !== null ? `${r.salinity.toFixed(1)}ppt` : '--'}
                    </Text>
                    <Text style={[styles.td, { flex: 0.9 }]}>
                      {r.sunlight !== null ? `${r.sunlight.toFixed(0)}W/m²` : '--'}
                    </Text>
                    <Text style={[styles.td, { flex: 0.6 }]}>
                      {r.ph_level !== null ? r.ph_level.toFixed(1) : '--'}
                    </Text>
                    <View style={{ flex: 1.1, alignItems: 'flex-end' }}>
                      <View
                        style={[
                          styles.statusPill,
                          r.status === 'normal'
                            ? styles.normalPill
                            : r.status === 'warning'
                            ? styles.warningPill
                            : styles.criticalPill,
                        ]}
                      >
                        <Text style={styles.statusPillText}>
                          {r.status === 'normal' ? 'Normal' : r.status === 'warning' ? 'Warning' : 'Critical'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}

              {!loadingLogs && logs.length > 0 && logsHasMore && (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, loadingMoreLogs && { opacity: 0.6 }]}
                  onPress={handleLoadMoreLogs}
                  disabled={loadingMoreLogs}
                >
                  {loadingMoreLogs ? (
                    <ActivityIndicator size="small" color="#555" />
                  ) : (
                    <>
                      <Text style={styles.loadMoreText}>Load more records</Text>
                      <Ionicons name="arrow-down" size={14} color="#555" />
                    </>
                  )}
                </TouchableOpacity>
              )}

              {!loadingLogs && logs.length > 0 && !logsHasMore && (
                <Text style={styles.filterHint}>
                  Showing all {logsTotal} record{logsTotal === 1 ? '' : 's'} for {formatDateLong(logDate)}.
                </Text>
              )}
            </View>
          )}

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Export Data</Text>
              <Ionicons name="information-circle-outline" size={15} color="#999" />
            </View>

            <View style={styles.dateRangeHeader}>
              <Ionicons name="calendar-outline" size={15} color="#111" />
              <Text style={styles.dateRangeTitle}>Select Date Range</Text>
            </View>

            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>From</Text>
                <TouchableOpacity
                  style={styles.dateInputBox}
                  onPress={() => setShowFromPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateInputText}>{formatDateShort(fromDate)}</Text>
                  <Ionicons name="calendar-outline" size={14} color="#888" />
                </TouchableOpacity>
              </View>

              <View style={styles.dateField}>
                <Text style={styles.dateLabel}>To</Text>
                <TouchableOpacity
                  style={styles.dateInputBox}
                  onPress={() => setShowToPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateInputText}>{formatDateShort(toDate)}</Text>
                  <Ionicons name="calendar-outline" size={14} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            {showFromPicker && (
              <DateTimePicker
                value={fromDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={toDate}
                onChange={onChangeFromDate}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={toDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={fromDate}
                onChange={onChangeToDate}
              />
            )}

            <View style={styles.selectedRangeBox}>
              <View style={styles.selectedRangeHeaderRow}>
                <Ionicons name="information-circle-outline" size={14} color="#1f8f5f" />
                <Text style={styles.selectedRangeHeaderText}>Selected Range</Text>
              </View>
              <Text style={styles.selectedRangeDates}>
                {formatDateLong(fromDate)} - {formatDateLong(toDate)}
              </Text>
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

            <TouchableOpacity
              style={[styles.downloadBtn, downloading && { opacity: 0.7 }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={15} color="#fff" />
              )}
              <Text style={styles.downloadBtnText}>
                {downloading ? 'Preparing report...' : 'Download All Report'}
              </Text>
            </TouchableOpacity>

            {/* ===== Recent Exports (galing sa GET /export_logs) ===== */}
            <View style={styles.recentExportsHeader}>
              <Text style={styles.recentExportsTitle}>Recent Exports</Text>
              {loadingExportLogs && <ActivityIndicator size="small" color="#2e8b57" />}
            </View>

            {!loadingExportLogs && exportLogs.length === 0 ? (
              <Text style={styles.recentExportsEmpty}>No exports yet.</Text>
            ) : (
              exportLogs.map((log) => (
                <View key={log.id} style={styles.exportLogRow}>
                  <View
                    style={[
                      styles.exportLogIcon,
                      log.export_type === 'csv' ? styles.exportLogIconCsv : styles.exportLogIconPdf,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={log.export_type === 'csv' ? 'file-delimited-outline' : 'file-pdf-box'}
                      size={15}
                      color={log.export_type === 'csv' ? '#1f8f5f' : '#d9534f'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exportLogFile}>{log.file_path}</Text>
                    <Text style={styles.exportLogMeta}>
                      {formatExportedAt(log.created_at)} · {log.range_days} day{log.range_days === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f5f5' },
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

  body: { paddingHorizontal: 12, paddingTop: 10 },

  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  rangeTabs: { flexDirection: 'row', gap: 8 },
  tabBtn: {
  backgroundColor: '#f1f1f1',
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 16,
  alignItems: 'center',
  justifyContent: 'center',
},

tabBtnActive: {
  backgroundColor: '#2e8b57',
},

tabText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#555',
},

tabTextActive: {
  color: '#fff',
},  

  modeBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#2e8b57',
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 16,
},

modeBtnText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 12,
  marginLeft: 5,
},

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    padding: 12,
    marginBottom: 10,
  },

  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: '#777',
    fontWeight: '600',
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111' },

  rangeBadge: {
    backgroundColor: '#fdeceb',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rangeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c9302c',
  },

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

  dotTooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderWidth: 1.2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: -6,
    marginBottom: 6,
  },
  dotTooltipText: {
    fontSize: 11,
    fontWeight: '700',
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
  captionBlue: {
    textAlign: 'center',
    fontSize: 10,
    color: '#2b7de9',
    marginTop: 2,
    marginBottom: 8,
  },
  captionPurple: {
    textAlign: 'center',
    fontSize: 10,
    color: '#8e5fd1',
    marginTop: 2,
    marginBottom: 8,
  },

  filterHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    lineHeight: 14,
  },

  summaryStrip: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 10,
    padding: 10,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', color: '#333', marginBottom: 6 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  summaryItem: { width: '50%' },
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
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },

  loadMoreText: {
    color: '#555',
    fontWeight: '700',
    fontSize: 12,
    marginRight: 5,
  },

  dateRangeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 10,
  },
  dateRangeTitle: { fontSize: 14, fontWeight: '700', color: '#111' },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dateField: { flex: 1, marginBottom: 12 },
  dateLabel: { fontSize: 11, color: '#1f8f5f', fontWeight: '700', marginBottom: 5 },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dateInputText: { fontSize: 12, color: '#333', fontWeight: '600' },

  selectedRangeBox: {
    backgroundColor: '#e7f7ec',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  selectedRangeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  selectedRangeHeaderText: { fontSize: 12, fontWeight: '700', color: '#1f8f5f' },
  selectedRangeDates: { fontSize: 12, color: '#1f8f5f', fontWeight: '600' },

  exportLabel: { marginTop: 4, fontSize: 14, fontWeight: '700', color: '#111' },
  formatRow: { flexDirection: 'row', gap: 10, marginTop: 8 },

  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 0,
  },
  csvBtn: {
    backgroundColor: '#e7f5ec',
    borderColor: '#e7f5ec',
  },
  pdfBtn: {
    backgroundColor: '#f1f1f1',
    borderColor: '#f1f1f1',
  },
  csvText: { color: '#1f8f5f', fontWeight: '800', fontSize: 14 },
  pdfText: { color: '#c93d3a', fontWeight: '800', fontSize: 14 },
  formatBtnActive: {
    borderWidth: 2,
    borderColor: '#2e8b57',
  },

  downloadBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#2e8b57',
  paddingVertical: 11,
  borderRadius: 18,
  marginTop: 14,
},

downloadBtnText: {
  color: '#fff',
  fontWeight: '700',
  fontSize: 13,
  marginLeft: 6,
},

  recentExportsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  recentExportsTitle: { fontSize: 13, fontWeight: '800', color: '#111' },
  recentExportsEmpty: { fontSize: 11, color: '#999', paddingVertical: 6 },

  exportLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  exportLogIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportLogIconCsv: { backgroundColor: '#e7f5ec' },
  exportLogIconPdf: { backgroundColor: '#fdeceb' },
  exportLogFile: { fontSize: 12, fontWeight: '700', color: '#222' },
  exportLogMeta: { fontSize: 10, color: '#888', marginTop: 2 },
});
