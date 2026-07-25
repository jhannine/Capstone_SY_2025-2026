import LeafletMap from '@/components/leaflet-map';
import SensorCard from '@/components/sensor-card';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const FARM_LOCATION = {
  latitude: 13.8321,
  longitude: 120.6412,
};

interface TourSlide {
  icon: string;
  title: string;
  desc: string;
}

const SLIDES: TourSlide[] = [
  {
    icon: '🍇',
    title: 'Welcome to LatoMonitorPH!',
    desc: "Your smart seaweed farm monitoring system. Let's take a quick tour to help you get started.",
  },
  {
    icon: '🌡️',
    title: 'Monitor Your Farm',
    desc: 'View real-time sensor data: Water Temperature, Salinity (salt content), pH Level (acidity), and Sunlight intensity. Tap the info icons to learn what each means!',
  },
  {
    icon: '🔔',
    title: 'Get Instant Alerts',
    desc: 'Receive notifications when water conditions go outside safe ranges. You can customize alert thresholds in Settings.',
  },
  {
    icon: '📋',
    title: 'Track History',
    desc: 'View graphs and trends over days or weeks. Export data as CSV or PDF for your records.',
  },
  {
    icon: '👤',
    title: "You're All Set!",
    desc: 'Tap on any label with an info icon (ⓘ) to learn more. Visit Help anytime for guides and FAQs. Happy farming!',
  },
];

export default function HomeScreen() {
  const [mapExpanded, setMapExpanded] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTourVisible(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const finishTour = () => {
    setTourVisible(false);
  };

  const nextSlide = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex((i) => i + 1);
    } else {
      finishTour();
    }
  };

  const skipTour = () => {
    finishTour();
  };

  const slide = SLIDES[slideIndex];
  const isLastSlide = slideIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <Modal visible={tourVisible} transparent animationType="fade">
        <View style={styles.tourOverlay}>
          <View style={styles.tourCard}>
            <Text style={styles.tourIcon}>{slide.icon}</Text>
            <Text style={styles.tourTitle}>{slide.title}</Text>
            <Text style={styles.tourDesc}>{slide.desc}</Text>

            <View style={styles.tourDots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dotPager, i === slideIndex && styles.dotPagerActive]}
                />
              ))}
            </View>

            <View style={styles.tourBtns}>
              <TouchableOpacity style={styles.btnSkip} onPress={skipTour}>
                <Text style={styles.btnSkipText}>Skip</Text>
                <Ionicons name="play-forward" size={14} color="#444" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnNext} onPress={nextSlide}>
                <Text style={styles.btnNextText}>{isLastSlide ? 'Done' : 'Next'}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.tourCounter}>
              {slideIndex + 1} of {SLIDES.length}
            </Text>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Good Day, Lato Farmer</Text>
        <Text style={styles.headerSubtitle}>Brgy. Uno, Calatagan, Batangas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Live Sensor Readings</Text>
          <View style={styles.grid}>
            <SensorCard emoji="🌡️" label="Water Temp" value="0" unit="°C" status="no-data" safeRange="25-30 °C" />
            <SensorCard emoji="💧" label="Salinity" value="0" unit="ppt" status="no-data" safeRange="28-36 ppt" />
            <SensorCard emoji="🧪" label="pH Level" value="0" unit="pH" status="no-data" safeRange="7.5-8.5" />
            <SensorCard emoji="☀️" label="Sunlight" value="0" unit="lux" status="no-data" safeRange="400-800 lux" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.mapHeaderRow}>
            <Text style={styles.sectionTitle}>Farm Location</Text>
            <TouchableOpacity style={styles.maximizeBtn} onPress={() => setMapExpanded(true)}>
              <Ionicons name="expand" size={16} color="#2e8b57" />
            </TouchableOpacity>
          </View>

          <View style={styles.mapWrapper}>
            <LeafletMap
              latitude={FARM_LOCATION.latitude}
              longitude={FARM_LOCATION.longitude}
              markerLabel="Lato Farm"
              height={220}
            />
          </View>
        </View>

        <View style={styles.guideCard}>
          <Text style={styles.guideTitle}>Status Color Guide</Text>
          <View style={styles.guideRow}>
            <View style={[styles.dot, { backgroundColor: '#2e8b57' }]} />
            <Text style={styles.guideText}>Green = Normal (optimal for growth)</Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.dot, { backgroundColor: '#e6a817' }]} />
            <Text style={styles.guideText}>Yellow = Warning (monitor closely)</Text>
          </View>
          <View style={styles.guideRow}>
            <View style={[styles.dot, { backgroundColor: '#d9534f' }]} />
            <Text style={styles.guideText}>Red = Critical (take action now)</Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={mapExpanded}
        animationType="slide"
        onRequestClose={() => setMapExpanded(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Farm Location</Text>
            <TouchableOpacity onPress={() => setMapExpanded(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#333" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalMapWrapper}>
            <LeafletMap
              latitude={FARM_LOCATION.latitude}
              longitude={FARM_LOCATION.longitude}
              markerLabel="Lato Farm"
              height={9999}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = '#3aaa6e';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { paddingBottom: 24 },
  header: { backgroundColor: '#2e8b57', paddingTop: 45, paddingBottom: 40, paddingHorizontal: 20 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerSubtitle: { color: '#e3f3ea', fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  maximizeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e7f5ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapWrapper: { borderRadius: 14, overflow: 'hidden' },
  guideCard: { backgroundColor: '#e7f5ec', marginHorizontal: 16, marginTop: 16, borderRadius: 18, padding: 18 },
  guideTitle: { fontSize: 16, fontWeight: '800', color: '#1f5c3a', marginBottom: 10 },
  guideRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  guideText: { fontSize: 13, color: '#333' },

  modalSafe: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMapWrapper: { flex: 1 },

  tourOverlay: {
    flex: 1,
    backgroundColor: 'rgba(100,160,120,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tourCard: {
    backgroundColor: '#f0f9f4',
    borderRadius: 24,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  tourIcon: { fontSize: 44, marginBottom: 16 },
  tourTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1a3d28',
    marginBottom: 14,
    textAlign: 'center',
  },
  tourDesc: {
    fontSize: 13,
    color: '#3a5a44',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  tourDots: { flexDirection: 'row', gap: 7, marginBottom: 24 },
  dotPager: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#b0d4bc' },
  dotPagerActive: { backgroundColor: GREEN, transform: [{ scale: 1.2 }] },
  tourBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  btnSkip: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnSkipText: { fontSize: 13, fontWeight: '600', color: '#444' },
  btnNext: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: GREEN,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnNextText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  tourCounter: { marginTop: 14, fontSize: 12, color: '#7a9e86', fontWeight: '500' },
});
