import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch,
  Alert, Image, TextInput, DeviceEventEmitter, Linking, Dimensions
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

export default function SettingsScreen() {
  const [currentLangCode, setCurrentLangCode] = useState('ar');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [userName, setUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [isMuteMode, setIsMuteMode] = useState(false);

  const theme = {
    bg: isDarkMode ? '#0A0E14' : '#F5F7FA',
    card: isDarkMode ? '#151B23' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#2C3E50',
    accent: isDarkMode ? '#00FFCC' : '#9B59B6',
    subText: isDarkMode ? '#8B949E' : '#7F8C8D',
    border: isDarkMode ? '#30363D' : '#E1E4E8'
  };

  const translations: Record<string, Record<string, string>> = {
    ar: {
      title: 'إعدادات النظام',
      lang: 'اللغة',
      dark: 'الوضع الليلي',
      theme: 'هوية التطبيق البصرية',
      about: 'عن QuietZone',
      version: 'الإصدار التقني',
      rights: 'جميع الحقوق محفوظة',
      description: 'نظام ذكي لمراقبة وتحليل التلوث الضوضائي لحظياً.',
      contact: 'الدعم الفني',
      privacy: 'خصوصية البيانات',
      muteTitle: '🔕 كتم التنبيهات',
      muteLabel: 'تعطيل جميع التنبيهات والإشعارات',
      muteDesc: '🔇 عند تفعيل هذا الخيار، لن يصدر أي صوت أو اهتزاز أو إشعارات عند رصد الضوضاء.',
      // ✅ FIX: إزالة "حفظ" لأن الإعدادات تُحفظ تلقائياً
      savedMsg: 'تم حفظ جميع الإعدادات تلقائياً ✓',
      contactSupport: 'تواصل مع الدعم',
    },
    en: {
      title: 'System Settings',
      lang: 'Language',
      dark: 'Dark Mode',
      theme: 'Visual Identity',
      about: 'About QuietZone',
      version: 'Technical Version',
      rights: 'All Rights Reserved',
      description: 'Smart system for real-time noise pollution monitoring.',
      contact: 'Technical Support',
      privacy: 'Data Privacy',
      muteTitle: '🔕 Mute Alerts',
      muteLabel: 'Disable all notifications and alerts',
      muteDesc: '🔇 When enabled, no sound, vibration, or push notifications will be sent when noise is detected.',
      savedMsg: 'All settings are saved automatically ✓',
      contactSupport: 'Contact Support',
    }
  };

  const t = (key: string) => translations[currentLangCode]?.[key] || translations['ar']![key] || key;
  const isRTL = currentLangCode === 'ar';

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedLang = await AsyncStorage.getItem('userLang');
        const savedMode = await AsyncStorage.getItem('darkMode');
        const savedName = await AsyncStorage.getItem('userName');
        const savedImage = await AsyncStorage.getItem('userImage');
        const savedMuteMode = await AsyncStorage.getItem('muteMode');

        if (savedLang) setCurrentLangCode(savedLang);
        if (savedMode) setIsDarkMode(savedMode === 'true');
        if (savedName) setUserName(savedName);
        if (savedImage) setUserProfileImage(savedImage);
        if (savedMuteMode !== null) setIsMuteMode(savedMuteMode === 'true');
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const toggleDarkMode = async (value: boolean) => {
    setIsDarkMode(value);
    await AsyncStorage.setItem('darkMode', value.toString());
    DeviceEventEmitter.emit('themeChanged', value);
  };

  const changeLanguage = async (code: string) => {
    setCurrentLangCode(code);
    await AsyncStorage.setItem('userLang', code);
    DeviceEventEmitter.emit('langChanged', code);
  };

  const toggleMuteMode = async (value: boolean) => {
    setIsMuteMode(value);
    await AsyncStorage.setItem('muteMode', value.toString());
    DeviceEventEmitter.emit('muteModeChanged', value);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('privacy'), 'يجب السماح بالوصول إلى الصور.');
      return;
    }
    // ✅ FIX: استخدام الـ API الصحيح بدل MediaTypeOptions المهجور
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets) {
      const imageUri = result.assets[0]!.uri;
      setUserProfileImage(imageUri);
      await AsyncStorage.setItem('userImage', imageUri);
    }
  };

  const saveName = async () => {
    setIsEditingName(false);
    await AsyncStorage.setItem('userName', userName);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* ─── البروفايل ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={pickImage} style={[styles.avatarBorder, { borderColor: theme.accent }]}>
          <View style={[styles.avatar, { backgroundColor: theme.card }]}>
            {userProfileImage ? (
              <Image source={{ uri: userProfileImage }} style={styles.profileImage} />
            ) : (
              <MaterialCommunityIcons name="account-search-outline" size={50} color={theme.accent} />
            )}
          </View>
          <View style={[styles.cameraIcon, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="camera-flip" size={14} color={isDarkMode ? '#000' : '#fff'} />
          </View>
        </TouchableOpacity>

        <View style={styles.nameContainer}>
          {isEditingName ? (
            <TextInput
          style={[styles.nameInput, { color: theme.text, borderBottomColor: theme.accent }]}
          value={userName}
          placeholder={isRTL ? 'أدخل اسمك هنا...' : 'Enter your name...'}
          onChangeText={setUserName}
          onBlur={saveName} 
          autoFocus
          // 🔽 أضيفي هذين السطرين 🔽
          returnKeyType="done" 
          onSubmitEditing={saveName} 
        />
          ) : (
            <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.nameBtn}>
              <Text style={[styles.userName, { color: theme.text }]}>
                {userName || (isRTL ? 'إضافة اسم' : 'Add Name')}
              </Text>
              <MaterialCommunityIcons name="circle-edit-outline" size={18} color={theme.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── الإعدادات الأساسية ─── */}
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('title')}</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <MaterialCommunityIcons name="translate" size={22} color={theme.subText} />
            <Text style={[styles.labelText, { color: theme.text }]}>{t('lang')}</Text>
          </View>
          <View style={styles.langSwitch}>
            {['ar', 'en'].map((code) => (
              <TouchableOpacity
                key={code}
                onPress={() => changeLanguage(code)}
                style={[
                  styles.miniBtn,
                  { backgroundColor: currentLangCode === code ? theme.accent : 'transparent' }
                ]}
              >
                <Text
                  style={[
                    styles.miniBtnText,
                    { color: currentLangCode === code ? (isDarkMode ? '#000' : '#fff') : theme.subText }
                  ]}
                >
                  {code.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <MaterialCommunityIcons name="orbit-variant" size={22} color={theme.subText} />
            <Text style={[styles.labelText, { color: theme.text }]}>{t('dark')}</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: '#767577', true: theme.accent + '50' }}
            thumbColor={isDarkMode ? theme.accent : '#f4f3f4'}
          />
        </View>
      </View>

      {/* ─── قسم كتم التنبيهات ─── */}
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.accent }]}>{t('muteTitle')}</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingLabel}>
            <MaterialCommunityIcons
              name="volume-off"
              size={22}
              color={isMuteMode ? '#e74c3c' : theme.subText}
            />
            <Text style={[styles.labelText, { color: isMuteMode ? '#e74c3c' : theme.text }]}>
              {t('muteLabel')}
            </Text>
          </View>
          <Switch
            value={isMuteMode}
            onValueChange={toggleMuteMode}
            trackColor={{ false: '#767577', true: '#e74c3c80' }}
            thumbColor={isMuteMode ? '#e74c3c' : theme.accent}
          />
        </View>

        <Text
          style={[
            styles.desc,
            {
              color: theme.subText,
              fontSize: 12,
              marginTop: 10,
              textAlign: isRTL ? 'right' : 'left'
            }
          ]}
        >
          {t('muteDesc')}
        </Text>
      </View>

      {/* ─── قسم المعلومات التقنية ─── */}
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.aboutHeader}>
          <MaterialCommunityIcons name="radar" size={40} color={theme.accent} />
          <Text style={[styles.appName, { color: theme.text }]}>
            QuietZone <Text style={{ color: theme.accent }}>PRO</Text>
          </Text>
          <Text style={[styles.version, { color: theme.subText }]}>
            {t('version')} 1.0.4-stable
          </Text>
        </View>

        <Text style={[styles.desc, { color: theme.subText }]}>{t('description')}</Text>

        {/* ✅ FIX: الخصوصية → رسالة توضيحية بدل فتح إيميل */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() =>
            Alert.alert(
              t('privacy'),
              isRTL
                ? 'لا نشارك بيانات موقعك أو تسجيلاتك الصوتية مع أي طرف ثالث. جميع البيانات تُستخدم فقط لتحليل الضوضاء المحيطة.'
                : 'We do not share your location or audio data with any third party. All data is used only for ambient noise analysis.'
            )
          }
        >
          <MaterialCommunityIcons name="shield-key-outline" size={20} color={theme.accent} />
          <Text style={[styles.linkText, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('privacy')}
          </Text>
          <MaterialCommunityIcons
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={20}
            color={theme.subText}
          />
        </TouchableOpacity>

        {/* ✅ FIX: الدعم الفني → إيميل صحيح */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL('mailto:support@quietzone.app')}
        >
          <MaterialCommunityIcons name="email-outline" size={20} color={theme.accent} />
          <Text style={[styles.linkText, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('contact')}
          </Text>
          <MaterialCommunityIcons
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={20}
            color={theme.subText}
          />
        </TouchableOpacity>
      </View>

      {/* ✅ FIX: الزر يعرض رسالة بأن الحفظ تلقائي */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: theme.accent }]}
        onPress={() =>
          Alert.alert(
            isRTL ? '✓ تم الحفظ' : '✓ Saved',
            t('savedMsg')
          )
        }
      >
        <Text style={[styles.saveText, { color: isDarkMode ? '#000' : '#fff' }]}>
          {isRTL ? 'تم ✓' : 'Done ✓'}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.copy, { color: theme.subText }]}>
        © 2026 . {t('rights')}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { alignItems: 'center', marginTop: 60, marginBottom: 20 },
  avatarBorder: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', position: 'relative'
  },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
  },
  profileImage: { width: '100%', height: '100%' },
  cameraIcon: {
    position: 'absolute', bottom: 5, right: 5,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#0A0E14'
  },
  nameContainer: { marginTop: 15 },
  nameBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { fontSize: 22, fontWeight: '900' },
  nameInput: {
    fontSize: 20, fontWeight: 'bold',
    borderBottomWidth: 1, minWidth: 150, textAlign: 'center'
  },
  section: { padding: 20, borderRadius: 28, borderWidth: 1, marginBottom: 20 },
  sectionTitle: {
    fontSize: 14, fontWeight: '900', marginBottom: 20,
    textTransform: 'uppercase', letterSpacing: 1
  },
  settingItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10
  },
  settingLabel: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  labelText: { fontSize: 16, fontWeight: '600' },
  langSwitch: {
    flexDirection: 'row', backgroundColor: '#00000020',
    borderRadius: 12, padding: 4
  },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  miniBtnText: { fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 10 },
  aboutHeader: { alignItems: 'center', marginBottom: 15 },
  appName: { fontSize: 20, fontWeight: '900', marginTop: 10 },
  version: { fontSize: 12, marginTop: 2 },
  desc: { textAlign: 'center', fontSize: 13, lineHeight: 20, marginBottom: 20 },
  linkRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: '500' },
  saveBtn: {
    height: 60, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, elevation: 8
  },
  saveText: { fontSize: 18, fontWeight: '900' },
  copy: { textAlign: 'center', fontSize: 10, marginBottom: 40 }
});
