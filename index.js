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
                    resolve(mp3Files);
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
function streamMP3Files(mp3Files, res, jsonUrl) {
    const currentIndex = { index: 0 };

    const playNext = () => {
        if (currentIndex.index >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex.index = 0;
        }

        const mp3Data = mp3Files[currentIndex.index];
        const mp3FilePath = mp3Data.file_path;
        const mp3Url = url.resolve(jsonUrl, mp3FilePath);
        const coverArtPath = mp3Data.cover_art_path;

        // Create ICY metadata
        const metadata = `StreamTitle='${mp3Data.title} - ${mp3Data.artist} - ${mp3Data.album} - ${mp3Data.year}';`;

        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'icy-name': 'Your Radio Name',
            'icy-genre': 'Your Radio Genre',
            'icy-metadata': '1', // Enable ICY metadata
            'icy-metaint': '16000', // Send metadata every 16KB
        });

        // Stream MP3 file
        const mp3Stream = https.get(mp3Url, (response) => {
            response.pipe(res, { end: false });

            response.on('end', () => {
                currentIndex.index++;
                playNext();
            });
        });

        mp3Stream.on('error', (error) => {
            console.error('Error streaming file:', error);
            currentIndex.index++;
            playNext();
        });

        // Send metadata
        mp3Stream.on('data', (chunk) => {
            res.write(chunk);
            res.write(metadata); // Send metadata with each chunk
        });

        // Add cover art if available
        if (coverArtPath) {
            const coverArtStream = fs.createReadStream(coverArtPath);
            coverArtStream.pipe(res, { end: false });

            coverArtStream.on('end', () => {
                res.write(metadata); // Send metadata after cover art
            });
        }
    };

    playNext();
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const jsonUrl = req.query.json;

    if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        fetchMP3FilesJSON(jsonUrl)
            .then(mp3Files => {
                if (mp3Files.length === 0) {
                    return res.status(400).send('No MP3 files available.');
                }
                // Stream MP3 files with metadata
                streamMP3Files(mp3Files, res, jsonUrl);
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
