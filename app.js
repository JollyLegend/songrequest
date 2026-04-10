const clientId = '6b1f99f8b96d443ebda9cbd3a234b699';
const permanentRefreshToken = "AQBfB8oQJDzX8Sj9jQqX7LsWAKBfY_9LDmYUNAoCeZoenXJeaOskKvKmrJcmcIhtUdcF7aVI1_XI2u__6yyHXrLMFrllVyExB1gAlasr3ztFzPAaEhvNoUjzGiQHTaAAdgE";

// This function gets a fresh "Temporary Token" using your "Permanent Key"
async function getAccessToken() {
    const url = "https://accounts.spotify.com/api/token";
    const payload = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: permanentRefreshToken,
        client_id: clientId,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
    });

    const data = await response.json();
    if (data.access_token) {
        return data.access_token;
    } else {
        console.error("Auth Error:", data);
        return null;
    }
}

// Helper to talk to Spotify
async function fetchWebApi(endpoint, method, body = null) {
    const token = await getAccessToken();
    const options = {
        method: method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`https://api.spotify.com/${endpoint}`, options);
    if (res.status === 204) return null; // Success with no content
    return await res.json();
}

// --- SEARCH ---
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', async (e) => {
    if (e.target.value.length < 3) return;
    const data = await fetchWebApi(`v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`, 'GET');
    if (data.tracks) displayResults(data.tracks.items);
});

function displayResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = tracks.map(track => `
        <div class="song-card" onclick="addToQueue('${track.uri}')">
            <img src="${track.album.images[2].url}" width="40">
            <div class="song-info">
                <span class="song-title">${track.name}</span>
                <span class="song-artist">${track.artists[0].name}</span>
            </div>
        </div>
    `).join('');
}

// --- ADD TO QUEUE ---
async function addToQueue(uri) {
    // Note: The Queue API requires the URI as a query parameter
    await fetchWebApi(`v1/me/player/queue?uri=${uri}`, 'POST');
    document.getElementById('results').innerHTML = "<div style='color:#1DB954; padding: 20px;'>✅ Song Requested!</div>";
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
        console.log("Queue view failed. Is Spotify playing?");
    }
}

// Initial Load
updateQueue();
setInterval(updateQueue, 30000);
