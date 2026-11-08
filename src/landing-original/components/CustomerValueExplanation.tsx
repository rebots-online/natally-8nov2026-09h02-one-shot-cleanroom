import React, { useId } from 'react';

export function CustomerValueExplanation({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const headingId = useId();
  const Heading = headingLevel === 4 ? 'h4' : 'h3';

  return <section aria-labelledby={headingId} className="space-y-3 border-b border-[#d4af37]/20 pb-4">
    <Heading id={headingId} className="text-lg font-semibold leading-snug text-[#f2ca50]">
      Explore what your chart means for you
    </Heading>
    <div className="space-y-2 text-sm leading-relaxed text-[#f1e8d8]">
      <p>Get a personal reading from Natally, then ask follow-up questions about the placements, patterns and relationships that matter to you.</p>
      <p>Cr pays for your personal readings and conversations. Your balance is used as Natally creates a reading or reply; longer replies can use more Cr.</p>
      <p>Choose an amount when you’re ready, then return to your reading.</p>
    </div>
  </section>;
}
