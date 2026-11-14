"use client";

import { AnimatedSection, Eyebrow, Stagger, StaggerItem } from "@/components/AnimatedSection";
import { safetyItems as items } from "@/lib/content";

export function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-heading" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[2.5rem] border border-ink/10 bg-[linear-gradient(160deg,rgba(37,99,235,0.08),rgba(255,255,255,0.85)_45%,rgba(251,191,36,0.10))] p-8 shadow-card backdrop-blur-xl sm:p-12 lg:p-16">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <Eyebrow>Safety &amp; privacy</Eyebrow>
            <h2
              id="safety-heading"
              className="mt-5 text-balance text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[2.6rem]"
            >
              Your story stays yours.{" "}
              <span className="font-serif font-normal italic text-blue-600">
                We built it that way.
              </span>
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
              Seeking help takes trust. So anonymity isn&apos;t a setting — it&apos;s
              the starting point. And when safety truly requires an exception,
              the process is strict, transparent, and reviewable.
            </p>
          </AnimatedSection>

          <Stagger className="mt-10 grid gap-5 md:grid-cols-2" delay={0.1}>
            {items.map(({ icon: Icon, tint, title, body }) => (
              <StaggerItem key={title}>
                <article className="flex h-full gap-4 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:bg-white">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tint}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-display text-[17px] font-semibold text-ink">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-muted">
                      {body}
                    </p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>

          <AnimatedSection delay={0.15} className="mt-8">
            <p className="mx-auto max-w-3xl rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4 text-center text-[15px] font-medium leading-relaxed text-ink shadow-sm">
              If you&apos;re ever in crisis, you don&apos;t have to wait for a slot —
              reach out to the Guidance Office directly or contact local emergency
              services. This system supports care; it never replaces urgent help.
            </p>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
