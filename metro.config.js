const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// إضافة دعم لملفات tflite لكي يتمكن الموبايل من تحميل المودل
config.resolver.assetExts.push('tflite');

module.exports = config;