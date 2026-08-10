import { memo } from 'react';
/** The dial itself: four concentric rings, a sweep and a core. Purely decorative — every state is driven by the parent's class. */
export const AssistantInstrument = memo(function AssistantInstrument() {
  return <div className="hud-dial" aria-hidden="true">
    <i className="hud-halo" />
    <svg className="hud-rings" viewBox="0 0 200 200" focusable="false">
      <circle className="hud-ring graduations" cx="100" cy="100" r="94" />
      <circle className="hud-ring majors" cx="100" cy="100" r="85" />
      <circle className="hud-ring arcs" cx="100" cy="100" r="74" />
      <circle className="hud-ring hairline" cx="100" cy="100" r="63" />
    </svg>
    <i className="hud-sweep" />
    <i className="hud-core"><i /></i>
  </div>;
});
