import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

export default function TabLayout() {
  const [lang, setLang] = useState('ar');
  // ✅ FIX 1: الافتراضي true لتتناسق مع بقية الشاشات
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const savedMode = await AsyncStorage.getItem('darkMode');
      const savedLang = await AsyncStorage.getItem('userLang');
      // ✅ FIX 2: إذا ما في قيمة محفوظة، يبقى true (الافتراضي)
      if (savedMode !== null) setDarkMode(savedMode === 'true');
      if (savedLang) setLang(savedLang);
    };
    loadSettings();

    const subscription = DeviceEventEmitter.addListener('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });

    const langSubscription = DeviceEventEmitter.addListener('langChanged', (newLang: string) => {
      setLang(newLang);
    });

    return () => {
      subscription.remove();
      langSubscription.remove();
    };
  }, []);

  const titles: Record<string, Record<string, string>> = {
    ar: {
      home: 'الرصد',
      stats: 'الإحصائيات',
      radar: 'الرادار',
      settings: 'الإعدادات'
    },
    en: {
      home: 'Monitor',
      stats: 'Stats',
      radar: 'Radar',
      settings: 'Settings'
    }
  };

  // ✅ FIX 3: fallback آمن إذا كان المفتاح غير موجود
  const t = (key: string) => titles[lang]?.[key] ?? titles['ar']![key] ?? key;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: darkMode ? '#00ffcc' : '#9b59b6',
        headerShown: false,
        // ✅ FIX 4: إخفاء الـ tab bar عند فتح الكيبورد
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: darkMode ? '#0a0e14' : '#ffffff',
          borderTopColor: darkMode ? '#1e293b' : '#e2e8f0',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 12,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
        tabBarInactiveTintColor: darkMode ? '#475569' : '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
          marginTop: -5
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="microphone" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('stats'),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-line" size={24} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('radar'),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="radar" size={28} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings'),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cog" size={24} color={color} />
          )
        }}
      />
    </Tabs>
  );
}
