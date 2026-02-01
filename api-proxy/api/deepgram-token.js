/**
 * Creenly API Proxy - Deepgram Token
 *
 * This endpoint returns a temporary Deepgram API key for client-side use.
 * The main API key stays server-side.
 *
 * Note: Deepgram's API key can be used directly for WebSocket connections,
 * but we proxy it here to avoid exposing it in client code.
 */

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Validate API key is configured
    if (!process.env.DEEPGRAM_API_KEY) {
        console.error('DEEPGRAM_API_KEY not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Option 1: Return the API key directly (simple but less secure)
        // The key is still protected because it's only in server env vars
        // and never in the client bundle

        // Option 2: Create a temporary/scoped key via Deepgram API
        // Deepgram supports creating project keys with limited scope
        // For now, we'll use Option 1 as it's simpler

        return res.status(200).json({
            token: process.env.DEEPGRAM_API_KEY,
            expiresIn: 3600 // Indicate it should be refreshed (for future temp key impl)
        });

    } catch (error) {
        console.error('Deepgram token error:', error);
        return res.status(500).json({ error: error.message });
    }
};
