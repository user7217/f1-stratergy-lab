# F1 Telemetry Frontend

React single-page application for rendering Formula 1 telemetry and historical analytics. Built with React Router and Recharts.

## Architecture & Data Flow

Client-side rendering model. Components fetch JSON payloads from a local FastAPI backend (`http://localhost:8000`). Component state transforms parallel arrays into array-of-objects formats required by Recharts.

### Routing

Uses `react-router-dom` `BrowserRouter`. The left settings/navigation sidebar remains persistently mounted. The center panel swaps based on the route.
* **`/` (Live)**: Renders live telemetry, track map, and race control feed.
* **`/overview` (`RaceOverview.jsx`)**: Renders session-specific analytics (Race, Sprint, Quali).
* **`/season` (`SeasonPerformance.jsx`)**: Renders season-long aggregate data.

## Core Modules

### RaceOverview.jsx

Handles isolated session data.
* **Caching Mechanism**: Uses a module-level `OVERVIEW_CACHE` object. Keys are generated via `${year}-${race}-${sessionType}`. Bypasses the network request if data exists in memory when switching session tabs.
* **Master/Detail Layout**: Sidebar acts as the entity selector. Main panel renders global session metrics or specific driver metrics based on selection state.
* **Tyre Degradation Engine**: Uses `ScatterChart` to plot lap times against tyre age. Isolates clean laps to visualize compound wear rates.
* **Positional Tracking**: Uses a `LineChart` with `type="stepAfter"`. Custom SVG components map `pit_in` boolean flags to render physical pit stop markers on the timeline.

### SeasonPerformance.jsx

Handles season-wide data aggregation.
* **Tri-State Navigation**: Uses a compound state object (`{ type: string, id: string | null }`) to control both the sidebar list and the main panel render target (Global, Teams, Drivers).
* **Missing Data Bridging**: Drivers miss races. Backend pads these missing indexes with `null`. Recharts `Line` components use the `connectNulls` prop to draw continuous SVG paths across these empty data points.
* **Consistency Metrics**: Displays standard deviation metrics for grid and finish positions to quantify driver variance.

## Rendering Constraints & Styling

Uses inline CSS with strict Flexbox rules.

* **Recharts Flexbox Collision Fix**: Recharts `ResponsiveContainer` uses absolute positioning internally. When placed inside a `display: flex; flex-direction: column` container, the browser applies `flex-shrink: 1` and collapses the chart to 0px. Chart wrappers enforce `minHeight: 350px` and `flexShrink: 0` to block this collapse.
* **Overflow Handling**: Dynamic string lengths (like Constructor names) are contained using `overflow: hidden`, `textOverflow: 'ellipsis'`, and `whiteSpace: 'nowrap'`.

## Setup

1. Install required packages.
   ```bash
   npm install react-router-dom recharts