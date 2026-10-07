import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  privacyPolicy,
  type PrivacyPolicyBlock,
  type PrivacyPolicySection,
} from "@/data/privacyPolicy";
import { ChevronDown } from "lucide-react";

const TOC_INDEX = privacyPolicy.sections.findIndex(
  (s) => s.heading === "SUMÁRIO",
);

const SectionBlocks = ({ blocks }: { blocks: PrivacyPolicyBlock[] }) => (
  <>
    {blocks.map((b, i) => {
      if (b.type === "sub") {
        return (
          <h3 key={i} className="text-base font-semibold text-foreground mt-6 mb-2">
            {b.heading}
          </h3>
        );
      }
      if (b.type === "list") {
        return (
          <ul key={i} className="list-disc ml-6 space-y-1.5 text-sm text-muted-foreground">
            {b.lines?.map((l, j) => (
              <li key={j}>{l.replace(/;$/, "")}</li>
            ))}
          </ul>
        );
      }
      return (
        <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {b.lines?.join("\n")}
        </p>
      );
    })}
  </>
);

const Section = ({ section }: { section: PrivacyPolicySection }) => (
  <section className="scroll-mt-28">
    <h2 className="text-xl font-semibold font-display text-foreground mb-3">
      {section.heading}
    </h2>
    <div className="space-y-3">
      <SectionBlocks blocks={section.blocks} />
    </div>
  </section>
);

const Privacy = () => {
  const [tocOpen, setTocOpen] = useState(false);
  const tocSection =
    TOC_INDEX >= 0 ? privacyPolicy.sections[TOC_INDEX] : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 pt-28 pb-16">
        <h1 className="font-display text-3xl font-bold">{privacyPolicy.title}</h1>
        <p className="text-muted-foreground text-sm mt-2">
          {privacyPolicy.lastUpdate} · {privacyPolicy.version}
        </p>

        {tocSection && (
          <div className="mt-6 rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setTocOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
              aria-expanded={tocOpen}
            >
              Sumário
              <ChevronDown
                className={`w-4 h-4 transition-transform ${tocOpen ? "rotate-180" : ""}`}
              />
            </button>
            {tocOpen && (
              <ul className="px-4 pb-4 space-y-1.5 text-sm">
                {tocSection.blocks
                  .flatMap((b) => b.lines ?? [])
                  .map((title, i) => (
                    <li key={i} className="text-muted-foreground">
                      {title}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-10 space-y-10">
          {privacyPolicy.sections.map((s, i) =>
            i === TOC_INDEX ? null : <Section key={i} section={s} />,
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
