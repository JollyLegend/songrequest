exports.handler = async (event) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

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
        
        // If this fails, we want to know EXACTLY what Spotify said
        if (!tokenData.access_token) {
            return { 
                statusCode: 401, 
                body: JSON.stringify({ 
                    error: "Spotify rejected the keys", 
                    details: tokenData 
                }) 
            };
        }

        const { endpoint, method, body } = JSON.parse(event.body);

        const spotifyResponse = await fetch(`https://api.spotify.com${endpoint}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
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
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
