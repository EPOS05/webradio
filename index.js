const express = require('express');
const http = require('http');
const https = require('https');

const app = express();

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to stream MP3 file
function streamMP3File(url, res, callback) {
    const protocol = url.startsWith('https://') ? https : http;
    const request = protocol.get(url, (response) => {
        response.pipe(res, { end: false });
        response.on('end', () => {
            callback();
        });
    }).on('error', (error) => {
        console.error('Error streaming file:', error);
        res.end(); // End the response stream on error
    });

    // Remove event listener when response stream ends or on error
    const onClose = () => {
        res.removeListener('close', onClose);
        request.abort();
    };

    res.on('close', onClose);
    request.on('close', onClose);
}

// Route to play MP3 files
app.get('/play', (req, res) => {
    const jsonUrl = req.query.json;

    if (jsonUrl) {
        // Fetch MP3 files from JSON URL
        const protocol = jsonUrl.startsWith('https://') ? https : http;
        protocol.get(jsonUrl, (response) => {
            if (response.statusCode !== 200) {
                console.error('Error fetching JSON:', response.statusCode);
                res.status(response.statusCode).send('Error fetching JSON');
                return;
            }

            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const mp3Files = json.mp3_files;
                    if (!mp3Files || !Array.isArray(mp3Files) || mp3Files.length === 0) {
                        res.status(400).send('Invalid JSON format or no MP3 files available.');
                        return;
                    }
                    // Start streaming the first song in the list
                    res.status(200).set({
                        'Content-Type': 'audio/mpeg',
                        'Connection': 'keep-alive',
                        'Transfer-Encoding': 'chunked'
                    });
                    streamMP3File(mp3Files[0], res, () => {
                        // After the first song finishes, shuffle the remaining songs in the list and start streaming from the shuffled list
                        const shuffledFiles = shuffleArray(mp3Files.slice(1)); // Exclude the first song
                        shuffledFiles.forEach((url, index) => {
                            setTimeout(() => {
                                streamMP3File(url, res, () => {
                                    if (index === shuffledFiles.length - 1) {
                                        // End response stream after playing the last song in the shuffled list
                                        res.end();
                                    }
                                });
                            }, index * 1000); // Delay each song by 1 second to avoid simultaneous streaming
                        });
                    });
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
        res.status(400).send('No JSON URL provided.');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
