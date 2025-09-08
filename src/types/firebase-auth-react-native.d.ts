// src/types/firebase-auth-react-native.d.ts
// Type declarations for firebase/auth/react-native module

declare module "firebase/auth/react-native" {
  export function initializeAuth(app: any, options?: any): any;
  export function getReactNativePersistence(storage: any): any;
}
