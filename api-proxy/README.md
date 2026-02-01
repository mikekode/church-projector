# Creenly API Proxy

Secure API proxy that keeps sensitive API keys server-side.

## Deployment to Vercel

1. **Install Vercel CLI** (if not already):
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   cd api-proxy
   vercel
   ```

3. **Set Environment Variables** in Vercel Dashboard:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `DEEPGRAM_API_KEY` - Your Deepgram API key

4. **Get your deployment URL** (e.g., `https://creenly-api-proxy.vercel.app`)

5. **Update Creenly app** to use this URL (see main app `.env.local`)

## Endpoints

### POST /api/openai
Proxies smart detection requests to OpenAI.

**Request Body:**
```json
{
  "text": "string",
  "context": "string",
  "pastorHints": "string",
  "currentVerse": "string",
  "chapterContext": "string"
}
```

### GET /api/deepgram-token
Returns a Deepgram API token for client-side speech recognition.

**Response:**
```json
{
  "token": "string",
  "expiresIn": 3600
}
```

## Security

- API keys are stored only in Vercel environment variables
- Never committed to code or included in client bundle
- CORS enabled for cross-origin requests from Electron app
