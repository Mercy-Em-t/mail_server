# Data & User Flow Specifications

This document maps out the specific pathways data takes across the system and outlines the behavioral flows of the two primary actors in the application: **Public Visitors** and **System Administrators**. 

These flow diagrams and step-by-step lifecycles represent the ground-truth logic extracted from the legacy Node.js monolith.

---

## 1. User Flows

### 1.1 Public Visitor Flow (Storefront)
1. **Page Load**: The visitor navigates to the public URL.
2. **Initialization**: The frontend parses the URL for `user_id` and `lang` parameters.
3. **Data Fetching**: The browser fires an asynchronous `GET` request to `/api/data`.
   - *Fallback*: If `user_id` is missing or the database lookup fails, the server falls back to returning the default `data.json` template.
4. **DOM Injection**: Vanilla JavaScript receives the `published` matrix and dynamically injects the text, images, and arrays into their respective HTML ID nodes.
5. **Form Interaction**: The visitor scrolls to the dynamically rendered form section and fills out the inputs.
6. **Submission**: Upon clicking submit, a `POST` request is sent to `/api/submit-form/[formId]` containing the input payload.
7. **Resolution**: A UI "Toast" notification slides up, confirming the submission, and the form resets.

### 1.2 System Administrator Flow (CMS Dashboard)
1. **Authentication Gate**: The admin attempts to load `admin.html`.
2. **Verification Check**: The script immediately issues a `GET /api/verify-session`.
   - If it fails (401/403), the user is aggressively redirected to `login.html`.
   - If successful, the hidden `#main-admin` container is set to `display: block`.
3. **Draft Loading**: The dashboard issues a `GET /api/admin-data` to retrieve the `draft` state of the matrix.
4. **Editing Phase**: The admin edits text, drags-and-drops project cards (via `Sortable.js`), or modifies rich text via `Quill.js`.
5. **Asset Uploading**: 
   - The admin clicks the file input.
   - A `FormData` object containing the file is sent via `POST` to `/api/upload-image`.
   - The Cloudinary URL is returned and instantly injected into the image preview.
6. **Background Auto-Save**: Every 30 seconds, a background engine serializes the DOM state into JSON. If it detects changes from the last snapshot, it silently `POST`s to `/api/save-data` under `draft` mode.
7. **Publication**: The admin clicks "Publish Live", triggering a manual sync to the `published` matrix state, instantly pushing changes to the storefront.

---

## 2. Core Data Flows

### 2.1 The Lead Capture & Notification Pipeline
When a visitor submits a dynamic form, the following precise data chain is executed:
1. **Request Payload**: Client sends a JSON key-value pair payload representing the dynamic form inputs.
2. **Database Lookup**: Server queries the `cms_data` table in Supabase via the `user_id`.
3. **Matrix Mutation**: The backend locates both the `draft` and `published` matrices for the specific language, and pushes the payload object (with an injected `id` and `timestamp`) into both respective `responses[formId]` arrays.
4. **Database Commit**: The server executes an `upsert` against the `cms_data` table to safely persist the mutated JSON document.
5. **Email Dispatch**: An asynchronous sub-routine compiles the payload into an HTML email template and utilizes `nodemailer` to dispatch it via the configured `SMTP_USER` environment variables.
6. **Audit Trail**: The `logActivity()` utility fires, performing an `fs.appendFile` operation to securely log `FORM_SUBMISSION` and `EMAIL_NOTIFICATION_SENT` locally inside `logs.txt`.

### 2.2 Telemetry & Polling Streams
The dashboard maintains live connections to system metrics without websockets via simple polling:
1. **HUD Vitals Polling**: Every 5 seconds, a `setInterval` loop hits `GET /api/system/health`. The Node server utilizes the native `os` module to read `os.totalmem()`, `os.freemem()`, `os.loadavg()`, and `os.uptime()`, formatting them and returning a JSON telemetry block.
2. **Media Vault Syncing**: Upon loading the admin panel (or immediately after a successful upload/deletion), the client hits `GET /api/media`. The backend issues a server-to-server request to the Cloudinary API, querying `folder:nexus_cms_uploads`, sorting by `created_at desc`, and returning a flattened array of URLs for the UI grid.

### 2.3 The "Soft Delete" Media Pipeline
To prevent catastrophic accidental deletions, media removal follows a soft-delete flow:
1. Admin clicks the trash icon on a media thumbnail.
2. Client sends a `POST` to `/api/delete-media` containing the asset's URL.
3. The server extracts the `public_id` from the URL.
4. The server calls `cloudinary.uploader.rename()`, moving the asset from `nexus_cms_uploads/` to a hidden `nexus_cms_trash/` directory.
5. The `SOFT_DELETE_MEDIA` event is recorded in the `logs.txt` audit trail.
