import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sport.app',
  appName: 'Sport',
  webDir: '.next/standalone/app',
  server: {
    androidScheme: 'https',
    url: 'https://sport-alpha-lake.vercel.app',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
