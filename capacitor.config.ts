import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sport.fitness',
  appName: 'Sport',
  webDir: 'public',
  // 100% offline-first: No server URL, all assets embedded
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
