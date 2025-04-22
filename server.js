require('dotenv').config();
const express = require('express');
const path = require('path');
const { Runware } = require('@runware/sdk-js');
const ngrok = require('ngrok');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Runware SDK
const runware = new Runware({ 
    apiKey: process.env.RUNWARE_API_KEY 
});

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get available models
app.get('/api/models', async (req, res) => {
    try {
        // You can return a list of models that your frontend can use
        res.json({
            models: [
                { id: "runware:100@1", name: "Default Model" },
                // Add more models as needed
            ]
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

// Get generation history (you'll need to implement storage)
app.get('/api/history', async (req, res) => {
    try {
        // Implement history retrieval
        res.json({ history: [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Update generation parameters
app.post('/api/generate-image', async (req, res) => {
    try {
        const { 
            prompt, 
            width = 512, 
            height = 512,
            model = "runware:100@1",
            negativePrompt = "",
            numberResults = 1,
            steps = 20
        } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        await runware.ensureConnection();

        const images = await runware.requestImages({
            positivePrompt: prompt,
            negativePrompt,
            width,
            height,
            model,
            numberResults,
            steps,
            outputType: "URL"
        });

        res.json({ data: images });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: 'Image generation failed: ' + error.message });
    }
});

// Delete generated image
app.delete('/api/images/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;
        // Implement image deletion logic
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

const PORT = process.env.PORT || 3000;

// Initialize ngrok configuration before starting the server
const startServer = async () => {
    try {
        // Kill any existing ngrok processes
        await ngrok.kill();

        // Start the Express server
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        // Configure and start ngrok tunnel
        const url = await ngrok.connect({
            addr: PORT,
            authtoken: process.env.NGROK_AUTHTOKEN,
            onStatusChange: status => {
                console.log(`Ngrok Status: ${status}`);
            }
        });
        console.log(`Ngrok tunnel created at: ${url}`);

        // Handle process termination
        process.on('SIGTERM', async () => {
            console.log('Shutting down server...');
            await ngrok.kill();
            server.close();
        });
    } catch (err) {
        console.error('Ngrok tunnel creation failed:', err);
        if (err.code === 'ECONNREFUSED') {
            console.log('Make sure no other ngrok instances are running');
        }
        console.log('Server continues to run locally without ngrok tunnel');
    }
};

// Start the server and ngrok tunnel
startServer();