import { redirect } from 'next/navigation';

/** Root redirect — / → /customer (mirrors Expo default route) */
export default function RootPage() {
  redirect('/customer');
}
