import TopNav from '@/components/TopNav';
import RenewBanner from '@/components/RenewBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <RenewBanner />
      <main className="shell">{children}</main>
    </>
  );
}
