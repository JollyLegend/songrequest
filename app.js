// --- PROXY CONNECTION ---
async function callProxy(endpoint, method = 'GET', body = null) {
    const response = await fetch('/.netlify/functions/spotify-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, method, body })
    });
    return await response.json();
}

// --- SEARCH LOGIC ---
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 3) return;

        // We send the search request to our proxy
        const data = await callProxy(`/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, 'GET');
        
        if (data && data.tracks && data.tracks.items) {
            displayResults(data.tracks.items);
        }
    });
}

function displayResults(tracks) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = tracks.map(track => {
        const safeName = track.name.replace(/'/g, "\\'");
        return `
            <div class="song-card" onclick="addToQueue('${track.uri}', '${safeName}')">
                <img src="${track.album.images[2].url}" width="40" alt="art" style="border-radius:4px;">
                <div class="song-info">
                    <span class="song-title">${track.name}</span>
                    <span class="song-artist">${track.artists[0].name}</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- QUEUE LOGIC ---
async function addToQueue(uri, songName) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="status-box loading">Adding ${songName}... 📡</div>`;
    
    try {
        // Send the "Add to Queue" command to our proxy
        await callProxy(`/v1/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
        resultsDiv.innerHTML = `<div class="status-box success">Success! ${songName} is next. 🎧</div>`;
    } catch (err) {
        resultsDiv.innerHTML = `<div class="status-box loading">❌ Make sure music is playing!</div>`;
    }

    if (searchInput) searchInput.value = "";
    setTimeout(() => {
        resultsDiv.innerHTML = "";
        updateQueue();
    }, 4000);
}

async function updateQueue() {
    const data = await callProxy('/v1/me/player/queue', 'GET');
    const list = document.getElementById('queue-list');
    if (data && data.queue) {
        list.innerHTML = data.queue.slice(0, 5).map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
    } else {
        list.innerHTML = "<li>No music playing.</li>";
    }
}

// Initial load
updateQueue();
setInterval(updateQueue, 30000);
