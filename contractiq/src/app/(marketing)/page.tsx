import { CtaSection } from '@/components/marketing/cta-section';
import { DemoMedia } from '@/components/marketing/demo-media';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { LandingHeader } from '@/components/marketing/landing-header';
import { LandingHero } from '@/components/marketing/landing-hero';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { ValueProps } from '@/components/marketing/value-props';
import { getCurrentUser } from '@/lib/auth/get-user';

// Landing page — docs/specs/landing-and-onboarding.md §3
export default async function HomePage() {
  const signedIn = (await getCurrentUser()) !== null;
  return (
    <div className="flex min-h-dvh flex-col bg-primary">
      <LandingHeader signedIn={signedIn} />
      <main id="main" className="flex flex-col">
        <div className="grid items-center gap-10 px-4 py-16 md:px-12 lg:grid-cols-2 xl:px-28 xl:py-24">
          <LandingHero signedIn={signedIn} />
          <DemoMedia />
        </div>
        <div className="flex flex-col gap-16 bg-surface px-4 py-16 md:px-12 xl:px-28">
          <ValueProps />
          <HowItWorks />
          <CtaSection signedIn={signedIn} />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
