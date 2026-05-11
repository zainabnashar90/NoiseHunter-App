import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, FlatList, ActivityIndicator,
  Animated, Platform, DeviceEventEmitter
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
const SERVER_URL = 'https://quitezone-backend.onrender.com';

export default function ExploreScreen() {
  const [onlineDevices, setOnlineDevices] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  // ✅ FIX 1: الافتراضي true لتتناسق مع بقية الشاشات
  const [isDarkMode, setIsDarkMode] = useState(true);
  const socket = useRef<any>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loadTheme = async () => {
      const savedMode = await AsyncStorage.getItem('darkMode');
      setIsDarkMode(savedMode === 'true');
    };
    loadTheme();

    const subscription = DeviceEventEmitter.addListener('themeChanged', (isDark: boolean) => {
      setIsDarkMode(isDark);
    });

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();

 socket.current = io(SERVER_URL, {
    transports: ['websocket'],
  });

  // ----------------------------------------------------
    // هنا الجزء الجديد الذي سأضيفه (مستمعات الأحداث)
    // ----------------------------------------------------

    socket.current.on('connect', async () => {
      setIsConnected(true);

      
      let { status } = await Location.requestForegroundPermissionsAsync();
    let locationData: { lat: number | null; lng: number | null } = { lat: null, lng: null };

      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          locationData = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch (error) {
          console.log("Error getting location", error);
        }
      }

     
      const deviceDisplayName = Device.modelName || Device.designName || Platform.OS;

      socket.current.emit('register-device', {
        pushToken: null,
        deviceName: deviceDisplayName,
        lat: locationData.lat,
        lng: locationData.lng,
       noiseLevel: 0
      });
    });

    socket.current.on('update-device-list', (devices: any[]) => {
      setOnlineDevices(devices);
    });
    socket.current.on('disconnect', () => {
      setIsConnected(false);
      setOnlineDevices([]);
    });
    return () => {
      if (socket.current) socket.current.disconnect();
    };
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const theme = {
    bg: isDarkMode ? '#0a0e14' : '#F0F2F5',
    headerBg: isDarkMode ? '#0f172a' : '#ffffff',
    accent: isDarkMode ? '#00ffcc' : '#9b59b6',
    text: isDarkMode ? '#f8fafc' : '#2c3e50',
    subText: isDarkMode ? '#475569' : '#95a5a6',
    card: isDarkMode ? '#111827' : '#ffffff',
    border: isDarkMode ? '#1f2937' : '#e2e8f0',
  };

 const renderDeviceItem = ({ item }: { item: any }) => (
  <View style={[styles.cyberCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
    <View style={[styles.cardGlow, { backgroundColor: theme.accent }]} />
    
    <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? '#1e293b' : '#f1f2f6' }]}>
      <MaterialCommunityIcons
        name={item.deviceName?.toLowerCase().includes('iphone') || item.deviceName === 'ios' ? 'apple' : 'android'}
        size={24}
        color={theme.accent}
      />
    </View>

    <View style={styles.deviceInfo}>
      <Text style={[styles.deviceName, { color: theme.text }]}>
        {item.deviceName || 'Unknown Node'}
      </Text>
      
      {/* 🔊 إضافة مستوى الضوضاء هنا */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <MaterialCommunityIcons 
          name="volume-high" 
          size={14} 
          color={item.noiseLevel > 70 ? '#ff4757' : theme.accent} 
        />
        <Text style={{ color: item.noiseLevel > 70 ? '#ff4757' : theme.accent, fontSize: 12, marginLeft: 4, fontWeight: 'bold' }}>
          {item.noiseLevel ? `${item.noiseLevel} dB` : '-- dB'}
        </Text>
        
        {/* 📍 إضافة مؤشر وجود الموقع */}
        {item.lat && (
          <MaterialCommunityIcons 
            name="map-marker-outline" 
            size={12} 
            color={theme.subText} 
            style={{ marginLeft: 10 }} 
          />
        )}
      </View>

      <Text style={[styles.deviceTime, { color: theme.subText }]}>
        {item.connectedAt ? new Date(item.connectedAt).toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }) : ''}
      </Text>
    </View>

    <View style={styles.statusBox}>
      <View style={[styles.pulseDot, { backgroundColor: isDarkMode ? '#00ffcc' : '#2ecc71' }]} />
      <Text style={[styles.liveText, { color: isDarkMode ? '#00ffcc' : '#2ecc71' }]}>ACTIVE</Text>
    </View>
  </View>
);

  // ✅ FIX 4: حالة فارغة عند الاتصال بدون أجهزة
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="radar" size={60} color={theme.subText} />
      <Text style={[styles.emptyText, { color: theme.subText }]}>لا توجد أجهزة متصلة حالياً</Text>
      <Text style={[styles.emptySubText, { color: theme.subText }]}>NO NODES DETECTED</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.radarHeader,
          {
            backgroundColor: theme.headerBg,
            borderBottomColor: isDarkMode ? '#00ffcc22' : '#eee'
          }
        ]}
      >
        <View style={[styles.radarCircle, { borderColor: isDarkMode ? '#00ffcc44' : '#9b59b622' }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialCommunityIcons name="target" size={100} color={theme.accent} />
          </Animated.View>
          <View style={[styles.radarLine, { backgroundColor: isDarkMode ? '#00ffcc33' : '#9b59b611' }]} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>SYSTEM RADAR</Text>
        <Text style={[styles.headerSub, { color: theme.subText }]}>SCANNING NETWORK NODES</Text>

        {/* ✅ FIX 5: مؤشر الاتصال */}
        <View style={[styles.connectionPill, { backgroundColor: isConnected ? '#00ffcc22' : '#e74c3c22', borderColor: isConnected ? '#00ffcc' : '#e74c3c' }]}>
          <View style={[styles.connectionDot, { backgroundColor: isConnected ? '#00ffcc' : '#e74c3c' }]} />
          <Text style={[styles.connectionText, { color: isConnected ? '#00ffcc' : '#e74c3c' }]}>
            {isConnected ? `ONLINE · ${onlineDevices.length} NODE${onlineDevices.length !== 1 ? 'S' : ''}` : 'OFFLINE'}
          </Text>
        </View>
      </View>

      <View style={styles.listSection}>
        {!isConnected ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.connectingText, { color: theme.subText }]}>جاري الاتصال بالشبكة...</Text>
          </View>
        ) : (
          <FlatList
            data={onlineDevices}
            keyExtractor={(item) => item.socketId || item.localIP || Math.random().toString()}
            renderItem={renderDeviceItem}
            contentContainerStyle={[
              styles.listContainer,
              onlineDevices.length === 0 && styles.listContainerEmpty
            ]}
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  radarHeader: {
    height: 320, justifyContent: 'center', alignItems: 'center',
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    borderBottomWidth: 1,
  },
  radarCircle: {
    width: 150, height: 150, borderRadius: 75, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center'
  },
  radarLine: { position: 'absolute', width: '100%', height: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 4, marginTop: 16 },
  headerSub: { fontSize: 10, fontWeight: 'bold', marginTop: 5, letterSpacing: 1 },
  connectionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  listSection: { flex: 1 },
  listContainer: { padding: 20 },
  listContainerEmpty: { flex: 1, justifyContent: 'center' },
  cyberCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 15,
    padding: 15, marginBottom: 12, borderWidth: 1, overflow: 'hidden',
    elevation: 2, shadowOpacity: 0.05
  },
  cardGlow: { position: 'absolute', left: 0, width: 4, height: '100%' },
  iconContainer: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  deviceInfo: { flex: 1, marginLeft: 15 },
  deviceName: { fontSize: 16, fontWeight: 'bold' },
  deviceIp: { fontSize: 11, marginTop: 2, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier' },
  deviceTime: { fontSize: 10, marginTop: 2 },
  statusBox: { alignItems: 'center' },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 9, fontWeight: 'bold', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  connectingText: { fontSize: 13 },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySubText: { fontSize: 10, letterSpacing: 2 },
});
