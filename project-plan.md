# AI Image Generation App - Project Plan

## Overview
A mobile-first React app for generating images using Google's Nano Banana model via Replicate API, with support for parallel generation, project organization, and comprehensive image browsing.

## Terminology & Core Concepts

### Better Names
- **Project** → **Session** (a focused creative session)
- **Run** → **Batch** (a single generation request with multiple outputs)
- **Number of Generations** → **Batch Size** or **Output Count**

### Data Hierarchy
```
Session
├── Multiple Batches
    ├── Multiple Images
```

## Data Models

### Database Schema (SQLite)

```sql
-- Sessions: Groups related generation batches
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batches: Individual generation requests
CREATE TABLE batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id),
    prompt TEXT NOT NULL,
    batch_size INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT
);

-- Reference images used in generation
CREATE TABLE batch_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER REFERENCES batches(id),
    filename TEXT NOT NULL,
    original_name TEXT
);

-- Generated images
CREATE TABLE generated_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER REFERENCES batches(id),
    filename TEXT NOT NULL,
    preview_filename TEXT, -- for optimization
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    replicate_id TEXT, -- for tracking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Core Generation API
```typescript
POST /api/sessions/:sessionId/batches
Body: {
  prompt: string;
  batchSize: number;
  referenceImages: File[];
}
Response: { batchId: string; status: 'pending' }

GET /api/batches/:batchId/status
Response: { 
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images?: Array<{ id: string; url: string; previewUrl: string }>;
  error?: string;
}
```

### Session Management
```typescript
POST /api/sessions
Body: { name: string }
Response: { sessionId: string }

GET /api/sessions
Response: Array<{ id: string; name: string; createdAt: string; batchCount: number }>

GET /api/sessions/:sessionId
Response: { 
  session: { id: string; name: string; createdAt: string };
  batches: Array<BatchWithImages>;
}
```

### Image Gallery
```typescript
GET /api/images
Query: { offset?: number; limit?: number }
Response: { 
  images: Array<{ 
    id: string; 
    url: string; 
    previewUrl: string;
    sessionName: string;
    batchId: string;
    prompt: string;
  }>;
  hasMore: boolean;
}

GET /api/images/:imageId/download
Response: Image file with proper headers
```

### File Management
```typescript
POST /api/upload/reference
Body: FormData with images
Response: { files: Array<{ id: string; filename: string }> }

GET /api/images/:filename
Response: Image file (full resolution)

