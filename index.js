const express = require('express');
const fs = require('fs');
const https = require('https');
const { Readable } = require('stream');

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
                    resolve(json);
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

// Function to stream MP3 files and metadata
function streamMP3AndMetadata(mp3Files, res) {
    const stream = new Readable({
        read() {}
    });

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const filePath = mp3Files[currentIndex].file;
        const streamFile = fs.createReadStream(filePath);

        // Send ICY headers with metadata
        const metadata = mp3Files[currentIndex];
        res.write(`icy-name: ${metadata.title} - ${metadata.artist}\n`);
        res.write(`icy-genre: ${metadata.genre}\n`);
        // Add more metadata fields as needed

        streamFile.on('error', (error) => {
            console.error('Error streaming file:', error);
        });
        streamFile.on('end', playNext);
        streamFile.pipe(res, { end: false });
        currentIndex++;
    };

    playNext();
}

// Route to play MP3 files and metadata
app.get('/play', (req, res) => {
    const jsonUrl = req.query.json;

    if (jsonUrl) {
        // Fetch MP3 files and metadata from JSON URL
        fetchMP3FilesJSON(jsonUrl)
            .then(mp3Files => {
                if (mp3Files.length === 0) {
                    return res.status(400).send('No MP3 files available.');
                }
                // Stream MP3 files and metadata
                streamMP3AndMetadata(mp3Files, res);
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
