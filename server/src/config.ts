import { config as loadEnv } from 'dotenv';
console.log('configuring environment...');
['.env', '.env.local'].forEach(p => loadEnv({ path: p }));
