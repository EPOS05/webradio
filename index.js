const express = require('express');
const fs = require('fs');
const https = require('https');
const { Readable } = require('stream');
const mm = require('music-metadata');

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

// Function to stream MP3 files with metadata
async function streamMP3FileWithMetadata(mp3Url, res) {
    // Fetch metadata from MP3 URL
    const metadata = await mm.parseUrl(mp3Url);

    // Set headers for metadata
    res.set({
        'Content-Type': 'audio/mpeg',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'Title': metadata.common.title || '',
        'Artist': metadata.common.artist || '',
        'Album': metadata.common.album || ''
    });

    // If there's album art, stream it as well
    if (metadata.common.picture && metadata.common.picture.length > 0) {
        res.set('Album-Art', Buffer.from(metadata.common.picture[0].data).toString('base64'));
    }

    // Stream the MP3 file
    https.get(mp3Url, (response) => {
        response.pipe(res);
    }).on('error', (error) => {
        console.error('Error fetching MP3:', error);
        res.status(500).send('Internal Server Error');
    });
}

// Function to stream MP3 files from JSON with metadata
async function streamMP3FilesFromJSON(jsonUrl, res) {
    // Fetch MP3 files from JSON URL
    fetchMP3FilesJSON(jsonUrl)
        .then(async (mp3Files) => {
            if (mp3Files.length === 0) {
                return res.status(400).send('No MP3 files available.');
            }
            // Stream each MP3 file with metadata
            for (const mp3File of mp3Files) {
                await streamMP3FileWithMetadata(mp3File, res);
            }
        })
        .catch(error => {
            console.error('Error fetching MP3 files:', error);
            res.status(500).send('Internal Server Error');
        });
}

// Route to play MP3 files with metadata
app.get('/play', (req, res) => {
    const mp3Url = req.query.mp3;
    const jsonUrl = req.query.json;

    if (mp3Url) {
        // Stream MP3 file with metadata
        streamMP3FileWithMetadata(mp3Url, res);
    } else if (jsonUrl) {
        // Stream MP3 files from JSON with metadata
        streamMP3FilesFromJSON(jsonUrl, res);
    } else {
        res.status(400).send('Neither MP3 URL nor JSON URL provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
