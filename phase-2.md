# Phase 2: Reference Images & Session Management - Implementation Steps

## Overview
Building on Phase 1's core functionality, Phase 2 focuses on reference image upload with Replicate API integration, comprehensive session management, and enhanced user experience.

## Replicate API Test Results
**Successful test upload response:**
```json
{
  "id": "NWZmNDA0NGMtNThkMS00YTFmLWFjZjctNzY1ZGJiODdjYzc2",
  "name": "test-reference.jpg",
  "content_type": "image/jpeg", 
  "size": 227406,
  "checksums": {
    "sha256": "a04beca87889cf1ccc95af0d4680a6b43f75253c0f1f7fe519f3705dcbede397",
    "md5": "530c4aab5768ef11aa8b16374e95c8a6"
  },
  "metadata": {"purpose": "reference_image", "original_batch_id": "test_batch"},
  "created_at": "2025-09-06T04:04:16.162Z",
  "expires_at": "2025-09-07T04:04:16.162Z",
  "urls": {"get": "https://api.replicate.com/v1/files/NWZmNDA0NGMtNThkMS00YTFmLWFjZjctNzY1ZGJiODdjYzc2"}
}
```

**Key Findings:**
- ✅ **File URL format**: `https://api.replicate.com/v1/files/{file_id}`
- ✅ **Checksums provided**: SHA-256 and MD5 for deduplication
- ✅ **Custom metadata support**: JSON metadata stored successfully
- ⚠️ **24-hour expiration**: Files auto-delete after 24 hours
- 💡 **Storage strategy**: Store file_id and construct URL as needed

---

## Step 1: Reference Image Upload & Reuse Architecture
**Goal**: Implement efficient reference image handling with Replicate API integration

### 1.1 Database Schema Updates
```sql
-- Internal reference image tracking (user's uploaded files)
CREATE TABLE reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,              -- Our local filename
    original_name TEXT,                  -- User's original filename
    file_hash_sha256 TEXT UNIQUE,        -- SHA-256 hash for deduplication
    content_type TEXT,                   -- image/jpeg, image/png, etc.
    file_size INTEGER,                   -- File size in bytes
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Replicate upload tracking (expires every 24hrs)
CREATE TABLE uploaded_reference_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_image_id INTEGER REFERENCES reference_images(id),
    replicate_file_id TEXT NOT NULL,     -- ID from Replicate response
    replicate_expires_at DATETIME,       -- When Replicate file expires (24hrs)
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    replicate_metadata TEXT              -- JSON metadata from Replicate
);

-- Update batch_reference_images to reference our internal table
ALTER TABLE batch_reference_images ADD COLUMN reference_image_id INTEGER REFERENCES reference_images(id);

-- Indexes for performance
CREATE INDEX idx_reference_images_hash ON reference_images(file_hash_sha256);
CREATE INDEX idx_uploaded_ref_expires ON uploaded_reference_images(replicate_expires_at);
```

### 1.2 Reference Image Service
- **File deduplication**: SHA-256 hash-based detection to avoid duplicate storage
- **Replicate upload API**: POST to `/v1/files` with proper error handling
- **URL construction**: Build URLs from stored file_id: `https://api.replicate.com/v1/files/{file_id}`
- **Expiration handling**: Re-upload to Replicate only when reusing expired files
- **Internal persistence**: Keep all reference images permanently in local storage

### 1.3 Batch Processing Updates
- **Pre-upload phase**: Check for existing internal reference images by hash
- **Replicate validation**: Check if valid Replicate upload exists for reused images
- **Silent re-upload**: Re-upload expired files to Replicate transparently during batch creation
- **URL substitution**: Use fresh Replicate URLs in prediction requests
- **Batch tracking**: Store reference to internal reference_image_id

