# Frontend & UI Component Specifications

This document outlines the detailed frontend architecture, design system, CSS specifications, and JavaScript interactivity extracted from the legacy `INDEX.HTML` (public storefront) and `admin.html` (CMS dashboard). It serves as the visual and interactive blueprint for the Next.js migration.

---

## 1. Global Design System (Tokens)

The legacy application heavily utilizes CSS variables (custom properties) to enforce a dark-mode-first aesthetic with gold accents.

### 1.1 Typography
- **Primary Font (Sans-serif)**: `Inter` (Weights: 300, 400, 500, 600)
- **Heading Font (Serif)**: `Playfair Display` (Weights: 400, 500)
- **Icons**: FontAwesome 6.4.0

### 1.2 Color Palette
- `--bg-light`: `#f7f6f2` (Used as the base body background)
- `--bg-dark`: `#121315` (Used for dark sections and the Admin UI base)
- `--bg-card`: `#1c1d1f` (Used for service cards and Admin UI modules)
- `--accent`: `#d0aa69` (Gold accent used for active states, buttons, and highlights)
- `--accent-hover`: `#b89254` (Darker gold for hover states)
- `--text-light`: `#ffffff` (Primary text on dark backgrounds)
- `--text-muted`: `#a0a0a0` (Secondary text on dark backgrounds)
- `--text-dark`: `#222222` (Primary text on light backgrounds)
- `--text-dark-muted`: `#555555` (Secondary text on light backgrounds)

---

## 2. Public Storefront (`INDEX.HTML`)

### 2.1 Layout & Grid System
- **Container**: Max-width of `1400px` with `5%` horizontal padding.
- **Split Section Pattern**: Many sections use a `split-section` class featuring a flexbox layout.
  - Left column (`split-left`): `25%` width, holds section tags, titles, and descriptions.
  - Right column (`split-right`): Takes remaining space, holds dynamic grids.
- **Responsive Breakpoints**:
  - `@media (max-width: 1024px)`: Split sections collapse into single columns. Grids reduce columns.
  - `@media (max-width: 768px)`: Complete mobile layout (single column grids).

### 2.2 Component Hierarchy
1. **Header/Nav**:
   - Absolute positioning, transparent over the hero image.
   - Contains Logo, Language toggles (EN/ES), Navigation links, and a "Get In Touch" button.
2. **Hero Section**:
   - `100vh` height.
   - Dynamic background image with a linear-gradient overlay `linear-gradient(rgba(18, 19, 21, 0.8), rgba(18, 19, 21, 0.6))`.
3. **Stats Bar**:
   - Floating element overlapping the Hero and the next section (`margin-top: -50px; z-index: 10`).
   - Flexbox layout distributing `stat-items` evenly.
4. **Projects Grid**:
   - CSS Grid layout: 3 columns, `220px` auto-rows.
   - Classes dynamically assign spans: `card-large-left` (spans 1 col, 2 rows), `card-top-mid`, `card-bot-mid`, `card-large-right`.
   - Hover effects trigger image scaling (`transform: scale(1.05)`).
5. **Services Section**:
   - 5-column grid mapping to `service-card` elements.
   - Cards float up on hover (`transform: translateY(-10px)`).
6. **Process Section**:
   - Horizontal layout with a dashed absolute-positioned connecting line behind circular step numbers.
7. **Dynamic Forms**:
   - Appended to the bottom of the page in a max-width container (`600px`).
   - Renders custom inputs based on the `form.fields` payload (text, email, textarea).
8. **Footer**:
   - Dark block (`#0d0d0f`). 3-column top section (CTA, Contact, Brand), bottom row for copyright and links.

---

## 3. Admin Dashboard (`admin.html`)

### 3.1 Aesthetic & Layout
- **Theme**: Light grey body (`#f4f4f9`) with a centralized white card (`.admin-card`) restricted to `max-width: 800px`.
- **Form Controls**: Squared-off inputs. Invalid inputs turn red (`#e74c3c` borders, `#fdf0ed` background).
- **HUD Widgets**: Live System Vitals are displayed in dark terminal-styled boxes (`bg-[#1c1d1f]`) showing Memory, CPU, and Uptime.

### 3.2 Interactive JS Libraries
- **Quill.js (Rich Text)**:
  - Custom dark theme overrides (`.ql-container { background: #121315; color: #fff; }`).
  - Used for the Hero Subtext and Service descriptions.
- **SortableJS**:
  - Attached to Services, Stats, and Projects containers.
  - Activated via `.drag-handle` class (grip-vertical icon).

### 3.3 Dynamic Form Builder & Inbox
- **Form Builder Module**: Allows admins to add dynamic fields (Short Text, Email, Paragraph) with real-time UI updates.
- **Media Vault Module**:
  - `media-gallery-grid` renders a flexible grid (`minmax(100px, 1fr)`).
  - Hovering over a thumbnail (`media-thumb-card`) reveals a circular red archive button.
  - Selected images have a green border (`#2ecc71`) with a subtle glow box-shadow.
- **Inbox Module**:
  - Dropdown select allows switching between form responses.
  - Generates a dynamic HTML table.
  - "Export CSV" button uses a native JS `Blob` object to generate and trigger a `.csv` file download.

### 3.4 Feedback & State Management
- **Toast Notifications**: Absolute positioned snackbar that slides up from the bottom for success/error messages.
- **Auto-Save Status**: Text indicator in the UI that updates every 30 seconds when polling the backend, flashing an icon and updating timestamps upon successful draft syncs.
