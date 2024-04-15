const express = require('express');
const http = require('http');
const https = require('https');
const { Readable } = require('stream');

const app = express();
const channels = {}; // Object to store active channels

// Function to fetch MP3 files from JSON and start streaming
async function startChannel(jsonUrl) {
    try {
        const response = await fetch(jsonUrl);
        const json = await response.json();
        const mp3Files = json.mp3_files;

        // Create a readable stream to send MP3 files
        const mp3Stream = new Readable();
        mp3Stream._read = () => {}; // Required for Readable stream
        mp3Files.forEach(mp3File => {
            // Fetch each MP3 file and push it to the stream
            const protocol = mp3File.startsWith('https://') ? https : http;
            protocol.get(mp3File, response => {
                response.on('data', chunk => {
                    mp3Stream.push(chunk);
                });
            });
        });

        // Add the channel to the channels object
        const channelId = Math.random().toString(36).substring(7); // Generate random channel ID
        channels[channelId] = mp3Stream;

        // Log channel creation
        console.log(`Channel ${channelId} created for JSON: ${jsonUrl}`);

        return channelId;
    } catch (error) {
        console.error('Error starting channel:', error);
        throw new Error('Error starting channel');
    }
}

// Start a new channel
app.get('/start', async (req, res) => {
    const jsonUrl = req.query.json;
    if (!jsonUrl) {
        res.status(400).send('JSON URL not provided');
        return;
    }

    try {
        const channelId = await startChannel(jsonUrl);
        res.send(`Channel started. Channel ID: ${channelId}`);
    } catch (error) {
        res.status(500).send('Error starting channel');
    }
});

// Play an existing channel
app.get('/play', (req, res) => {
    const channelId = req.query.id;
    const channel = channels[channelId];
    if (!channel) {
        res.status(404).send('Channel not found');
        return;
    }

    // Send the MP3 stream to the client
    channel.pipe(res);
});

// Stop and delete an existing channel
app.get('/stop', (req, res) => {
    const channelId = req.query.id;
    const channel = channels[channelId];
    if (!channel) {
        res.status(404).send('Channel not found');
        return;
    }

    // Close the stream and remove the channel
    channel.destroy();
    delete channels[channelId];

    // Log channel deletion
    console.log(`Channel ${channelId} stopped and deleted`);

    res.send(`Channel ${channelId} stopped and deleted`);
});

// List all existing channels
app.get('/playing', (req, res) => {
    const channelIds = Object.keys(channels);
    res.json(channelIds);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