### 1.4 File Persistence Strategy
- **Permanent storage**: Never delete reference images from local storage
- **Silent re-upload**: Re-upload to Replicate only when needed for batch processing
- **No user notifications**: Handle expiration/re-upload transparently
- **Simple reuse**: Previous batches always available for reference image reuse

**Deliverable**: Simple, transparent reference image system

---

## Step 2: Reference Image Frontend Components
**Goal**: Simple file upload component with batch reuse functionality

### 2.1 Image Upload Component (Mobile-Optimized)
- **File picker button**: Native mobile file selection with multiple files
- **File validation**: Type, size, format checking
- **Preview thumbnails**: Show selected images with remove functionality
- **Upload progress**: Simple progress indicators during upload
- **Upload states**: Basic loading/success/error states

### 2.2 Batch History Integration
- **Batch selection**: User clicks on previous batch in history
- **Load reference images**: Populate file upload form with previous reference images
- **Silent processing**: Handle any necessary Replicate re-upload transparently
- **Form integration**: Reference images appear in upload component like new uploads

**Deliverable**: Simple upload component with batch reuse

---

## Step 3: Enhanced Session History Screen
**Goal**: Build comprehensive session management and browsing interface

### 3.1 Sessions List View
- **Responsive grid layout**: Session cards with thumbnails from recent batches
- **Session statistics**: Total batches, success rate, last activity
- **Sort and filter options**: By date, activity, batch count, success rate
- **Search functionality**: Search session names only

### 3.2 Session Detail View
- **Batch timeline**: Chronological view of all batches in session
- **Expandable batch cards**:
  - Full prompt text with syntax highlighting
  - Generated images grid with modal integration
  - Batch metadata (timing, status, error messages)
  - "Use this batch" button to load settings and reference images into form
- **Batch actions**: Retry, delete individual batches

### 3.3 Session Management Actions
- **CRUD operations**: Create, rename, delete sessions
- **Session cloning**: Duplicate sessions with all batch settings
- **Export functionality**: JSON export with all session data

**Deliverable**: Professional session management interface

---

## Step 4: Image Gallery Screen
**Goal**: Create comprehensive image browsing and management interface

### 4.1 Gallery Layout & Performance
- **Virtual scrolling**: Handle thousands of images with smooth performance
- **Responsive masonry layout**: Optimal use of screen space across devices  
- **Lazy loading**: Intersection observer-based loading with placeholder images
- **Infinite scroll**: Seamless pagination with performance optimization
- **Loading states**: Skeleton screens and smooth transitions

### 4.2 Basic Filtering & Search
- **Search**: Prompt text, session names, date ranges
- **Filters**: Image dimensions, generation success/failure, session
- **Quick filters**: Recent, successful batches, failed generations

**Deliverable**: Clean image gallery with basic management

---

## Step 5: Mobile Experience Enhancement
**Goal**: Optimize entire app for mobile devices with reference image support

### 5.1 Mobile-First File Upload
- **Touch-optimized file picker**: Native mobile file selection with multiple files
- **Camera integration**: Direct photo capture with compression
- **Gesture controls**: Swipe to remove images from upload list
- **Thumb-friendly interface**: Large touch targets (44px minimum)
- **Progress optimization**: Background uploads with network awareness

### 5.2 Mobile Navigation & UI
- **Bottom navigation**: Thumb-friendly tab bar
- **Swipe gestures**: Navigate between images and batches
- **Pull-to-refresh**: Standard mobile patterns for all list views
- **Bottom sheet modals**: Native mobile modal patterns
- **Safe area handling**: Proper layout for notched devices

### 5.3 Performance & Offline Features
- **Smart preloading**: Intelligent prefetching based on user behavior
- **Offline browsing**: View cached images without network
- **Background sync**: Upload/download when network returns
- **Storage management**: Automatic cleanup of old cached content
- **Network awareness**: Adapt image quality based on connection

**Deliverable**: Native-quality mobile experience

---

## Step 6: Advanced Features & Production Readiness
**Goal**: Add professional features and production-grade reliability