GET /api/images/preview/:filename
Response: Optimized preview image
```

## Frontend Architecture

### Tech Stack
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** components (when beneficial)
- **React Router** for navigation
- **React Query/TanStack Query** for state management and caching
- **Zustand** for local state (current session, UI state)

### Screen Structure

#### 1. Home Screen (`/`)
**Purpose**: Quick image generation interface

**Components**:
- Session selector/creator (dropdown + "New Session" button)
- Prompt input (textarea, mobile-optimized)
- Reference image upload (drag/drop + file picker)
- Batch size selector (slider: 1-8 images)
- Generate button (shows progress when active)
- Recent batches preview (last 2-3 batches from current session)

**State Management**:
```typescript
interface HomeState {
  currentSession: Session | null;
  prompt: string;
  referenceImages: File[];
  batchSize: number;
  isGenerating: boolean;
  activeBatches: BatchStatus[];
}
```

#### 2. Session History (`/sessions`)
**Purpose**: Browse all sessions and their batches

**Components**:
- Session list (grouped by date)
- Batch cards showing:
  - Prompt (truncated)
  - Thumbnail grid of generated images
  - Generation timestamp
  - Status indicator
- Pull-to-refresh
- Infinite scroll for older sessions

#### 3. Image Gallery (`/gallery`)
**Purpose**: Browse all images in infinite scroll

**Components**:
- Masonry/grid layout (responsive)
- Image cards with:
  - Preview image (lazy loaded)
  - Session name badge
  - Prompt overlay (on hover/tap)
- Search/filter bar
- Infinite scroll with virtualization

#### 4. Image Modal (Overlay)
**Purpose**: Full-size image viewing and actions

**Components**:
- Full-screen image viewer
- Image metadata (session, prompt, dimensions)
- Action buttons:
  - Download
  - Jump to session/batch
  - Share (if supported)
- Swipe navigation (when opened from gallery/batch)

### Mobile-First Considerations

#### Touch Interactions
- Swipe gestures for image navigation
- Pull-to-refresh on lists
- Touch-friendly button sizes (44px minimum)
- Haptic feedback for actions

#### Performance
- Image lazy loading with intersection observer
- Virtual scrolling for large lists
- Optimistic updates for better perceived performance
- Offline capability for viewing cached images

#### Layout
- Bottom navigation for main screens
- Sticky generate button on home
- Collapsible sections for better space usage
- Safe area handling for notched devices

## Backend Architecture

### Tech Stack
- **Bun** runtime
- **Hono** web framework
- **SQLite** database (better-sqlite3)
- **Sharp** for image processing
- **Replicate SDK** for AI generation

### File Structure
```
backend/
├── src/
│   ├── index.ts              # App entry point
│   ├── routes/
│   │   ├── sessions.ts
│   │   ├── batches.ts
│   │   ├── images.ts
│   │   └── upload.ts
│   ├── services/
│   │   ├── database.ts       # SQLite operations
│   │   ├── replicate.ts      # AI generation
│   │   └── images.ts         # File processing
│   ├── middleware/
│   │   ├── cors.ts
│   │   ├── error.ts
│   │   └── fileUpload.ts
│   └── types/
│       └── index.ts          # Shared TypeScript types
├── uploads/                  # Reference images
├── generated/               # Generated images
│   ├── full/               # Full resolution
│   └── previews/           # Optimized previews
└── database.sqlite
```

### Image Processing Pipeline

#### Reference Images
1. Upload validation (format, size limits)
2. Store original with UUID filename
3. Optional: Create thumbnail for UI preview

#### Generated Images
1. Receive from Replicate webhook/polling
2. Download full resolution image
3. Generate optimized preview (max 800px, WebP format)
4. Store metadata in database
5. Clean up temporary files

### Generation Flow
```typescript
async function generateImages(batch: BatchRequest) {
  // 1. Create batch record
  const batchId = await db.createBatch(batch);
  
  // 2. Upload reference images to temp storage
  const referenceUrls = await uploadReferenceImages(batch.referenceImages);
  
  // 3. Submit to Replicate
  const prediction = await replicate.run("google/nano-banana", {
    input: {
      prompt: batch.prompt,
      num_outputs: batch.batchSize,
      reference_images: referenceUrls
    }
  });
  
  // 4. Poll for completion or use webhook
  await pollForCompletion(batchId, prediction.id);
  
  // 5. Process and store results
  await processGeneratedImages(batchId, prediction.output);
}
```

## Use Case Flows

### 1. Quick Generation Flow
```
User opens app
→ Selects/creates session
→ Enters prompt
→ Optionally uploads reference images
→ Sets batch size
→ Taps generate
→ Views real-time progress
→ Images appear in grid as they complete
→ Taps image to view full size
→ Downloads or shares image
```

### 2. Session Management Flow
```
User wants to organize work
→ Goes to sessions screen
→ Creates new session with meaningful name
→ Performs multiple generations within session
→ Views session history to see related batches
→ Jumps between different sessions as needed
```

### 3. Browse All Images Flow
```
User wants to find old generation
→ Goes to gallery screen
→ Scrolls through all images
→ Uses search/filter to narrow down
→ Finds image and taps to view
→ From modal, jumps to original session/batch
→ Downloads or performs other actions
```

### 4. Progressive Enhancement Flow
```
User on slow connection
→ App loads preview images first
→ Full resolution loads in background
→ Smooth upgrade when viewing full size
→ Offline viewing of cached images
```

## Technical Considerations

### Performance Optimization
- **Image Loading**: Lazy loading with intersection observer
- **Preview Generation**: WebP format, max 800px width
- **Caching**: Aggressive caching of previews, on-demand full images
- **Virtual Scrolling**: For large image lists
- **Background Processing**: Queue system for image processing

### Error Handling
- **Network Failures**: Retry logic with exponential backoff
- **Generation Failures**: Clear error messages, ability to retry
- **Storage Issues**: Graceful degradation, cleanup procedures
- **Rate Limiting**: Queue management for API calls

### Security & Validation
- **File Upload**: Type checking, size limits, sanitization
- **Input Validation**: Prompt length limits, XSS prevention
- **Rate Limiting**: Prevent API abuse
- **CORS**: Proper configuration for frontend

### Scalability Considerations
- **Database**: Indexed queries, pagination
- **File Storage**: Organized directory structure
- **Memory Usage**: Streaming for large files
- **Concurrent Processing**: Queue system for generations

## Development Phases

### Phase 1: Core Functionality
- [ ] Basic backend API structure
- [ ] Database setup and migrations
- [ ] Replicate integration
- [ ] Home screen with generation
- [ ] Image display and modal

### Phase 2: Session Management
- [ ] Session CRUD operations
- [ ] Session history screen
- [ ] Batch organization
- [ ] Navigation between screens

### Phase 3: Gallery & Polish
- [ ] Image gallery with infinite scroll
- [ ] Search and filtering
- [ ] Preview image generation
- [ ] Performance optimizations

### Phase 4: Enhancement
- [ ] Offline capabilities
- [ ] Advanced image actions
- [ ] Export/sharing features
- [ ] Analytics and monitoring

This plan provides a solid foundation for building a professional, scalable image generation app with excellent mobile experience and performance.