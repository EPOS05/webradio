// Route to start playing MP3 files on a new channel
app.get('/start', async (req, res) => {
    const jsonUrl = req.query.json;
    if (!jsonUrl) {
        res.status(400).send('JSON URL not provided.');
        return;
    }

    try {
        // Fetch JSON file
        const response = await fetch(jsonUrl);
        if (!response.ok) {
            res.status(response.status).send('Failed to fetch JSON.');
            return;
        }
        const json = await response.json();
        
        // Check if JSON contains valid MP3 files
        const mp3Files = json.mp3_files;
        if (!mp3Files || !Array.isArray(mp3Files) || mp3Files.length === 0) {
            res.status(400).send('Invalid JSON format or no MP3 files available.');
            return;
        }

        // Check if MP3 files are playable
        for (const mp3Url of mp3Files) {
            const protocol = mp3Url.startsWith('https://') ? https : http;
            const response = await protocol.head(mp3Url);
            if (response.statusCode !== 200 || !response.headers['content-type'].startsWith('audio/')) {
                res.status(400).send('Invalid MP3 file format or URL.');
                return;
            }
        }

        // Fetch and store MP3 files from JSON URL
        await fetchAndStoreMP3Files(jsonUrl);

        // Generate a unique ID for the channel
        const channelId = uuidv4();

        // Start streaming MP3 files on the new channel
        streamMP3Files(channelId, res);

        // Construct the URL for the user
        const baseUrl = req.protocol + '://' + req.get('host');
        const channelUrl = `${baseUrl}/channel/${channelId}`;

        // Send the channel URL to the user
        res.status(200).send(`Channel URL: ${channelUrl}`);
    } catch (error) {
        console.error('Error starting channel:', error);
        res.status(500).send('Internal Server Error');
    }
});
