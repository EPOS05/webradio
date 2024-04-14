const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Readable } = require('stream');

const app = express();

// Initialize an empty set to keep track of played files
const playedFiles = new Set();

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to stream MP3 files
function streamMP3Files(mp3Files, res) {
    let shuffledFiles = shuffleArray([...mp3Files]); // Shuffle the array of files initially
    const fileQueue = [...shuffledFiles]; // Initialize the file queue with shuffled files

    const playNext = () => {
        if (fileQueue.length === 0) {
            // All files have been played once, reshuffle the list
            shuffledFiles = shuffleArray([...mp3Files]);
            fileQueue.push(...shuffledFiles.filter(file => !playedFiles.has(file)));
            playedFiles.clear(); // Clear the played files set
        }

        // Pop the first file from the queue
        const filePath = fileQueue.shift();

        // Mark the file as played
        playedFiles.add(filePath);

        // Stream the file
        const protocol = filePath.startsWith('https://') ? https : http;
        protocol.get(filePath, (response) => {
            response.pipe(res, { end: false });
            response.on('end', () => {
                playNext(); // Play the next file
            });
        }).on('error', (error) => {
            console.error('Error streaming file:', error);
        });
    };

    playNext(); // Start playing files
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const mp3Url = req.query.mp3;
    const jsonUrl = req.query.json;

    if (mp3Url) {
        // Stream MP3 file directly
        res.status(200).set({
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked'
        });
        const protocol = mp3Url.startsWith('https://') ? https : http;
        protocol.get(mp3Url, (response) => {
            response.pipe(res);
        }).on('error', (error) => {
            console.error('Error fetching MP3:', error);
            res.status(500).send('Internal Server Error');
        });
    } else if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        const protocol = jsonUrl.startsWith('https://') ? https : http;
        protocol.get(jsonUrl, (response) => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const mp3Files = json.mp3_files;
                    if (!mp3Files || !Array.isArray(mp3Files) || mp3Files.length === 0) {
                        return res.status(400).send('Invalid JSON format or no MP3 files available.');
                    }
                    // Stream MP3 files
                    streamMP3Files(mp3Files, res);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    console.log('JSON Response:', data);
                    res.status(500).send('Internal Server Error');
                }
            });
        }).on('error', (error) => {
            console.error('Error fetching JSON:', error);
            res.status(500).send('Internal Server Error');
        });
    } else {
        res.status(400).send('Neither MP3 URL nor JSON URL provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
