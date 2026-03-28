import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sport.fitness',
  appName: 'Sport',
  webDir: 'public',  // PWA files served from public/
  server: {
    androidScheme: 'https',
    url: 'https://sport-alpha-lake.vercel.app',  // Production URL
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
