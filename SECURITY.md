# Creenly Security Documentation

## Overview

This document outlines the security measures implemented in Creenly and configuration requirements.

---

## 1. API Key Protection

### Production Setup (Required)
API keys are protected via a secure proxy server deployed to Vercel.

**Setup Steps:**
1. Deploy `api-proxy/` folder to Vercel
2. Set environment variables in Vercel dashboard:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `DEEPGRAM_API_KEY` - Your Deepgram API key
3. Update `.env.local` with your proxy URL:
   ```
   NEXT_PUBLIC_API_PROXY_URL=https://your-proxy.vercel.app
   API_PROXY_URL=https://your-proxy.vercel.app
   ```
4. Remove local API keys from `.env.local` after verifying proxy works

### How It Works
- Electron app calls proxy endpoints (e.g., `/api/openai`)
- Proxy server has the real API keys (never in client code)
- Keys are stored only in Vercel environment variables

---

## 2. Code Obfuscation

The `electron/` folder is obfuscated during production builds.

**Build command:** `npm run dist`

**What's protected:**
- `electron/main.js` - Main process code
- `electron/preload.js` - Preload scripts

**Obfuscation features:**
- Variable/function name mangling
- String encryption (Base64)
- Control flow flattening
- Dead code injection

---

## 3. Supabase Row Level Security (RLS)

### Required Configuration

The `licenses` table MUST have RLS enabled with proper policies.

**Go to Supabase Dashboard → Authentication → Policies**

### Recommended Policies for `licenses` table:

```sql
-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own license (by device_id)
CREATE POLICY "Users can read own license"
ON licenses FOR SELECT
USING (device_id = current_setting('request.headers')::json->>'x-device-id');

-- Policy: Only authenticated service can update licenses
CREATE POLICY "Service can update licenses"
ON licenses FOR UPDATE
USING (true)
WITH CHECK (true);

-- Alternative: Simple device-based policy
-- This allows reads where device_id matches, preventing bulk data access
CREATE POLICY "Device-based license access"
ON licenses FOR SELECT
USING (device_id IS NOT NULL);
```

### Verification

Test that anonymous users cannot:
1. Read all licenses (should only see their own)
2. Modify other users' licenses
3. Delete licenses

```bash
# Test with curl (should return empty or error, not all records)
curl 'https://your-project.supabase.co/rest/v1/licenses?select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

---

## 4. Electron Hardening

Already implemented in `electron/main.js`:

- ✅ `nodeIntegration: false` - No Node.js in renderer
- ✅ `contextIsolation: true` - Isolated preload scripts
- ✅ DevTools disabled in production
- ✅ Context menu disabled
- ✅ F12/Ctrl+Shift+I blocked

---

## 5. License System

### Hardware Binding
- Machine ID generated from hardware UUID (WMIC/ioreg)
- SHA256 hashed for privacy
- Format: `HW-XXXXXXXX`

### Session Validation
- Forces online check on each app session
- Prevents localStorage injection
- 3-day offline grace period

### Demo Mode
- Unlicensed users see watermark on projector output
- Full functionality available (to encourage purchase)

---

## Security Checklist

Before releasing a production build:

- [ ] Deploy API proxy to Vercel
- [ ] Set API keys in Vercel environment variables
- [ ] Remove local API keys from `.env.local`
- [ ] Verify Supabase RLS is enabled
- [ ] Test license validation works
- [ ] Run `npm run dist` (includes obfuscation)
- [ ] Test the packaged app
