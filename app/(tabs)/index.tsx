import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { Audio } from 'expo-av'; 
import * as TaskManager from 'expo-task-manager'; 
import * as Location from 'expo-location'; 
import * as Network from 'expo-network'; 
import * as Speech from 'expo-speech'; 
import React, { useEffect, useRef, useState } from 'react'; 
import { 
  ActivityIndicator, 
  Alert, 
  DeviceEventEmitter, 
  Dimensions, 
  Modal, 
  Platform, 
  StyleSheet, 
  Animated, 
  Text, 
  TouchableOpacity, 
  Vibration, 
  View 
} from 'react-native'; 
import MapView, { Circle, Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps'; 
import { io } from 'socket.io-client'; 
import * as Notifications from 'expo-notifications'; 
import * as Device from 'expo-device'; 
import Constants from 'expo-constants'; 
 
const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK'; 
// ✅ FIX 1: setNotificationHandler لازم يكون هون — خارج الكومبوننت كلياً 
// هيك الإشعارات رح تطلع كـ popup زي واتساب حتى لما التطبيق مفتوح 
Notifications.setNotificationHandler({ 
  handleNotification: async () => ({ 
    shouldShowAlert: true, 
    shouldPlaySound: true, 
    shouldHighlight: true, 
    shouldSetBadge: false, 
    shouldShowBanner: true, 
    shouldShowList: true, 
    priority: Notifications.AndroidNotificationPriority.MAX, 
  }), 
}); 
     
const SERVER_URL = 'https://quitezone-backend.onrender.com'; 
 
const BATTERY_SAFE_SETTINGS = { 
  NORMAL_INTERVAL: 8000, 
  HIGH_NOISE_INTERVAL: 3000, 
  MIN_DB_TO_ACCELERATE: 60, 
  MAX_CONSECUTIVE_HIGH: 5, 
  MIN_INTERVAL: 3000, 
  MAX_INTERVAL: 15000, 
  LOCATION_DISTANCE_INTERVAL: 10, 
  LOCATION_TIME_INTERVAL: 10000, 
}; 
 
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => { 
  if (error) { 
    console.error("Background task error:", error); 
    return; 
  } 
   
  if (data) { 
    console.log('Received background data:', data); 
    /**
     * ملاحظة هامة للمطور:
     * بيئة Expo القياسية لا تدعم قراءة الميكروفون (Audio Metering) في الخلفية عند إغلاق التطبيق تماماً.
     * هذه المهمة تعمل حالياً للموقع فقط. لتشغيل تنبيهات الضجيج والتطبيق مغلق، يجب استخدام Remote Push Notifications
     * من السيرفر، أو استخدام Native Modules متخصصة.
     */
  } 
}); 
export default function HomeScreen() { 
  const [db, setDb] = useState(0); 
  const [noiseCategory, setNoiseCategory] = useState('طبيعي'); 
  const [location, setLocation] = useState<Location.LocationObject | null>(null); 
  const [isAiLoading, setIsAiLoading] = useState(false); 
  // --- إضافات العصا السحرية الجديدة --- 
  const [maxDistance, setMaxDistance] = useState(2);  
  const pulseAnim = useRef(new Animated.Value(1)).current;  
  const carScale = useRef(new Animated.Value(1)).current;   
  const walkScale = useRef(new Animated.Value(1.25)).current; 
  const [showAlertModal, setShowAlertModal] = useState(false); 
  const [isConnected, setIsConnected] = useState(false); 
  const [onlineDevices, setOnlineDevices] = useState([]); 
  const [isDarkMode, setIsDarkMode] = useState(true); 

  const registerDeviceWithServer = async (token: string | null) => {
    if (socket.current && socket.current.connected) {
      const ip = await Network.getIpAddressAsync();
      const loc = locationRef.current;
      socket.current.emit('register-device', {
        deviceName: Platform.OS,
        localIP: ip,
        pushToken: token,
        lat: loc?.coords.latitude ?? null,
        lng: loc?.coords.longitude ?? null,
      });
    }
  };
  const [bestPlaceCoords, setBestPlaceCoords] = useState<{ lat: number; lng: number } | null>(null); 
  const [isMuteMode, setIsMuteMode] = useState(false); 
   
  const [heatmapPoints, setHeatmapPoints] = useState([]); 
  const [showHeatmap, setShowHeatmap] = useState(false); 
 
  const recordingRef = useRef<Audio.Recording | null>(null); 
  const locationRef = useRef<Location.LocationObject | null>(null); 
  const mapRef = useRef<MapView>(null); 
  const isAlarmPlaying = useRef(false); 
  const socket = useRef<any>(null); 
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null); 
  const audioBuffer = useRef<number[]>([]); 
  const isMuteModeRef = useRef(false); 
   
  const isRecordingActive = useRef(false); 
  const isProcessingRef = useRef(false); 
  const lastNoiseReading = useRef<number>(0); 
  const consecutiveHighNoise = useRef(0); 
  let locationWatcher = useRef<any>(null); 
 
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); 
  const lastAlertTimeRef = useRef<number>(0); 
  const ALERT_COOLDOWN = 60000; 
 
  // ✅ FIX 2: مرجع لحفظ الـ token مرة وحدة + cooldown للإشعارات 
  const pushTokenRef = useRef<string | null>(null); 
  const lastNotificationTimeRef = useRef<number>(0); 
  const NOTIFICATION_COOLDOWN = 30000; // 30 ثانية بين كل إشعار وإشعار 
 
  useEffect(() => { 
    const subscription = Notifications.addNotificationResponseReceivedListener(response => { 
      const data = response.notification.request.content.data; 
      if (data?.lat && data?.lng && mapRef.current) { 
        mapRef.current.animateToRegion({ 
          latitude: Number(data.lat), 
          longitude: Number(data.lng), 
          latitudeDelta: 0.01, 
          longitudeDelta: 0.01, 
        }, 1000); 
      } 
    }); 
 
    return () => { 
      subscription.remove(); 
    }; 
  }, []); 
 
  useEffect(() => { 
    isMuteModeRef.current = isMuteMode; 
  }, [isMuteMode]); 
     
  const themeColors = { 
    bg: isDarkMode ? '#0A0E14' : '#F5F7FA', 
    card: isDarkMode ? '#151B23' : '#FFFFFF', 
    text: isDarkMode ? '#FFFFFF' : '#2C3E50', 
    accent: isDarkMode ? '#00FFCC' : '#9B59B6', 
    subText: isDarkMode ? '#8B949E' : '#7F8C8D', 
    border: isDarkMode ? '#30363D' : '#E1E4E8' 
  }; 
 
  const nightMapStyle = [ 
    { elementType: 'geometry', stylers: [{ color: '#212121' }] }, 
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }, 
    { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] }, 
    { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] }, 
    { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] }, 
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#181818' }] }, 
    { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] }, 
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] } 
  ]; 
 
 const analyzeSoundCategory = (db: number, buffer: number[]) => { 
  // الكلام العادي غالباً بين 40-65، لذا سنرفع حد "الطبيعي" إلى 65
  if (db < 65) return 'طبيعي (كلام أو هدوء)'; 
  
  const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length; 
  const variance = buffer.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / buffer.length; 

  // الضجيج المفاجئ (صراخ أو بوق سيارة حاد)
  if (variance > 120 && db > 75) return 'صراخ/مفاجئ';  
  
  // ضجيج مستمر وعالي جداً (معدات ثقيلة أو زحمة سير خانقة)
  if (db > 85) return 'ضجيج آلات/زحمة'; 
  
  // موسيقى صاخبة (تتميز بأن التباين فيها قليل لأن الإيقاع مستمر)
  if (db > 70 && variance < 40) return 'موسيقى صاخبة'; 

  return 'ضجيج عام'; 
};
 
  const cleanupRecording = async () => { 
    if (intervalRef.current) { 
      clearInterval(intervalRef.current); 
      intervalRef.current = null; 
    } 
    if (recordingRef.current) { 
      try { 
        const status = await recordingRef.current.getStatusAsync(); 
        if (status.isRecording) { 
          await recordingRef.current.stopAndUnloadAsync(); 
        } 
        recordingRef.current = null; 
      } catch (err) { 
        console.log('خطأ في إيقاف التسجيل:', err); 
      } 
    } 
    isRecordingActive.current = false; 
    isProcessingRef.current = false; 
  }; 
 
  const getDynamicInterval = (currentDb: number, consecutiveHigh: number) => { 
    if (currentDb > 85) return BATTERY_SAFE_SETTINGS.HIGH_NOISE_INTERVAL; 
    if (currentDb > BATTERY_SAFE_SETTINGS.MIN_DB_TO_ACCELERATE) { 
      if (consecutiveHigh > BATTERY_SAFE_SETTINGS.MAX_CONSECUTIVE_HIGH) return BATTERY_SAFE_SETTINGS.NORMAL_INTERVAL; 
      return BATTERY_SAFE_SETTINGS.HIGH_NOISE_INTERVAL; 
    } 
    if (currentDb < 30 && consecutiveHigh === 0) return BATTERY_SAFE_SETTINGS.MAX_INTERVAL; 
    return BATTERY_SAFE_SETTINGS.NORMAL_INTERVAL; 
  }; 
 
  const startRecording = async () => { 
    if (isRecordingActive.current) return true; 
    try { 
      const { status } = await Audio.requestPermissionsAsync(); 
      if (status !== 'granted') return false; 
      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true, 
        staysActiveInBackground: true, 
      }); 
      const recording = new Audio.Recording(); 
      await recording.prepareToRecordAsync({ 
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY, 
        isMeteringEnabled: true, 
      }); 
      await recording.startAsync(); 
      recordingRef.current = recording; 
      isRecordingActive.current = true; 
      return true; 
    } catch (err) { 
      isRecordingActive.current = false; 
      return false; 
    } 
  }; 
 
 const readNoiseLevel = async () => { 
    if (isProcessingRef.current) return; 
    
    // التأكد من أن التسجيل يعمل
    if (!recordingRef.current || !isRecordingActive.current) { 
      await startRecording(); 
      return; 
    } 
    
    isProcessingRef.current = true; 
    try { 
      const status = await recordingRef.current.getStatusAsync(); 
      if (status.metering !== undefined) { 
        // تحويل القيمة إلى ديسيبل (0-100)
        let currentDb = Math.floor((status.metering + 160) / 1.6); 
        currentDb = Math.min(100, Math.max(0, currentDb)); 
        
        setDb(currentDb); 
        lastNoiseReading.current = currentDb; 

        // 1. تحليل ميزات الصوت وتصنيفه (كلام، صراخ، موسيقى، إلخ)
        const features = getAudioFeatures(status.metering); 
        const category = analyzeSoundCategory(currentDb, features); 
        setNoiseCategory(category);


        // 2. التحكم في الإنذار الصوتي والاهتزاز (Vibration & Speech)
        // لا يعمل الإنذار إلا إذا كان الصوت "ضجيجاً حقيقياً" وفوق الـ 80
        if (currentDb >= 80 && category !== 'طبيعي (كلام أو هدوء)' && !isMuteModeRef.current && !isAlarmPlaying.current) { 
          triggerAlarm(currentDb); 
        } 

        // 3. إدارة سرعة القياس لتوفير البطارية
        adjustRecordingInterval(currentDb);

        // 4. إرسال البيانات للسيرفر لتحديث الخريطة الحرارية
        if (locationRef.current) { 
          fetch(`${SERVER_URL}/api/analyze-audio`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              location: { lat: locationRef.current.coords.latitude, lng: locationRef.current.coords.longitude }, 
              noiseLevel: currentDb, 
              audioFeatures: features, 
              category: category,
              pushToken: pushTokenRef.current, 
            }) 
          }).catch(err => console.log('❌ Server Update Failed:', err)); 
        } 
      } 
    } catch (err) { 
      console.log("Error in readNoiseLevel:", err); 
    } finally { 
      isProcessingRef.current = false; 
    } 
  };
  
 
  const adjustRecordingInterval = (currentDb: number) => { 
    const newInterval = getDynamicInterval(currentDb, consecutiveHighNoise.current); 
    const currentInterval = intervalRef.current ? (intervalRef.current as any)._idleTimeout : BATTERY_SAFE_SETTINGS.NORMAL_INTERVAL; 
    if (Math.abs(newInterval - currentInterval) > 2000 && intervalRef.current) { 
      clearInterval(intervalRef.current); 
      intervalRef.current = setInterval(readNoiseLevel, newInterval); 
    } 
  }; 
 
  const getAudioFeatures = (metering: number) => { 
    const feature = (metering + 160) / 1.6; 
    audioBuffer.current.push(feature); 
    if (audioBuffer.current.length > 12) audioBuffer.current.shift(); 
    return [...audioBuffer.current]; 
  }; 
 
  const fetchHeatmapData = async () => { 
    try { 
       const response = await fetch(`${SERVER_URL}/api/heatmap`); 
      const data = await response.json(); 
      if (data.success && data.points) { 
        const points = data.points.map((point: any) => ({ 
          latitude: point.location.lat, 
          longitude: point.location.lng, 
          weight: point.noiseLevel 
        })); 
        setHeatmapPoints(points); 
      } 
    } catch (error) { 
      console.log('❌ فشل جلب بيانات الخريطة الحرارية:', error); 
    } 
  }; 
 
