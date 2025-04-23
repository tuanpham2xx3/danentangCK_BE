require('dotenv').config();
const express = require('express');
const path = require('path');
const { Runware } = require('@runware/sdk-js');
const ngrok = require('ngrok');
const cors = require('cors');
const app = express();
const admin = require('firebase-admin');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
admin.initializeApp({
    credential: admin.credential.cert(require('./firebase-service-account.json'))
  });
//Get valid Runware instance
async function getValidRunwareInstance() {
  const { Runware } = require('@runware/sdk-js');
  const MAX_KEYS = 11;

  for (let i = 1; i <= MAX_KEYS; i++) {
    const key = process.env[`API_KEY_${i}`];
    if (!key) continue;

    const runware = new Runware({ apiKey: key });

    try {
      await runware.ensureConnection();
      console.log(`✅ Dùng API Key hợp lệ: API_KEY_${i}`);
      return runware;
    } catch (err) {
      console.warn(`❌ API_KEY_${i} không hợp lệ: ${err.message}`);
    }
  }

  throw new Error('Không có API key nào hợp lệ trong danh sách.');
}

// Khởi tạo Runware instance
let runware;
(async () => {
  runware = await getValidRunwareInstance();
})();
// Middleware xác thực Firebase
const authenticateFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
  
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }
  
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("❌ Firebase token verification failed:", error.message);
      return res.status(403).json({ error: "Invalid or expired token" });
    }
  };

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
// Update generation parameters
app.post('/api/generate-image', authenticateFirebaseToken, async (req, res) => {

    // check SDK ok
    if (!runware) {
        return res.status(503).json({ error: 'Runware SDK chưa sẵn sàng. Vui lòng thử lại sau.' });
    }
    // Lấy thông tin người dùng từ Firebase
    try {
      const userId = req.user.uid;
      const userEmail = req.user.email;
  
      const {
        prompt,
        width = 512,
        height = 512,
        model = "runware:100@1",
        negativePrompt = "",
        numberResults = 1,
        steps = 20
      } = req.body;
  
      // Kiểm tra dữ liệu đầu vào
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
  
      console.log(`🧠 [${userEmail}] yêu cầu tạo ảnh với prompt: "${prompt}"`);
  
      // Đảm bảo kết nối với Runware
      await runware.ensureConnection();
  
      // Gửi yêu cầu tạo ảnh
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
  
      // TODO: Bạn có thể lưu ảnh với uid vào Firebase Realtime DB hoặc Firestore ở đây nếu muốn
  
      res.json({
        uid: userId,
        email: userEmail,
        data: images
      });
    } catch (error) {
      console.error('❌ Lỗi khi tạo ảnh:', error);
      res.status(500).json({ error: 'Image generation failed: ' + error.message });
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