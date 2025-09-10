// js/auth/web-auth.js - Browser Google Authentication Handler

export class WebAuth {
  constructor() {
    this.gapi = null;
    this.tokenClient = null;
    this.config = {
      client_id: '221142210647-58t8hr48rk7nlgl56j969himso1qjjoo.apps.googleusercontent.com',
      scope: 'profile email'
    };
  }

  async init() {
    // For now, this is a stub since you're focusing on native auth
    // We can implement the full Google API logic here later if needed
    console.log('🔐 Web auth initialized (stub)');
  }

  async signIn() {
    // Stub implementation
    throw new Error('Web authentication not yet implemented');
  }

  signOut() {
    // Stub implementation
    console.log('🔐 Web sign-out (stub)');
  }
}
