const express = require('express');
const https = require('https');
const fs = require('fs');
const { Readable } = require('stream');

const app = express();

// Function to stream MP3 files
function streamMP3Files(mp3Files, res) {
    const stream = new Readable({
        read() {}
    });

    let currentIndex = 0;

    const playNext = () => {
        if (currentIndex >= mp3Files.length) {
            // Loop back to the first audio file
            currentIndex = 0;
        }

        const filePath = mp3Files[currentIndex];
        
        // If the file path is a URL, stream it directly
        https.get(filePath, (response) => {
            response.pipe(res, { end: false });
            response.on('end', () => {
                currentIndex++;
                playNext();
            });
        }).on('error', (error) => {
            console.error('Error streaming file:', error);
        });
    };

    playNext();
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
        https.get(mp3Url, (response) => {
            response.pipe(res);
        }).on('error', (error) => {
            console.error('Error fetching MP3:', error);
            res.status(500).send('Internal Server Error');
        });
    } else if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        https.get(jsonUrl, (response) => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const mp3Files = json.mp3_files;
                    if (mp3Files.length === 0) {
                        return res.status(400).send('No MP3 files available.');
                    }
                    // Stream MP3 files
                    streamMP3Files(mp3Files, res);
                } catch (error) {
                    console.error('Error parsing JSON:', error);
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
