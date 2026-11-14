import { Suspense } from "react";
import { Navbar } from "@/components/sections/Navbar";
import { LandingBackdrop } from "@/components/sections/LandingBackdrop";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Solution } from "@/components/sections/Solution";
import { KeyFeatures } from "@/components/sections/KeyFeatures";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Roles } from "@/components/sections/Roles";
import { Analytics } from "@/components/sections/Analytics";
import { Safety } from "@/components/sections/Safety";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { AuthMessageToast } from "@/components/shared/auth-message-toast";

/**
 * Public landing page. Always a calm vertical scroll in the same light,
 * cream-on-blue visual language as the staff portal.
 */
export default function Page() {
  return (
    <div
      data-light-island
      className="relative min-h-screen overflow-x-clip bg-[#EFF6FF]"
    >
      <LandingBackdrop />
      <Suspense>
        <AuthMessageToast />
      </Suspense>
      <Navbar />
      <main id="main" className="relative z-10">
        <Hero />
        <Problem />
        <Solution />
        <KeyFeatures />
        <HowItWorks />
        <Roles />
        <Analytics />
        <Safety />
        <FinalCTA />
      </main>
    </div>
  );
}