const sendPushNotificationToServer = async (dbLevel: number, coords: any, address: string) => { 
  try { 
   // إظهار إشعار فوري (Popup) على جهاز المستخدم
    // البث للأجهزة القريبة يتم تلقائياً عبر /api/analyze-audio
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ إنذار تلوث سمعي',
        body: `تم رصد ضوضاء (${noiseCategory}) بمستوى ${dbLevel} dB في ${address || 'منطقتك'}`,
        data: { type: 'LOCAL_ALERT', noiseLevel: dbLevel },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
       
      },
      trigger: {
         channelId: 'noise_alerts',
      } as Notifications.NotificationTriggerInput,
      
    });
         // إشعار السيرفر ليبث للأجهزة القريبة المغلقة
    if (pushTokenRef.current) {
      fetch(`${SERVER_URL}/api/broadcast-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushToken: pushTokenRef.current,
          noiseLevel: dbLevel,
          lat: coords.latitude,
          lng: coords.longitude,
          category: noiseCategory,
        }),
      }).catch(() => {});
    }
  } catch (error) { 
    console.log('❌ فشل إرسال أو عرض الإشعار:', error); 
  } 
};
 
  const triggerAlarm = async (currentDb: number) => { 
    if (isMuteModeRef.current || isAlarmPlaying.current) return; 
 
    const now = Date.now(); 
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN) return; 
 
    // إضافة فلترة إضافية هنا:
  // لا تشغل الإنذار الصوتي إلا إذا كان الضجيج فعلاً مزعجاً (فوق 80 ديسيبل)
  if (currentDb < 80) return;

    isAlarmPlaying.current = true; 
    setShowAlertModal(true); 
 
    const playAlert = () => { 
      Vibration.vibrate([500, 1000, 500, 1000], false); 
      Speech.speak(`تنبيه، تم رصد ${noiseCategory}. يرجى الهدوء.`, { 
        language: 'ar', 
        pitch: 1.0, 
        rate: 0.9, 
      }); 
    }; 
 
    playAlert(); 
 
    alarmIntervalRef.current = setInterval(() => { 
      if (isAlarmPlaying.current) { 
        playAlert(); 
      } 
    }, 7000); 
 
    if (locationRef.current) { 
      sendPushNotificationToServer(currentDb, locationRef.current.coords, 'موقعك الحالي'); 
    } 
  }; 
 
  const stopAlarmSound = async () => { 
    isAlarmPlaying.current = false; 
    lastAlertTimeRef.current = Date.now(); 
     
    if (alarmIntervalRef.current) { 
      clearInterval(alarmIntervalRef.current); 
      alarmIntervalRef.current = null; 
    } 
 
    setShowAlertModal(false); 
    Vibration.cancel(); 
    Speech.stop(); 
  }; 
     
  // دالة الأنيميشن عند اختيار الوسيلة 
  const animateSelection = (mode: 'walk' | 'car') => { 
    if (mode === 'walk') { 
      Animated.spring(walkScale, { toValue: 1.25, friction: 3, useNativeDriver: true }).start(); 
      Animated.spring(carScale, { toValue: 1, friction: 3, useNativeDriver: true }).start(); 
    } else { 
      Animated.spring(carScale, { toValue: 1.25, friction: 3, useNativeDriver: true }).start(); 
      Animated.spring(walkScale, { toValue: 1, friction: 3, useNativeDriver: true }).start(); 
    } 
  }; 
 
  // دالة الأنيميشن للنبض 
  const startPulse = () => { 
    Animated.loop( 
      Animated.sequence([ 
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }), 
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }), 
      ]) 
    ).start(); 
  }; 
const activateMagicWand = async () => { 
  setIsAiLoading(true); 
  startPulse(); // بدء أنيميشن النبض

  try { 
    const response = await fetch(`${SERVER_URL}/api/magic-wand`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        latitude: location?.coords.latitude, 
        longitude: location?.coords.longitude, 
        maxDistance: maxDistance, 
      }), 
    }); 

    const data = await response.json(); 

    if (data.success && data.bestRoute) { 
      const bestLocation = { lat: data.bestRoute.location.lat, lng: data.bestRoute.location.lng }; 
      setBestPlaceCoords(bestLocation); 
        
      // تحريك الخريطة للموقع المكتشف
      mapRef.current?.animateToRegion({ 
        latitude: bestLocation.lat, 
        longitude: bestLocation.lng, 
        latitudeDelta: 0.005, 
        longitudeDelta: 0.005, 
      }, 1500); 

      // ✅ التعديل هنا: إظهار التنبيه بكل البيانات التي طلبتِها
      Alert.alert( 
        "✨ نتيجة العصا السحرية", 
        `📍 المكان: ${data.bestRoute.name}\n` +
        `🔊 الضجيج: ${data.bestRoute.noiseLevel} dB\n` +
        `📏 المسافة: ${data.bestRoute.distance} كم\n` +
        `📅 ${data.bestRoute.observedIn}\n` +
        `🕒 ${data.bestRoute.time}`,
        [{ text: "حسناً" }] 
      ); 
    } else { 
      Alert.alert('🪄 العصا السحرية', data.message || 'لا توجد بيانات كافية حالياً.'); 
    } 
  } catch (error) { 
    Alert.alert('خطأ', 'تعذر الاتصال بالسيرفر.'); 
  } finally { 
    setIsAiLoading(false); 
    pulseAnim.setValue(1); // إيقاف النبض
  } 
};
  async function registerForPushNotifications() { 
    if (!Device.isDevice) return null; 
    // ✅ FIX 3: إنشاء الـ channels هنا لضمان انتظار التنفيذ (Await)
   if (Platform.OS === 'android') { 
  await Notifications.setNotificationChannelAsync('default', { 
    name: 'التطبيقات', 
    importance: Notifications.AndroidImportance.MAX, 
    vibrationPattern: [0, 250, 250, 250], 
    lightColor: '#FF231F7C', 
  });

  await Notifications.setNotificationChannelAsync('noise_alerts', { 
    name: 'تنبيهات الضوضاء', 
    importance: Notifications.AndroidImportance.MAX, // ضروري جداً للظهور كـ Popup 
    vibrationPattern: [0, 250, 250, 250], 
    lightColor: '#FF231F7C', 
    sound: 'default', 
    enableVibrate: true, 
    showBadge: true, 
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // للظهور على قفل الشاشة كما في صورتك 
  }); 
} 
    const { status: existingStatus } = await Notifications.getPermissionsAsync(); 
    let finalStatus = existingStatus; 
    if (existingStatus !== 'granted') { 
      const { status } = await Notifications.requestPermissionsAsync(); 
      finalStatus = status; 
    } 
    if (finalStatus !== 'granted') return null; 
    try { 
      const projectId = Constants.expoConfig?.extra?.eas?.projectId; 
      if (!projectId) return null; 
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data; 
      return token; 
    } catch (e) { 
      return null; 
    } 
  } 
 
useEffect(() => { 
    // 1. استعادة الإعدادات المحفوظة (Theme & Mute) 
    const initData = async () => { 
      const savedMode = await AsyncStorage.getItem('darkMode'); 
      setIsDarkMode(savedMode === 'true'); 
       
      const savedMuteMode = await AsyncStorage.getItem('muteMode'); 
      if (savedMuteMode !== null) { 
        const val = savedMuteMode === 'true'; 
        setIsMuteMode(val); 
        isMuteModeRef.current = val; 
      } 
    }; 
    initData(); 
 
    // 2. المستمعات (Listeners) 
    const subscription = DeviceEventEmitter.addListener('themeChanged', (value) => setIsDarkMode(value)); 
    const muteModeSubscription = DeviceEventEmitter.addListener('muteModeChanged', (value: boolean) => { 
      setIsMuteMode(value); 
      isMuteModeRef.current = value; 
    }); 
 
    // 3. إعداد السوكت (Socket) 
    socket.current = io(SERVER_URL, { transports: ['websocket'] }); 
    socket.current.on('connect', () => { 
      setIsConnected(true); 
      if (pushTokenRef.current) {
        registerDeviceWithServer(pushTokenRef.current);
      }
    }); 
    socket.current.on('disconnect', () => setIsConnected(false)); 
    socket.current.on('update-device-list', (devices: any) => setOnlineDevices(devices)); 
    socket.current.on('update-history', (historyData: any) => { 
      const points = historyData.map((point: any) => ({ 
        latitude: point.lat, 
        longitude: point.lng, 
        weight: point.noiseLevel 
      })); 
      setHeatmapPoints(points); 
    }); 
 
    fetchHeatmapData(); 
 
    // 4. إعداد الإشعارات والموقع والميكروفون (العمل الفعلي) 
    (async () => { 
      // أ- تسجيل توكن الإشعارات 
      const token = await registerForPushNotifications(); 
      pushTokenRef.current = token; 
      if (token && socket.current && socket.current.connected) {
        registerDeviceWithServer(token);
      }
 
      // ب- طلب صلاحيات الموقع (الأمامي) 
      let { status } = await Location.requestForegroundPermissionsAsync(); 
      if (status !== 'granted') return; 
 
      try { 
        // ج- الحصول على الموقع الحالي وتفعيل المراقب 
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); 
        setLocation(loc); 
        locationRef.current = loc; 
 
        locationWatcher.current = await Location.watchPositionAsync({ 
          accuracy: Location.Accuracy.Balanced,  
          distanceInterval: BATTERY_SAFE_SETTINGS.LOCATION_DISTANCE_INTERVAL, 
          timeInterval: BATTERY_SAFE_SETTINGS.LOCATION_TIME_INTERVAL 
        }, (newLoc) => { 
          setLocation(newLoc); 
          locationRef.current = newLoc; 
        AsyncStorage.setItem('lastLocation', JSON.stringify(newLoc)).catch(() => {}); 
          if (socket.current && socket.current.connected && pushTokenRef.current) { 
            socket.current.emit('update-location', { 
              pushToken: pushTokenRef.current, 
              lat: newLoc.coords.latitude, 
              lng: newLoc.coords.longitude, 
            }); 
          } 
        }); 
 
        // د- تفعيل خدمة الخلفية (Background) لضمان عدم توقف الميكروفون 
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync(); 
        if (bgStatus === 'granted') { 
          await Location.startLocationUpdatesAsync(BACKGROUND_NOTIFICATION_TASK, { 
            accuracy: Location.Accuracy.Balanced, 
            timeInterval: 15000, 
            distanceInterval: 20, 
            foregroundService: { 
              notificationTitle: "NoiseHunter يعمل في الخلفية", 
              notificationBody: "نراقب مستوى الضوضاء الآن..", 
              notificationColor: "#00FFCC" 
            } 
          }); 
        } 
 
        // هـ- تشغيل الميكروفون والبدء بالقياس 
        const success = await startRecording(); 
        if (success) { 
          intervalRef.current = setInterval(readNoiseLevel, BATTERY_SAFE_SETTINGS.NORMAL_INTERVAL); 
        } 
 
      } catch (err) { 
        console.log("Initialization Error:", err); 
      } 
    })(); 
 
    // 5. دالة التنظيف (Cleanup) 
    return () => { 
      subscription.remove(); 
      muteModeSubscription.remove(); 
      cleanupRecording(); 
      if (locationWatcher.current) locationWatcher.current.remove(); 
      if (socket.current) socket.current.disconnect(); 
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current); 
      Speech.stop(); 
      Vibration.cancel(); 
    }; 
  }, []); 
 
  const noiseTheme = 
    db >= 75 
      ? { color: '#e74c3c', label: 'ضجيج خطر 🛑' } 
      : db >= 50 
      ? { color: '#f1c40f', label: 'ضجيج متوسط ⚠️' } 
      : { color: themeColors.accent, label: 'هدوء محيط 🌿' }; 
 
  return ( 
    <View style={[styles.container, { backgroundColor: themeColors.bg }]}> 
      {!location ? ( 
        <View style={[styles.loadingContainer, { backgroundColor: themeColors.bg }]}> 
          <ActivityIndicator size="large" color={themeColors.accent} /> 
          <Text style={[styles.loadingText, { color: themeColors.text }]}>جاري تحديد الرادار...</Text> 
        </View> 
      ) : ( 
        <> 
         <MapView 
  ref={mapRef} 
  style={styles.map} 
  provider={PROVIDER_GOOGLE} 
  customMapStyle={isDarkMode ? nightMapStyle : []} 
  region={{ 
    latitude: location.coords.latitude, 
    longitude: location.coords.longitude, 
    latitudeDelta: 0.005, 
    longitudeDelta: 0.005 
  }} 
  showsUserLocation={true} 
  followsUserLocation={true} 
> 
            {showHeatmap && heatmapPoints.length > 0 && ( 
              <Heatmap 
                points={heatmapPoints} 
                radius={40} 
                opacity={0.7} 
                gradient={{ 
                  colors: ["#00FFCC", "#FFFF00", "#FF0000"], 
                  startPoints: [0.1, 0.4, 0.8], 
                  colorMapSize: 256, 
                }} 
              /> 
            )} 
            {!showHeatmap && ( 
              <Circle 
                center={location.coords} 
                radius={70} 
                fillColor={noiseTheme.color + '33'} 
                strokeColor={noiseTheme.color} 
                strokeWidth={2} 
              /> 
            )} 
            {bestPlaceCoords && ( 
              <Marker coordinate={{ latitude: bestPlaceCoords.lat, longitude: bestPlaceCoords.lng }}> 
                <MaterialCommunityIcons name="auto-fix" size={40} color="#00FFCC" /> 
              </Marker> 
            )} 
          </MapView> 
 
          <TouchableOpacity style={[styles.heatmapToggle, { backgroundColor: themeColors.card }]} onPress={() => setShowHeatmap(!showHeatmap)}> 
            <MaterialCommunityIcons name={showHeatmap ? "map-marker" : "layers"} size={24} color={themeColors.accent} /> 
            <Text style={[styles.heatmapToggleText, { color: themeColors.text }]}>{showHeatmap ? "عادي" : "حرارية"}</Text> 
          </TouchableOpacity> 
 
          <View style={[styles.deviceCountBadge, { backgroundColor: isDarkMode ? 'rgba(21,27,35,0.9)' : 'rgba(255,255,255,0.9)' }]}> 
            <MaterialCommunityIcons name="devices" size={14} color={themeColors.accent} /> 
            <Text style={[styles.deviceCountText, { color: themeColors.text }]}> النشطة: {onlineDevices.length}</Text> 
          </View> 
 
          <View style={[styles.connectionBadge, { backgroundColor: isConnected ? themeColors.accent + '33' : '#F4433633', borderColor: isConnected ? themeColors.accent : '#F44336', borderWidth: 1 }]}> 
            <Text style={[styles.connectionText, { color: isConnected ? themeColors.accent : '#F44336' }]}>{isConnected ? '📡 متصل' : '📡 غير متصل'}</Text> 
          </View> 
 
          {isMuteMode && ( 
            <View style={styles.muteBadge}> 
              <MaterialCommunityIcons name="volume-off" size={16} color="#e74c3c" /> 
              <Text style={styles.muteText}>التنبيهات معطلة</Text> 
            </View> 
          )} 
 
          <View style={[styles.dbBadge, { backgroundColor: themeColors.card, borderColor: noiseTheme.color, borderWidth: 2, shadowColor: noiseTheme.color }]}> 
            <MaterialCommunityIcons  
                name={ 
                  noiseCategory === 'صراخ/مفاجئ' ? 'account-voice' : 
                  noiseCategory === 'آلات/مصنع' ? 'factory' : 
                  noiseCategory === 'موسيقى/مستمر' ? 'music-note' : 'leaf' 
                }  
                size={32}  
                color={noiseTheme.color}  
                style={{ marginBottom: 5 }} 
            /> 
            <Text style={[styles.typeText, { color: noiseTheme.color }]}>{noiseCategory} - {noiseTheme.label}</Text> 
            <Text style={[styles.dbText, { color: themeColors.text }]}> 
              {db} <Text style={{ fontSize: 18, color: themeColors.subText }}>dB</Text> 
            </Text> 
          </View> 
{/* قسم اختيار وسيلة النقل وعصا السحر */} 
          <View style={styles.magicContainer}> 
            {/* أزرار اختيار المسافة */} 
            {!isAiLoading && ( 
              <View style={styles.selectionRow}> 
             {/* 1. زر المشي (Walk) */}
<TouchableOpacity  
  style={[
    styles.miniModeCard, 
    { backgroundColor: isDarkMode ? '#151B23' : '#FFFFFF' }, // 👈 هذا هو السطر الجديد اللي ضفناه
    maxDistance === 2 && { backgroundColor: '#4CAF50' } 
  ]} 
  onPress={() => { setMaxDistance(2); animateSelection('walk'); }} 
> 
  <Animated.View style={{ transform: [{ scale: walkScale }] }}> 
    <MaterialCommunityIcons name="walk" size={24} color={maxDistance === 2 ? "#fff" : "#4CAF50"} /> 
  </Animated.View> 
</TouchableOpacity> 

{/* 2. زر السيارة (Car) */}
<TouchableOpacity  
  style={[
    styles.miniModeCard, 
    { backgroundColor: isDarkMode ? '#151B23' : '#FFFFFF' }, // 👈 ونفس السطر ضفناه هون كمان
    maxDistance === 15 && { backgroundColor: '#03A9F4' }
  ]} 
  onPress={() => { setMaxDistance(15); animateSelection('car'); }} 
>    
  <Animated.View style={{ transform: [{ scale: carScale }] }}> 
    <MaterialCommunityIcons name="car" size={24} color={maxDistance === 15 ? "#fff" : "#03A9F4"} /> 
  </Animated.View> 
</TouchableOpacity>
              </View> 
            )} 
 
            {/* زر العصا السحرية مع أنيميشن النبض */} 
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}> 
              <TouchableOpacity  
                style={[styles.aiButton, { backgroundColor: themeColors.accent, shadowColor: themeColors.accent }]}  
                onPress={activateMagicWand}  
                disabled={isAiLoading} 
              > 
                {isAiLoading ? ( 
                  <ActivityIndicator color={isDarkMode ? '#000' : '#fff'} /> 
                ) : ( 
                  <MaterialCommunityIcons name="auto-fix" size={30} color={isDarkMode ? '#000' : '#fff'} /> 
                )} 
              </TouchableOpacity> 
            </Animated.View> 
          </View> 
 
          <Modal visible={showAlertModal} transparent animationType="fade"> 
            <View style={styles.modalBackground}> 
              <View style={[styles.alertBox, { backgroundColor: themeColors.card }]}> 
                <MaterialCommunityIcons name="alert-octagon" size={80} color="#e74c3c" /> 
                <Text style={[styles.alertTitle, { color: '#e74c3c' }]}>تنبيه للمحيطين! 📢</Text> 
                <Text style={[styles.alertSub, { color: themeColors.subText }]}>تم رصد {noiseCategory} بمستوى ({db} dB)</Text> 
                <TouchableOpacity style={styles.stopBtn} onPress={stopAlarmSound}> 
                  <Text style={styles.stopBtnText}>إيقاف التنبيه 🔕</Text> 
                </TouchableOpacity> 
              </View> 
            </View> 
          </Modal> 
        </> 
      )} 
    </View> 
  ); 
} 
 
const styles = StyleSheet.create({ 
  container: { flex: 1 }, 
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
  loadingText: { marginTop: 20, fontSize: 16, fontWeight: 'bold' }, 
  map: { ...StyleSheet.absoluteFillObject }, 
  heatmapToggle: { position: 'absolute', bottom: 40, left: 25, width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 15, zIndex: 10 }, 
  heatmapToggleText: { fontSize: 10, marginTop: 4, fontWeight: 'bold' }, 
  connectionBadge: { position: 'absolute', top: 50, right: 20, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, zIndex: 10 }, 
  deviceCountBadge: { position: 'absolute', top: 50, left: 20, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, zIndex: 10, flexDirection: 'row', alignItems: 'center', elevation: 5 }, 
  deviceCountText: { fontSize: 11, fontWeight: 'bold', marginLeft: 5 }, 
  connectionText: { fontSize: 10, fontWeight: 'bold' }, 
  muteBadge: { position: 'absolute', top: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e74c3c22', borderColor: '#e74c3c', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, zIndex: 10 }, 
  muteText: { color: '#e74c3c', fontSize: 11, fontWeight: 'bold' }, 
  dbBadge: { position: 'absolute', top: 120, alignSelf: 'center', padding: 20, borderRadius: 30, elevation: 20, alignItems: 'center', width: '85%' }, 
  typeText: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }, 
  dbText: { fontSize: 60, fontWeight: '900' }, 
  aiButton: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 15 }, 
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }, 
  alertBox: { 
    width: '85%', 
    borderRadius: 30, 
    padding: 30, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#e74c3c',
    shadowColor: "#e74c3c", // توهج أحمر عند التنبيه
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10
},
  alertTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 15 }, 
  alertSub: { fontSize: 15, textAlign: 'center', marginTop: 10, marginBottom: 25 }, 
  stopBtn: { backgroundColor: '#e74c3c', paddingVertical: 15, borderRadius: 20, width: '100%', alignItems: 'center' }, 
  stopBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 }, 
  magicContainer: { position: 'absolute', bottom: 40, right: 25, alignItems: 'center' }, 
  selectionRow: { flexDirection: 'column', gap: 10, marginBottom: 15 }, 
miniModeCard: {  
    width: 50, height: 50, borderRadius: 25, 
    justifyContent: 'center', alignItems: 'center', elevation: 8, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2
  }
}); 
