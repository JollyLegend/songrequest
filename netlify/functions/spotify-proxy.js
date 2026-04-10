// We no longer need require('node-fetch') because Node 22 has it built-in!

exports.handler = async (event) => {
    // 1. Secure Credentials from Netlify Environment Variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

    // 2. Get a fresh Access Token from Spotify
    const authOptions = {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    };

    try {
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', authOptions);
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            return { statusCode: 500, body: JSON.stringify({ error: "Failed to get access token" }) };
        }

        // 3. Handle the request from your website
        const { endpoint, method, body } = JSON.parse(event.body);

        const spotifyResponse = await fetch(`https://api.spotify.com${endpoint}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : null
        });

        const result = spotifyResponse.status === 204 ? { success: true } : await spotifyResponse.json();

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
