const express = require('express');
const https = require('https');
const { Readable } = require('stream');
const url = require('url');
const fs = require('fs');

const app = express();

// Function to fetch MP3 files JSON
function fetchMP3FilesJSON(jsonFileUrl) {
    return new Promise((resolve, reject) => {
        https.get(jsonFileUrl, (response) => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const mp3Files = json.mp3_files;
                    resolve({ mp3Files, metadata: json.metadata || [] });
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    reject(error);
                }
            });
        }).on('error', (error) => {
            console.error('Error fetching JSON:', error);
            reject(error);
        });
    });
}

// Function to stream MP3 files
function streamMP3Files(mp3Files, res, jsonUrl, metadata) {
    const stream = new Readable({
        read() {}
    });

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const mp3FilePath = mp3Files[currentIndex];
        const mp3Url = url.resolve(jsonUrl, mp3FilePath);

        // Read metadata for the current MP3 file
        const currentMetadata = metadata[currentIndex] || {};
        const { title = '', artist = '', album = '', year = '', cover_art_path = '' } = currentMetadata;

        // Create ICY metadata
        const icyMetadata = `StreamTitle='${title} - ${artist} - ${album} - ${year}';`;

        // Pipe ICY metadata to the response
        res.write('HTTP/1.1 200 OK\r\n');
        res.write('Content-Type: audio/mpeg\r\n');
        res.write(`icy-metaint: ${icyMetadata.length}\r\n`);
        res.write('\r\n');

        // Stream MP3 file
        const mp3Stream = fs.createReadStream(mp3FilePath);
        mp3Stream.pipe(res, { end: false });

        // Handle cover art if available
        if (cover_art_path) {
            const coverArtStream = fs.createReadStream(cover_art_path);
            coverArtStream.pipe(res, { end: false });
        }

        // Move to the next MP3 file
        currentIndex++;

        // When MP3 file stream ends, play the next one
        mp3Stream.on('end', () => {
            playNext();
        });
    };

    playNext();
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const jsonUrl = req.query.json;

    if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        fetchMP3FilesJSON(jsonUrl)
            .then(({ mp3Files, metadata }) => {
                if (mp3Files.length === 0) {
                    return res.status(400).send('No MP3 files available.');
                }
                // Stream MP3 files
                streamMP3Files(mp3Files, res, jsonUrl, metadata);
            })
            .catch(error => {
                console.error('Error fetching MP3 files:', error);
                res.status(500).send('Internal Server Error');
            });
    } else {
        res.status(400).send('JSON URL not provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
