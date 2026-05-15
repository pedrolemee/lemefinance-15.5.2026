import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.64f851ffe51d45218b730aca23ccdcf9',
  appName: 'lemefinance',
  webDir: 'dist',
  server: {
    url: 'https://64f851ff-e51d-4521-8b73-0aca23ccdcf9.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
