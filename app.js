async function callProxy(endpoint, method = 'GET', body = null) {
    const response = await fetch('/api/spotify-proxy', {
        method: 'POST',
        body: JSON.stringify({ endpoint, method, body })
    });
    return await response.json();
}

// --- SEARCH ---
const searchInput = document.getElementById('search-input');
searchInput.addEventListener('input', async (e) => {
    if (e.target.value.length < 3) return;
    const data = await callProxy(`/v1/search?q=${encodeURIComponent(e.target.value)}&type=track&limit=5`);
    if (data.tracks) displayResults(data.tracks.items);
});

// --- ADD TO QUEUE ---
async function addToQueue(uri, songName) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="status-box loading">Adding ${songName}...</div>`;
    
    await callProxy(`/v1/me/player/queue?uri=${encodeURIComponent(uri)}`, 'POST');
    
    resultsDiv.innerHTML = `<div class="status-box success">Success! ${songName} is next.</div>`;
    setTimeout(() => { resultsDiv.innerHTML = ""; updateQueue(); }, 4000);
}

// --- UPDATE QUEUE ---
async function updateQueue() {
    const data = await callProxy('/v1/me/player/queue');
    if (data && data.queue) {
        document.getElementById('queue-list').innerHTML = data.queue.slice(0, 5)
            .map(t => `<li>${t.name} - ${t.artists[0].name}</li>`).join('');
    }
}

updateQueue();
setInterval(updateQueue, 30000);
