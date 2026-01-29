# Strategy: The "10x Better" Church Projector
**Goal:** Outperform ProPresenter/EasyWorship by leveraging Web Technologies (Real-time collaboration, Global Accessibility) while matching their pro-grade rendering capabilities.

## 1. The Rendering Core: "Visual Stacks" (ProPresenter Killer)
Standard web apps render one "page". We will render **4 Independent Layers** overlaid via CSS Grid/Z-Index. This allows independent clearing/transitioning of elements.

### The Stack:
*   **Z-10: Background Layer**: `<video>` loops, static images, or live camera feed (WebRTC/device input). *Independent Loop.*
*   **Z-20: Content Layer**: Song Lyrics, Scripture Text. *Transition: Cross-Dissolve / Scale.*
*   **Z-30: Props Layer**: Logos, "Live" bugs, Seasonal overlays. *Static/Persistent.*
*   **Z-40: Alerts Layer**: Nursery Calls, Countdown timers, "Toast" messages. *Transient.*

**UX Win:** Operator hits "Clear Lyrics" -> Text fades out, but Motion Background keeps spinning. Operator hits "Blackout" -> Everything fades to black.

## 2. The Planning UX: "Figma for Worship"
Most apps are file-based (save `.pro` file, email it). Ours is state-based.
*   **Live Schedule**: stored in a JSON state that syncs via BroadcastChannel (local) or WebSockets (remote).
*   **Reflow Editor**: A "Word Doc" view for songs.
    *   *Input:* "Amazing grace [Break] how sweet the sound"
    *   *Output:* Two Slides automatically generated.
    *   *Benefit:* Editing lyrics is typing, not box-dragging.

## 3. The "Smart Looks" Engine (Context Awareness)
Stop asking volunteers to format slides. Use **Intent-Based Rendering**.
1.  **Define Items**: "Amazing Grace" is type `Song`. "John 3:16" is type `Scripture`.
2.  **Define Scenes**: "Worship Set", "Sermon".
3.  **Rules**: 
    *   IF `Scripture` AND Scene is `Sermon` -> Render as **Lower Third**.
    *   IF `Scripture` AND Scene is `Worship` -> Render as **Full Screen**.
    *   IF `Song` -> Always use **Center Layout**.

**UX Win:** The pastor's notes automatically look different from the song lyrics without manual tweaking.

## 4. Stage Command (Confidence Monitor)
The band needs more info than the audience.
*   **"Next Line" Preview**: The most requested feature. Show the *first line* of the next slide in yellow so singers know where to go.
*   **Chord Overlay**: If the song data has chords, render them ONLY on the stage display.
*   **Countdown-to-End**: "Sermon ends in 5:00".

## Implementation Plan (Phase 2 & 3)

### Phase 2: The Service Builder (Next Immediate Steps)
1.  **Build `ScheduleManager.tsx`**: A drag-and-drop list (using `@dnd-kit/core`).
2.  **Build The "Reflow" Modal**: A text area to quickly edit/paste song lyrics and auto-split them into slides.
3.  **Upgrade `ProjectorPage`**: Implement the 4-layer `VisualStack`.

### Phase 3: Advanced Media
1.  **Motion Backgrounds**: Add video loop support.
2.  **Stage Display**: Create `/stage` route derived from Projector state.

## Immediate Action Items
*   [ ] Create `components/VisualStack.tsx` (Layering Engine).
*   [ ] Create `components/ServiceSchedule.tsx` (Drag & Drop UI).
