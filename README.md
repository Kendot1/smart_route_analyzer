<<<<<<< HEAD
# smart_route_analyzer
=======
# Smart Mobility Route Analyzer (FitRoute)

A real-time route analysis and GPS tracking application built with React, TypeScript, and Vite. Features physics-based energy calculations, weather-adjusted predictions, and smart recommendations.

## Features

- **GPS Live Tracking** — Real-time activity tracking with distance, speed, and calorie computation
- **Route Planning** — Interactive Leaflet map with origin/destination pinning and multi-source routing (OSRM, Valhalla, OpenRouteService)
- **Physics Engine** — Velocity, calorie burn (MET-based), fuel consumption, and weather-adjusted difficulty
- **Weather Integration** — Open-Meteo API for live temperature, rain, and wind conditions at the route midpoint
- **Smart Recommendations** — Context-aware travel suggestions based on weather and difficulty
- **Multi-Activity Support** — Walking, Jogging, Biking, and Car modes
- **Responsive UI** — Mobile-first design with Tailwind CSS, Lucide icons, and micro-animations

## Tech Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Framework   | React 18 + TypeScript (strict)                  |
| Bundler     | Vite 6 + `@tailwindcss/vite`                   |
| Styling     | Tailwind CSS 4 + custom theme tokens            |
| Maps        | Leaflet + OpenStreetMap tiles                   |
| Routing APIs| OSRM · Valhalla · OpenRouteService (fallback chain) |
| Weather     | Open-Meteo (free, no key required)              |
| UI          | shadcn/ui (Radix primitives) + Lucide React     |
| Icons       | Lucide React                                    |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
├── index.html                  # Entry HTML
├── vite.config.ts              # Vite config (React + Tailwind + @ alias)
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
├── postcss.config.mjs          # PostCSS (empty — Tailwind via Vite plugin)
├── pnpm-workspace.yaml         # PNPM workspace
│
└── src/
    ├── main.tsx                # React entry point
    │
    ├── app/
    │   ├── App.tsx             # Root app — page routing, route analysis logic
    │   │
    │   ├── components/
    │   │   ├── Header.tsx          # Top navigation bar
    │   │   ├── Sidebar.tsx         # Plan mode sidebar (origin/dest, settings)
    │   │   ├── LandingPage.tsx     # Home / hero page
    │   │   ├── AboutPage.tsx       # About page
    │   │   ├── InteractiveMap.tsx   # Full interactive Leaflet map
    │   │   ├── SimpleMap.tsx        # Plan-mode map with pin placement
    │   │   ├── LiveMap.tsx          # GPS tracking map view
    │   │   ├── LiveTracker.tsx      # GPS tracking controller
    │   │   ├── InputForm.tsx        # Route input form
    │   │   ├── ResultsPanel.tsx     # Analysis results display
    │   │   ├── ModeSelector.tsx     # Activity mode picker
    │   │   ├── StatsCard.tsx        # Statistics card component
    │   │   ├── QuickExamples.tsx    # Preset route examples
    │   │   ├── GradientButton.tsx   # Styled gradient button
    │   │   ├── Toast.tsx            # Toast notifications
    │   │   ├── LoadingSpinner.tsx   # Loading indicator
    │   │   ├── SuccessCelebration.tsx # Confetti celebration
    │   │   ├── OnboardingTooltip.tsx  # First-visit tooltips
    │   │   ├── PhilippinesMask.ts    # PH geo-boundary
    │   │   ├── figma/               # Figma-specific components
    │   │   └── ui/                  # shadcn/ui primitives (48 components)
    │   │
    │   └── lib/
    │       ├── physics.ts          # Velocity, calories, fuel, difficulty
    │       ├── recommendations.ts  # Smart weather-based suggestions
    │       ├── routeUtils.ts       # OSRM/Valhalla/ORS routing + Haversine
    │       └── types.ts            # Shared TypeScript interfaces
    │
    ├── imports/                    # Static image assets
    │
    └── styles/
        ├── index.css              # Master CSS import
        ├── tailwind.css           # Tailwind base + tw-animate-css
        ├── theme.css              # Custom design tokens & theme
        ├── animations.css         # Keyframe animations
        └── fonts.css              # Font declarations
```

## Physics Formulas

### Velocity
```
velocity = distance (km) / time (hours)
```

### Calories (Walking / Jogging / Biking)
```
calories = MET × weight (kg) × time (hours) × difficulty_factor
```

| Mode    | MET  |
|---------|------|
| Walking | 3.5  |
| Jogging | 8.0  |
| Biking  | 7.5  |

### Fuel & Cost (Car)
```
fuel (L) = distance (km) / 12 km/L
cost (₱) = fuel × ₱60/L
```

### Difficulty Factor
```
difficulty = 1 + (rain / 50) + (wind / 100) + (|temp − 25| / 50)
```

| Factor Range | Level    |
|-------------|----------|
| < 1.3       | Easy     |
| 1.3 – 1.7  | Moderate |
| > 1.7       | Hard     |

## Routing Fallback Chain

The app tries multiple free routing services in order:

1. **OSRM** (router.project-osrm.org) — Primary
2. **Valhalla** (valhalla1.openstreetmap.de) — Secondary
3. **OpenRouteService** — Tertiary
4. **Curved approximation** — Offline fallback using Catmull-Rom splines

## Build for Production

```bash
pnpm build
```

Output is generated in `dist/`.

## License

MIT
>>>>>>> b9d8d71 (Initial commit for this system)
