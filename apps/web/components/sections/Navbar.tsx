"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";

const links = [
  { label: "The Problem", href: "#problem" },
  { label: "Solution", href: "#solution" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Analytics", href: "#analytics" },
  { label: "Safety", href: "#safety" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <nav
          aria-label="Primary"
          className="flex items-center justify-between gap-2 rounded-full border border-ink/10 bg-white/80 py-2.5 pl-4 pr-2.5 shadow-[0_18px_50px_-24px_rgba(30,58,95,0.2)] backdrop-blur-xl"
        >
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2 text-ink"
            aria-label="Chekie — back to top"
          >
            <Logo
              subtitle="DOrSU Counseling"
              subtitleClassName="text-ink-muted lg:hidden xl:block"
            />
          </a>

          <div className="hidden shrink-0 items-center lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="whitespace-nowrap px-2 py-2 text-[13px] font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-blue-600 hover:underline xl:px-3 xl:text-sm"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <a
              href="/login"
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              Login
            </a>
            <a
              href="#cta"
              className="inline-flex h-9 items-center justify-center rounded-full bg-yellow-400 px-5 text-[13px] font-bold text-ink shadow-[0_14px_30px_-14px_rgba(245,158,11,0.85)] transition hover:-translate-y-0.5 hover:bg-yellow-300"
            >
              Book a Session
            </a>
          </div>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white/70 text-ink transition hover:bg-white lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-2 rounded-3xl border border-ink/10 bg-white/95 p-3 shadow-[0_24px_60px_-24px_rgba(30,58,95,0.28)] backdrop-blur-xl lg:hidden"
            >
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-[15px] font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-blue-600 hover:underline"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 p-1">
                <a
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-ink/15 bg-white text-sm font-semibold text-ink"
                >
                  Login
                </a>
                <a
                  href="#cta"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-ink"
                >
                  Book a Session
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}
