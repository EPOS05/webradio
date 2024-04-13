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
async function streamMP3FilesWithMetadata(mp3Files, res) {
    let currentIndex = 0;

    const playNext = async () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const filePath = mp3Files[currentIndex];

        // Read metadata from MP3 file
        const metadata = await mm.parseFile(filePath);
        const { common } = metadata;
        const { title, artist, album, picture } = common;

        // Set headers for metadata
        res.set({
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Transfer-Encoding': 'chunked',
            'Title': title || '',
            'Artist': artist || '',
            'Album': album || ''
        });

        // If there's album art, stream it as well
        if (picture && picture.length > 0) {
            res.set('Album-Art', Buffer.from(picture[0].data).toString('base64'));
        }

        // Stream the MP3 file
        const streamFile = fs.createReadStream(filePath);
        streamFile.on('error', (error) => {
            console.error('Error streaming file:', error);
        });
        streamFile.on('end', playNext);
        streamFile.pipe(res, { end: false });
        currentIndex++;
    };

    playNext();
}

// Route to play MP3 files with metadata
app.get('/play', (req, res) => {
    const mp3Url = req.query.mp3;
    const jsonUrl = req.query.json;

    if (mp3Url) {
        // Stream MP3 file directly
        res.status(200).send('Direct MP3 streaming is not supported with metadata.');
    } else if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        fetchMP3FilesJSON(jsonUrl)
            .then(mp3Files => {
                if (mp3Files.length === 0) {
                    return res.status(400).send('No MP3 files available.');
                }
                // Stream MP3 files with metadata
                streamMP3FilesWithMetadata(mp3Files, res);
            })
            .catch(error => {
                console.error('Error fetching MP3 files:', error);
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
