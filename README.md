# LeverageCanvas
[![Deploy to Cloudflare]([cloudflarebutton])]([cloudflarebutton])
LeverageCanvas is an Excalidraw-inspired collaborative sketch canvas built on Cloudflare Workers and Durable Objects. It provides a visually stunning drawing surface with vector shapes, freehand drawing, text support, and real-time collaboration features, all powered by a serverless architecture for seamless persistence and sharing.
## Description
LeverageCanvas offers a polished, intuitive whiteboard experience similar to Excalidraw, focusing on delightful interactions and high performance. Users can create drawings with rectangles, ellipses, lines, arrows, freehand strokes with smoothing, and text elements. It includes selection, transformation (move, scale, rotate), layer management, and a clean toolbar. Collaboration is handled through optimistic local edits with periodic syncing via Cloudflare's Global Durable Objects, ensuring low-latency updates without WebSockets. Drawings are persisted serverlessly and exportable as SVG or PNG.
## Key Features
- **Vector Drawing Tools**: Rectangle, ellipse, line, arrow, freehand pen (with Catmull-Rom spline smoothing), and text insertion.
- **Interactive Editing**: Selection, multi-transform (move/scale/rotate), z-order layering, and property inspector for fill, stroke, width, and opacity.
- **Collaboration & Sync**: Optimistic UI updates with debounced autosave; background polling for remote changes detection; future phases include CRDT-based real-time syncing.
- **Toolbar & UI**: Sticky top toolbar with tool toggles, undo/redo, color picker, stroke width selector, export, and save options.
- **Export & Persistence**: Download as SVG/PNG; save/load drawings via REST APIs backed by Durable Objects.
- **Responsive Design**: Mobile-first layout with touch-friendly interactions, using shadcn/ui components for a modern, accessible interface.
- **Performance Optimizations**: SVG-based rendering for crisp vectors; throttled pointer sampling; bounded drawing sizes to prevent bloat.
- **Keyboard Shortcuts**: Quick tool switching (V: select, P: pen, R: rect, etc.) and actions (Del: delete, Cmd+S: save).
- **Empty State & Onboarding**: Playful illustrated prompts for new users to start drawing.
## Technology Stack
- **Frontend**: React 18, React Router, Tailwind CSS v3, shadcn/ui (Radix UI primitives), Framer Motion (micro-interactions), Lucide React (icons), Zustand (state management), Sonner (toasts).
- **Backend**: Hono (routing), Cloudflare Workers, Durable Objects (via custom IndexedEntity library for entity-based storage).
- **Shared**: TypeScript (end-to-end), Zod (validation), Immer (immutable updates).
- **Utilities**: react-use (hooks), react-colorful (color picker), react-hotkeys-hook (shortcuts).
- **Build & Dev**: Vite (bundler), Bun (package manager), Wrangler (Cloudflare deployment).
- **Storage**: Single Global Durable Object for all entities (drawings, layers, etc.), with index-based listing and CAS for concurrency.
## Quick Start
### Prerequisites
- Bun 1.0+ installed (https://bun.sh/)
- Node.js 18+ (for some dev tools)
- Cloudflare account (for deployment)
### Installation
1. Clone the repository:
   ```
   git clone <your-repo-url>
   cd leveragecanvas
   ```
2. Install dependencies using Bun:
   ```
   bun install
   ```
3. (Optional) Generate TypeScript types from Wrangler:
   ```
   bun run cf-typegen
   ```
The project is now set up for local development.
## Usage
### Local Development
Start the development server:
```
bun run dev
```
The app will be available at `http://localhost:3000` (or the port specified in your environment). The worker API endpoints are automatically proxied for seamless testing.
- Access the main editor at `/` (HomePage rewritten as the single-page drawing canvas).
- Test API endpoints (e.g., `/api/drawings`) using tools like curl or the browser's network tab.
- Hot reloading is enabled for frontend changes; worker changes require a restart.
### Example Usage
- **Creating a Drawing**: On load, click "Start Drawing" to initialize a new canvas. Select tools from the left toolbar (hover for tooltips).
- **Drawing Shapes**: Choose Rectangle (R) or Pen (P), then drag on the SVG canvas. Release to commit the element.
- **Editing**: Switch to Select (V), click an element to show handles for transform. Use the right inspector to adjust properties.
- **Saving**: Changes autosave every 2 seconds; manual save via toolbar. Load via the Drawing List drawer.
- **Exporting**: Click Export > PNG/SVG to download the current canvas.
- **API Interaction** (from code):
  ```typescript
  import { api } from '@/lib/api-client';
  import type { Drawing } from '@shared/types';
  // List drawings
  const { items } = await api<{ items: Drawing[]; next?: string }>('/api/drawings');
  // Create new drawing
  const newDrawing = await api<Drawing>('/api/drawings', {
    method: 'POST',
    body: JSON.stringify({ title: 'My Sketch', elements: [] }),
  });
  // Patch updates
  await api<Drawing>('/api/drawings/my-id/patch', {
    method: 'POST',
    body: JSON.stringify({ elements: updatedElements, updatedAt: Date.now() }),
  });
  ```
Refer to `shared/types.ts` for data models and `worker/user-routes.ts` for endpoint implementations.
### Development Workflow
- **Frontend**: Edit files in `src/`; use `bun run lint` for code quality.
- **Backend**: Add routes in `worker/user-routes.ts`; extend entities in `worker/entities.ts`. Do not modify `worker/core-utils.ts` or `worker/index.ts`.
- **Shared Types**: Update `shared/types.ts` for API contracts; sync with frontend and worker.
- **Testing**: Use browser dev tools for UI; Postman/Insomnia for APIs. Seed data via `shared/mock-data.ts`.
- **State Management**: Use Zustand for local drawing state; follow primitive selector patterns to avoid re-render loops.
- **UI Polish**: Leverage shadcn/ui components; ensure responsive design with Tailwind breakpoints.
## Deployment
Deploy to Cloudflare Workers for production:
1. Ensure your Cloudflare account is set up with Wrangler:
   ```
   bunx wrangler login
   bunx wrangler whoami
   ```
2. Build the project:
   ```
   bun run build
   ```
3. Deploy:
   ```
   bun run deploy
   ```
The deployment includes the frontend assets (via Vite) and the Worker. Access your app at the provided Workers URL.
For one-click deployment:
[![Deploy to Cloudflare]([cloudflarebutton])]([cloudflarebutton])
### Environment Configuration
- No additional env vars needed for basic setup (uses single GlobalDurableObject binding).
- For custom domains: Use Wrangler to configure routes in `wrangler.jsonc` (do not modify bindings).
- Monitoring: Enable via Cloudflare dashboard; logs available in Wrangler.
## Contributing
Contributions are welcome! Please:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.
Follow the code style (ESLint + Prettier) and ensure no breaking changes to core utilities.
## License
MIT License. See [LICENSE](LICENSE) for details.