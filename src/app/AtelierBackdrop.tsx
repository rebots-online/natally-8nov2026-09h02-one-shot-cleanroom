// Full-viewport layered atelier scene built from the real art shipped in
// /public/atelier (see its manifest.json): puppet-cleanplate.webp is the scene
// backdrop, room.webp — the shaded composite, pixel-registered with the plate
// outside the puppet region — is masked to that region and layered on top as
// the living mascot. poster.webp is the manifest's static fallback if the
// layers fail to load. natally-mascot.webp rides along as the companion
// portrait card in the corner.

import { useState } from 'react';

export default function AtelierBackdrop() {
  const [sceneFailed, setSceneFailed] = useState(false);

  if (sceneFailed) {
    return (
      <>
        <div className="atelier-scene" aria-hidden="true">
          <img className="scene-layer" src="/atelier/poster.webp" alt="" />
          <div className="scene-dim" />
        </div>
        <CompanionCard />
      </>
    );
  }

  return (
    <>
      <div className="atelier-scene" aria-hidden="true">
        <img
          className="scene-layer"
          src="/atelier/puppet-cleanplate.webp"
          alt=""
          onError={() => setSceneFailed(true)}
        />
        <img
          className="scene-layer scene-mascot"
          src="/atelier/room.webp"
          alt=""
          onError={() => setSceneFailed(true)}
        />
        <div className="scene-dim" />
      </div>
      <CompanionCard />
    </>
  );
}

function CompanionCard() {
  return (
    <div className="companion-card">
      <img src="/natally-mascot.webp" alt="Natally, your astrologer companion" />
      <span>Natally</span>
    </div>
  );
}