### 6.1 Analytics & Insights
- **Cost tracking**: Monitor Replicate API usage costs

### 6.3 Data Management & Reliability
- **Error recovery**: Robust handling of network failures and API limits


**Deliverable**: Production-ready platform with enterprise-grade reliability

---

## Reference Image Architecture Implementation Details

### Upload & Deduplication Flow
1. **File Selection**: User selects reference images in frontend
2. **Client-side hashing**: Calculate SHA-256 hash of each file
3. **Duplicate check**: Query database for existing hashes
4. **Upload new files**: Send unique files to Replicate `/v1/files` endpoint
5. **Store metadata**: Save Replicate response (id, checksums, expiration) locally
6. **Batch creation**: Use Replicate URLs (`https://api.replicate.com/v1/files/{id}`) in predictions

### Reuse & Expiration Handling Flow
1. **Load batch history**: Display reference images with expiration status
2. **User selection**: Click "Reuse these reference images"
3. **Expiration check**: Validate if Replicate files are still valid (< 20hrs old)
4. **Auto-refresh expired**: Re-upload expired files transparently to user
5. **Form population**: Add valid/refreshed reference image URLs to generation form
6. **Status feedback**: Show user which images were refreshed with success/failure indicators

### Data Storage Strategy
```javascript
// Example database records after Replicate upload
uploaded_reference_images: {
  id: 1,
  filename: "1757130133_17b775c8-56244661.jpg",
  replicate_file_id: "NWZmNDA0NGMtNThkMS00YTFmLWFjZjctNzY1ZGJiODdjYzc2", 
  replicate_expires_at: "2025-09-07T04:04:16.162Z",
  file_hash_sha256: "a04beca87889cf1ccc95af0d4680a6b43f75253c0f1f7fe519f3705dcbede397",
  usage_count: 3
}

// Helper function to construct Replicate URL
function getReplicateURL(fileId) {
  return `https://api.replicate.com/v1/files/${fileId}`;
}
```

### Expiration Management
- **Grace period**: Re-upload files older than 20 hours (4-hour safety buffer)
- **Background refresh**: Scheduled job to refresh frequently used reference images
- **User notifications**: Alert when reference images need attention
- **Fallback handling**: Graceful degradation when reference images unavailable

---

## Phase 2 Success Criteria

### Reference Image System ✅
- [ ] Users can upload reference images with mobile file picker
- [ ] SHA-256 hash-based deduplication prevents redundant storage
- [ ] Previous batch reference images reload into forms seamlessly
- [ ] Expired Replicate files re-upload transparently during batch creation
- [ ] Reference images only visible in upload form (implementation detail elsewhere)
- [ ] System handles Replicate API errors and rate limits gracefully

### Session & Gallery Management
- [ ] Session history shows comprehensive batch management
- [ ] Image gallery enables efficient browsing of generated images
- [ ] Search and filtering work on sessions, prompts, and generated images
- [ ] Batch reuse loads previous settings and reference images into form
- [ ] Mobile experience provides full functionality

### Production Features
- [ ] Performance remains smooth with large datasets (1000+ images)
- [ ] 24-hour expiration cycle handled silently without user awareness
- [ ] Error states provide helpful guidance and recovery options
- [ ] Export/import maintains all data relationships
- [ ] Security measures protect all user data
- [ ] Monitoring tracks system health and API usage

---

## Ready to Start Phase 2?

With the successful Replicate API test, we now have a proven architecture for:
- **Simple Reference Image System** - Upload once, reuse transparently
- **Silent Expiration Handling** - Automatic re-upload when needed
- **Professional Session Management** - Full history and batch reuse
- **Clean Image Gallery** - Focus on generated images and browsing
- **Mobile-First Experience** - Native file picker and touch interactions
- **Production-Ready Reliability** - Robust API handling behind the scenes

Let me know which step you'd like to tackle first!