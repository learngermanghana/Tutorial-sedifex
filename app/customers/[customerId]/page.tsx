import { redirect } from 'next/navigation';

type Params = Promise<{ customerId: string }>;

export default async function CustomerRedirectPage({ params }: { params: Params }) {
  const { customerId } = await params;
  redirect(`/admin/customers/${encodeURIComponent(customerId)}`);
}
