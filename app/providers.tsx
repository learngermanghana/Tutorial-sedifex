'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
const app = initializeApp({ projectId: 'mock-sedifex-admin' });
getAuth();
const client = new QueryClient();
export default function Providers({children}:{children:React.ReactNode}){void app;return <QueryClientProvider client={client}>{children}</QueryClientProvider>}
