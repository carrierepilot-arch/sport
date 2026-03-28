import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sport.fitness',
  appName: 'Sport',
  webDir: 'public',
  // Configure server for local development
  server: {
    androidScheme: 'https',
    // Point to local Next.js server running on device
    // This allows full offline capability with API routes
    url: 'http://localhost:3000',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
