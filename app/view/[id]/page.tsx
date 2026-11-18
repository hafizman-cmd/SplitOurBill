import type { Metadata } from 'next';
import { getSharedBill } from '@/lib/shared-bills';
import GuestBillView from '../GuestBillView';
import ShareLinkStatus from '../ShareLinkStatus';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shared Bill | Kira-Kira',
  description: 'View a bill shared with you on Kira-Kira.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SharedBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSharedBill(id);
  if (result.status !== 'found') return <ShareLinkStatus status={result.status} />;
  return <GuestBillView key={id} bill={result.bill} />;
}
