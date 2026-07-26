import LeafletMap from '@/components/leaflet-map';
import SensorCard from '@/components/sensor-card';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const FARM_LOCATION = {
  latitude: 13.83775,
  longitude: 120.6190,
};

export default function HomeScreen() {
  const [mapExpanded, setMapExpanded] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [salinity, setSalinity] =
    useState('--');

  const [temperature, setTemperature] =
    useState('--');

  const [sunlight, setSunlight] =
    useState('--');

  const [salinityStatus,
    setSalinityStatus] =
    useState<
      'normal'
      | 'warning'
      | 'critical'
      | 'no-data'
    >('no-data');

  // Nilabas mula sa useEffect papuntang component scope para magamit
  // din ng pull-to-refresh handler sa baba (handleRefresh).
  const fetchSalinity = async () => {
    try {

      const response =
        await fetch(
          'http://192.168.1.6:5000/salinity'
        );

      const data =
        await response.json();

      const value =
        Number(data.salinity);

      setSalinity(
        value.toFixed(2)
      );

      if (
        value >= 28 &&
        value <= 36
      ) {
        setSalinityStatus(
          'normal'
        );
      }
      else if (
        (value >= 25 &&
          value < 28) ||
        (value > 36 &&
          value <= 38)
      ) {
        setSalinityStatus(
          'warning'
        );
      }
      else {
        setSalinityStatus(
          'critical'
        );
      }

    } catch (error) {

      console.log(
        'SALINITY ERROR:',
        error
      );

      setSalinity('--');
      setSalinityStatus(
        'no-data'
      );
    }
  };

  const fetchEnvironment =
    async () => {

    try {

      const response =
        await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=13.83775&longitude=120.6190&current=temperature_2m,shortwave_radiation'
        );

      const data =
        await response.json();

      console.log(
        'OPEN METEO:',
        data
      );

      setTemperature(
        data.current
          ?.temperature_2m
          ?.toString() ??
          '--'
      );

      setSunlight(
        data.current
          ?.shortwave_radiation
          ?.toString() ??
          '--'
      );

    }
    catch (error) {

      console.log(
        'OPEN METEO ERROR:',
        error
      );

      setTemperature('--');
      setSunlight('--');
    }
  };

useEffect(() => {

  fetchSalinity();
  fetchEnvironment();

  const interval =
    setInterval(() => {

      fetchSalinity();
      fetchEnvironment();

    }, 900000);

  return () =>
    clearInterval(interval);

}, []);

  // Pull-to-refresh handler — pareho ng ginamit sa monitor.tsx
  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([
        fetchSalinity(),
        fetchEnvironment(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.header}>
          <Text style={styles.headerTitle}>
            🌱 Lato Farm Monitor
          </Text>

          <Text style={styles.headerSubtitle}>
            Brgy. Uno, Calatagan, Batangas
          </Text>
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
        

        <View style={styles.card}>
          
          <Text style={styles.sectionTitle}>
            Live Sensor Readings
          </Text>

          <View style={styles.grid}>
 <SensorCard
  emoji="🌡️"
  label="Water Temp"
  value={temperature}
  unit="°C"
  status={
    temperature === '--'
      ? 'no-data'
      : Number(
          temperature
        ) >= 25 &&
        Number(
          temperature
        ) <= 30
      ? 'normal'
      : 'warning'
  }
  safeRange="25-30 °C"
  infoText="Real-time temperature from Open-Meteo"
/>

            <SensorCard
              emoji="💧"
              label="Salinity"
              value={salinity}
              unit="ppt"
              status={salinityStatus}
              safeRange="28-36 ppt"
              infoText="Near-real-time salinity data from Copernicus Marine"
            />

            <SensorCard
              emoji="🧪"
              label="pH Level"
              value="0"
              unit="pH"
              status="no-data"
              safeRange="7.5-8.5"
            />

<SensorCard
  emoji="☀️"
  label="Sunlight"
  value={sunlight}
  unit="lux"
  status={
    sunlight === '--'
      ? 'no-data'
      : Number(
          sunlight
        ) >= 400 &&
        Number(
          sunlight
        ) <= 800
      ? 'normal'
      : 'warning'
  }
  safeRange="400-800 lux"
  infoText="Real-time solar radiation from Open-Meteo"
/>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.mapHeaderRow}>
            <Text style={styles.sectionTitle}>
              Farm Location
            </Text>

            <TouchableOpacity
              style={styles.maximizeBtn}
              onPress={() => setMapExpanded(true)}
            >
              <Ionicons
                name="expand"
                size={16}
                color="#2e8b57"
              />
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
          <Text style={styles.guideTitle}>
            Status Color Guide
          </Text>

          <View style={styles.guideRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: '#2e8b57' },
              ]}
            />
            <Text style={styles.guideText}>
              Green = Normal
            </Text>
          </View>

          <View style={styles.guideRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: '#e6a817' },
              ]}
            />
            <Text style={styles.guideText}>
              Yellow = Warning
            </Text>
          </View>

          <View style={styles.guideRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: '#d9534f' },
              ]}
            />
            <Text style={styles.guideText}>
              Red = Critical
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={mapExpanded}
        animationType="slide"
        onRequestClose={() =>
          setMapExpanded(false)
        }
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Farm Location
            </Text>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() =>
                setMapExpanded(false)
              }
            >
              <Ionicons
                name="close"
                size={22}
                color="#333"
              />
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

