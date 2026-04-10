const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const clientSecret = '1ccfd8f5d6a44e3da62892c7daf2ed32'; // Added Secret
const permanentRefreshToken = "AQBfB8oQJDzX8Sj9jQqX7LsWAKBfY_9LDmYUNAoCeZoenXJeaOskKvKmrJcmcIhtUdcF7aVI1_XI2u__6yyHXrLMFrllVyExB1gAlasr3ztFzPAaEhvNoUjzGiQHTaAAdgE";

async function getAccessToken() {
    const url = "https://accounts.spotify.com/api/token";
    
    // Combining ID and Secret for a "Master" request
    const payload = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: permanentRefreshToken,
        client_id: clientId,
        client_secret: clientSecret
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload
        });

        const data = await response.json();
        if (data.access_token) {
            return data.access_token;
        } else {
            console.error("Auth failed:", data);
            return null;
        }
    } catch (e) {
        console.error("Connection error:", e);
        return null;
    }
}

async function fetchWebApi(endpoint, method, body = null) {
    const token = await getAccessToken();
    if (!token) return;

    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        method,
        body: body ? JSON.stringify(body) : null
    });

    if (res.status === 204) return null;
    return await res.json();
}

// --- SEARCH ---
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', async (e) => {
    if (e.target.value.length < 3) return;
    const data = await fetchWebApi(`v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`, 'GET');
    if (data && data.tracks) displayResults(data.tracks.items);
});

function displayResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = tracks.map(track => `
        <div class="song-card" onclick="addToQueue('${track.uri}')">
            <img src="${track.album.images[2].url}" width="40" style="border-radius:4px;">
            <div class="song-info">
                <span class="song-title">${track.name}</span>
                <span class="song-artist">${track.artists[0].name}</span>
            </div>
        </div>
    `).join('');
}

// --- ADD TO QUEUE ---
async function addToQueue(uri) {
    await fetchWebApi(`v1/me/player/queue?uri=${uri}`, 'POST');
    document.getElementById('results').innerHTML = "<div style='color:#1DB954; padding: 20px; font-weight:bold;'>✅ Requested! Check your car screen.</div>";
    searchInput.value = "";
    setTimeout(updateQueue, 2000);
}

// --- SHOW QUEUE ---
async function updateQueue() {
    try {
        const data = await fetchWebApi('v1/me/player/queue', 'GET');
        if (data && data.queue) {
            const list = document.getElementById('queue-list');
            list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
        }
    } catch (e) {
        document.getElementById('queue-list').innerHTML = "<li>Connect Spotify to see queue</li>";
    }
}

// Initialize
updateQueue();
setInterval(updateQueue, 30000);
