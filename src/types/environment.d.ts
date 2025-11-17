declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DISCORD_TOKEN: string;
      DISCORD_CLIENT_ID: string;
      MONGODB_URI: string;
      NODE_ENV: 'development' | 'production';
    }
  }
}

export {};