const styles = StyleSheet.create({

safe:{
  flex:1,
  backgroundColor:'#f4f8f5',
},


scroll:{
  paddingBottom:30,
},


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

card:{
  backgroundColor:'#fff',
  marginHorizontal:16,
  marginTop:18,
  borderRadius:22,
  padding:18,

  shadowColor:'#000',
  shadowOffset:{
    width:0,
    height:5
  },
  shadowOpacity:0.08,
  shadowRadius:10,

  elevation:4,
},



sectionTitle:{
  fontSize:18,
  fontWeight:'900',
  color:'#163d27',
  marginBottom:12,
},



grid:{
  flexDirection:'row',
  flexWrap:'wrap',
  justifyContent:'space-between',
},



mapHeaderRow:{
  flexDirection:'row',
  justifyContent:'space-between',
  alignItems:'center',
},



maximizeBtn:{
  width:38,
  height:38,
  borderRadius:19,
  backgroundColor:'#e6f5ec',

  justifyContent:'center',
  alignItems:'center',
},



mapWrapper:{
  marginTop:12,
  borderRadius:20,
  overflow:'hidden',

  shadowColor:'#000',
  shadowOpacity:.1,
  shadowRadius:8,
  elevation:3,
},




guideCard:{
  backgroundColor:'#e9f7ee',
  margin:16,
  borderRadius:22,
  padding:20,
},


guideTitle:{
  fontSize:17,
  fontWeight:'900',
  color:'#205c3b',
  marginBottom:14,
},


guideRow:{
  flexDirection:'row',
  alignItems:'center',
  marginBottom:12,
},


dot:{
  width:12,
  height:12,
  borderRadius:6,
  marginRight:12,
},


guideText:{
  fontSize:14,
  color:'#333',
  fontWeight:'600',
},




modalSafe:{
  flex:1,
  backgroundColor:'#fff',
},


modalHeader:{
  flexDirection:'row',
  justifyContent:'space-between',
  alignItems:'center',
  paddingHorizontal:20,
  paddingVertical:15,
},


modalTitle:{
  fontSize:20,
  fontWeight:'900',
  color:'#1b1b1b',
},


closeBtn:{
  width:40,
  height:40,
  borderRadius:20,
  backgroundColor:'#eee',

  justifyContent:'center',
  alignItems:'center',
},


modalMapWrapper:{
  flex:1,
},


});
