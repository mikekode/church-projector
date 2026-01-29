# Implementation Plan: World-Class Church Projector System

## Objective
Transform the existing Church Projector application into a premium, enterprise-grade software solution. Focus on eliminating detection lag, ensuring 100% accuracy in scripture lookup, and delivering a visually stunning UI.

## Phase 1: Core Logic & Performance (The "Brain")

The current detection logic is brittle (simple regex) and intolerant of speech variations (e.g., "John 3 16" vs "John three sixteen").

### 1.1 Robust Verse Detection Engine (`utils/verseDetection.ts`)
- **Text Normalization**: Create a utility to convert spoken numbers to digits ("First John three sixteen" -> "1 John 3:16").
- **Fuzzy Book Matching**: Use Levenshtein distance or a comprehensive alias map to handle "St. John", "Revelations" (plural), etc.
- **Advanced Regex**: Implement a multi-stage regex that catches:
  - `[Book] [Chapter] [Verse]`
  - `[Book] [Chapter] verse [Verse]`
  - `[Book] chapter [Chapter] verse [Verse]`
- **Validation**: Ensure chapter/verse exist in the JSON data before emitting a match.

### 1.2 Optimized State Management
- **Debounced Processing**: Prevent the detection loop from choking the main thread on rapid speech input.
- **Smart buffer**: Improve the sliding window logic to ensure split verses (between chunks) are caught.

## Phase 2: Enterprise UI/UX Design (The "Face")

### 2.1 Design System (`app/globals.css` & Tailwind)
- **Palette**: Deep "Obsidian" background, "Starlight" text (off-white for readability), "Royal Gold" accents for active states.
- **Typography**: 
  - *UI*: `Inter` or `Geist Sans` (clean, modern).
  - *Scripture*: `Libre Baskerville` or `Merriweather` (dignified, highly readable serif).
- **Effects**: Glassmorphism (blur backgrounds), smooth entry animations, subtle pulses for "Live" status.

### 2.2 Operator Dashboard (`app/dashboard/page.tsx`)
- **Layout**: 3-Panel "Command Center"
  1. **Live Stream**: Left panel showing real-time speech transcript with highlighting of detected terms.
  2. **Queue & Control**: Center panel showing detected verses, "Go Live" buttons, and history.
  3. **Preview**: Right panel showing a scalable preview of what's on the projector.
- **Feedback**: Instant visual cues when a verse is detected (glow effect).

### 2.3 Projector View (`app/projector/page.tsx`)
- **Typography**: Massive, legible text.
- **Transitions**: Cross-fade between verses (no jarring cuts).
- **Lower Thirds**: Option to show verse as a lower-third overlay on camera feed (future proofing). for now, just a beautiful fullscreen card.

## Implementation Steps

1.  **Create `utils/textNormalization.ts`**: Handle "number words" to digits.
2.  **Upgrade `utils/bible.ts`**: Add the fuzzy matcher.
3.  **Refactor `DashboardPage`**: Integrate the new detection logic.
4.  **Reskin `DashboardPage`**: Apply the new enterprise design.
5.  **Reskin `ProjectorPage`**: Apply the cinematic typography and animations.
