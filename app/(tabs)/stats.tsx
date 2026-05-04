import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  Dimensions, RefreshControl, DeviceEventEmitter
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const SERVER_URL = 'https://aftermost-kiersten-uncautioned.ngrok-free.dev';

// ==========================================
// ✅ دوال لتنسيق التاريخ والوقت محلياً
// ==========================================
const formatLocalTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ar-SY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const formatLocalDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-SY', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
};

interface HistoryItem {
  id?: number;
  noiseLevel: number;
  noiseType: string;
  time: string;
  name: string;
}

interface Summary {
  totalRecords: number;
  avgNoiseLevel: number;
  maxNoiseLevel: number;
  maxNoiseName: string;
}

export default function CombinedStatsScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalRecords: 0, avgNoiseLevel: 0, maxNoiseLevel: 0, maxNoiseName: '' });
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // إحصائيات محسوبة من آخر 10 قراءات
  const alertsCount = history.filter(h => h.noiseLevel > 70).length;
  const quietCount = history.filter(h => h.noiseLevel < 50).length;

  useEffect(() => {
    const loadSettings = async () => {
      const savedMode = await AsyncStorage.getItem('darkMode');
      setIsDarkMode(savedMode === 'true');
    };
    loadSettings();
    fetchStats();

    const subscription = DeviceEventEmitter.addListener('themeChanged', (isDark: boolean) => {
      setIsDarkMode(isDark);
    });

    return () => subscription.remove();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/stats`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();

      if (data.success) {
        const last10 = (data.history || []).slice(0, 10);
        setHistory(last10);

        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.log('Stats Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const theme = {
    bg: isDarkMode ? '#0A0E14' : '#F5F7FA',
    card: isDarkMode ? '#151B23' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#2C3E50',
    accent: isDarkMode ? '#00FFCC' : '#9B59B6',
    subText: isDarkMode ? '#8B949E' : '#7F8C8D',
    border: isDarkMode ? '#30363D' : '#E1E4E8'
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const chartData = history.slice(0, 5).reverse();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>لوحة التحليلات 📊</Text>
        <View style={[styles.accentLine, { backgroundColor: theme.accent }]} />
        <Text style={[styles.subtitle, { color: theme.subText }]}>رؤية شاملة وسجل الرصد اللحظي</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="المتوسط العام"
          value={`${summary.avgNoiseLevel} dB`}
          icon="waveform"
          color={theme.accent}
          theme={theme}
        />
        <StatCard
          label="أعلى رصد"
          value={`${summary.maxNoiseLevel} dB`}
          icon="trending-up"
          color="#FF4B5C"
          theme={theme}
        />
        <StatCard
          label="تنبيهات (آخر 10)"
          value={alertsCount.toString()}
          icon="bell-ring"
          color="#FFB319"
          theme={theme}
        />
        <StatCard
          label="هادئة (آخر 10)"
          value={quietCount.toString()}
          icon="shield-check"
          color="#00E676"
          theme={theme}
        />
      </View>

      {summary.totalRecords > 0 && (
        <View style={[styles.totalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <MaterialCommunityIcons name="database" size={18} color={theme.accent} />
          <Text style={[styles.totalText, { color: theme.subText }]}>
            إجمالي السجلات:{' '}
            <Text style={{ color: theme.text, fontWeight: 'bold' }}>{summary.totalRecords}</Text>
            {'   '}أعلى نقطة:{' '}
            <Text style={{ color: '#FF4B5C', fontWeight: 'bold' }} numberOfLines={1}>
              {summary.maxNoiseName || '—'}
            </Text>
          </Text>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>📈 نبض التغير (آخر 5 قراءات)</Text>
        {chartData.length > 1 ? (
          <LineChart
            data={{
              labels: chartData.map(h => {
                // محاولة استخراج الوقت فقط للعرض
                try {
                  return formatLocalTime(h.time).split(' ')[0] || '';
                } catch {
                  return '';
                }
              }),
              datasets: [{ data: chartData.map(h => h.noiseLevel) }]
            }}
            width={width - 40}
            height={180}
            chartConfig={getChartConfig(theme, isDarkMode)}
            bezier
            style={styles.chartStyle}
          />
        ) : (
          <View style={styles.emptyChart}>
            <MaterialCommunityIcons name="chart-line-variant" size={40} color={theme.subText} />
            <Text style={{ color: theme.subText, textAlign: 'center', marginTop: 10 }}>
              لا توجد بيانات كافية للرسم..
            </Text>
          </View>
        )}
      </View>

      {/* سجل الرصد */}
      <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 40 }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>📋 سجل الرصد الأخير</Text>
          <MaterialCommunityIcons name="history" size={20} color={theme.accent} />
        </View>

        {history.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.subText }]}>لا يوجد سجلات حالية..</Text>
        ) : (
          history.map((item, index) => (
            <View key={item.id ?? index} style={[styles.historyItem, { borderBottomColor: theme.border }]}>
              <View
                style={[
                  styles.levelIndicator,
                  {
                    backgroundColor:
                      item.noiseLevel > 70 ? '#FF4B5C'
                      : item.noiseLevel > 50 ? '#FFB319'
                      : '#00E676'
                  }
                ]}
              />
              <View style={styles.historyContent}>
                <Text style={[styles.historyLocation, { color: theme.text }]} numberOfLines={1}>
                  {item.name || 'موقع مرصود'}
                </Text>
                <Text style={[styles.historyMeta, { color: theme.subText }]}>
                  {item.noiseType}
                </Text>
                {/* ✅ التعديل هنا: استخدام دوال التنسيق الجديدة */}
                <Text style={[styles.historyTime, { color: theme.subText }]}>
                  {formatLocalDate(item.time)} | {formatLocalTime(item.time)}
                </Text>
              </View>
              <Text style={[styles.historyDb, { color: item.noiseLevel > 70 ? '#FF4B5C' : theme.accent }]}>
                {item.noiseLevel} dB
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const getChartConfig = (theme: any, isDark: boolean) => ({
  backgroundColor: theme.card,
  backgroundGradientFrom: theme.card,
  backgroundGradientTo: theme.card,
  decimalPlaces: 0,
  color: (opacity = 1) =>
    isDark ? `rgba(0, 255, 204, ${opacity})` : `rgba(155, 89, 182, ${opacity})`,
  labelColor: () => theme.subText,
  style: { borderRadius: 16 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: theme.accent }
});

function StatCard({ label, value, icon, color, theme }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.subText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 50, paddingHorizontal: 25, marginBottom: 15 },
  title: { fontSize: 26, fontWeight: '900' },
  accentLine: { width: 40, height: 4, borderRadius: 2, marginVertical: 5 },
  subtitle: { fontSize: 13, marginTop: 4 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', paddingHorizontal: 20
  },
  statCard: {
    width: '47%', padding: 16, borderRadius: 24,
    marginBottom: 15, borderWidth: 1, elevation: 1
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10
  },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  totalCard: {
    marginHorizontal: 20, marginBottom: 5, padding: 12,
    borderRadius: 16, borderWidth: 1, flexDirection: 'row',
    alignItems: 'center', gap: 8
  },
  totalText: { fontSize: 12, flex: 1 },
  sectionCard: {
    marginHorizontal: 20, padding: 15,
    borderRadius: 24, borderWidth: 1, marginTop: 15
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 15 },
  rowBetween: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10
  },
  chartStyle: { borderRadius: 16, marginLeft: -15, marginTop: 10 },
  emptyChart: { alignItems: 'center', paddingVertical: 30 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1
  },
  levelIndicator: { width: 4, height: 35, borderRadius: 2, marginRight: 12 },
  historyContent: { flex: 1 },
  historyLocation: { fontSize: 14, fontWeight: '600' },
  historyMeta: { fontSize: 11, marginTop: 1 },
  historyTime: { fontSize: 10, marginTop: 2 },
  historyDb: { fontSize: 15, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', padding: 20, fontSize: 12 }
});