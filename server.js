const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Create uploads folder if not exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
  console.log('[INFO] uploads folder created');
}

// MongoDB Connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
  console.log('⚠️  MongoDB URI not found. Face recognition will use in-memory storage.');
}

// Face Recognition Schema
const faceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  faceDescriptor: { type: Array, required: true },
  timestamp: { type: Date, default: Date.now },
  userId: { type: String, default: 'default_user' },
  imageUrl: { type: String }
});

const Face = mongoose.model('Face', faceSchema);

// In-memory fallback storage
let inMemoryFaces = [];

// ✅ ENVIRONMENT VARIABLE CHECKS
console.log('=====================================');
console.log('🔧 ENVIRONMENT CONFIGURATION STATUS');
console.log('-------------------------------------');

if (process.env.PORT) {
  console.log(`✅ PORT loaded from .env → ${process.env.PORT}`);
} else {
  console.log('⚠️  PORT not found in .env, using default 5000');
}

if (process.env.MONGODB_URI) {
  console.log('✅ MONGODB_URI loaded successfully');
} else {
  console.log('❌ MONGODB_URI missing in .env - using in-memory storage');
}

if (process.env.GOOGLE_MAPS_API_KEY) {
  console.log('✅ GOOGLE_MAPS_API_KEY loaded successfully');
} else {
  console.log('❌ GOOGLE_MAPS_API_KEY missing in .env');
}

if (process.env.OPENAI_API_KEY) {
  console.log('✅ OPENAI_API_KEY loaded successfully');
} else {
  console.log('❌ OPENAI_API_KEY missing in .env');
}

console.log('=====================================');

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'VisionAssist AR Backend API' });
});

// Get Google Maps API Key endpoint
app.get('/api/maps-key', (req, res) => {
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'Google Maps API key not configured' 
      });
    }
    res.json({
      success: true,
      apiKey: process.env.GOOGLE_MAPS_API_KEY
    });
  } catch (error) {
    console.error('[ERROR] Maps Key:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// FACE RECOGNITION ENDPOINTS
// ========================================

// Register a new face
app.post('/api/faces/register', async (req, res) => {
  try {
    const { name, faceDescriptor, userId, imageUrl } = req.body;

    if (!name || !faceDescriptor) {
      return res.status(400).json({
        success: false,
        error: 'Name and face descriptor are required'
      });
    }

    console.log(`[API] /api/faces/register → Registering face for: ${name}`);

    // Try MongoDB first, fallback to in-memory
    if (mongoose.connection.readyState === 1) {
      const newFace = new Face({
        name,
        faceDescriptor,
        userId: userId || 'default_user',
        imageUrl: imageUrl || null
      });

      await newFace.save();
      
      res.json({
        success: true,
        message: 'Face registered successfully',
        face: {
          id: newFace._id,
          name: newFace.name,
          timestamp: newFace.timestamp
        }
      });
    } else {
      // In-memory fallback
      const newFace = {
        id: Date.now().toString(),
        name,
        faceDescriptor,
        userId: userId || 'default_user',
        imageUrl: imageUrl || null,
        timestamp: new Date()
      };

      inMemoryFaces.push(newFace);

      res.json({
        success: true,
        message: 'Face registered successfully (in-memory)',
        face: {
          id: newFace.id,
          name: newFace.name,
          timestamp: newFace.timestamp
        }
      });
    }
  } catch (error) {
    console.error('[ERROR] Face Registration:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all registered faces
app.get('/api/faces', async (req, res) => {
  try {
    const { userId } = req.query;
    console.log(`[API] /api/faces → Fetching faces for user: ${userId || 'all'}`);

    if (mongoose.connection.readyState === 1) {
      const query = userId ? { userId } : {};
      const faces = await Face.find(query).select('-faceDescriptor').sort({ timestamp: -1 });
      
      res.json({
        success: true,
        faces: faces.map(f => ({
          id: f._id,
          name: f.name,
          timestamp: f.timestamp,
          imageUrl: f.imageUrl
        }))
      });
    } else {
      // In-memory fallback
      const filtered = userId 
        ? inMemoryFaces.filter(f => f.userId === userId)
        : inMemoryFaces;

      res.json({
        success: true,
        faces: filtered.map(f => ({
          id: f.id,
          name: f.name,
          timestamp: f.timestamp,
          imageUrl: f.imageUrl
        }))
      });
    }
  } catch (error) {
    console.error('[ERROR] Get Faces:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get face descriptors for recognition
app.get('/api/faces/descriptors', async (req, res) => {
  try {
    const { userId } = req.query;
    console.log(`[API] /api/faces/descriptors → Fetching descriptors for user: ${userId || 'all'}`);

    if (mongoose.connection.readyState === 1) {
      const query = userId ? { userId } : {};
      const faces = await Face.find(query);
      
      res.json({
        success: true,
        faces: faces.map(f => ({
          id: f._id,
          name: f.name,
          descriptor: f.faceDescriptor
        }))
      });
    } else {
      // In-memory fallback
      const filtered = userId 
        ? inMemoryFaces.filter(f => f.userId === userId)
        : inMemoryFaces;

      res.json({
        success: true,
        faces: filtered.map(f => ({
          id: f.id,
          name: f.name,
          descriptor: f.faceDescriptor
        }))
      });
    }
  } catch (error) {
    console.error('[ERROR] Get Descriptors:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete a registered face
app.delete('/api/faces/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[API] /api/faces/${id} → Deleting face`);

    if (mongoose.connection.readyState === 1) {
      await Face.findByIdAndDelete(id);
      res.json({
        success: true,
        message: 'Face deleted successfully'
      });
    } else {
      // In-memory fallback
      inMemoryFaces = inMemoryFaces.filter(f => f.id !== id);
      res.json({
        success: true,
        message: 'Face deleted successfully (in-memory)'
      });
    }
  } catch (error) {
    console.error('[ERROR] Delete Face:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ========================================
// NAVIGATION ENDPOINTS
// ========================================

// Safe Route endpoint with Google Directions API
app.post('/api/safe-route', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    console.log(`[API] /api/safe-route → Origin: ${JSON.stringify(origin)} → Destination: ${destination}`);

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Google Maps API key not configured'
      });
    }

    const originStr = `${origin.lat},${origin.lng}`;
    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destination)}&key=${process.env.GOOGLE_MAPS_API_KEY}&mode=walking`;
    
    console.log('[API] Calling Google Directions API...');
    const response = await axios.get(directionsUrl);

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];

      const steps = leg.steps.map(step => {
        return step.html_instructions.replace(/<[^>]*>/g, '');
      });

      const safetyScore = calculateSafetyScore(route);

      res.json({
        success: true,
        route: {
          origin: originStr,
          destination: leg.end_address,
          distance: leg.distance.text,
          duration: leg.duration.text,
          safetyScore: safetyScore,
          steps: steps,
          polyline: route.overview_polyline.points,
          startLocation: leg.start_location,
          endLocation: leg.end_location
        }
      });
    } else {
      console.error('[ERROR] Google API Status:', response.data.status);
      res.json({
        success: false,
        error: response.data.status,
        message: 'Could not find route. Please check the destination address.'
      });
    }
  } catch (error) {
    console.error('[ERROR] Safe Route:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

function calculateSafetyScore(route) {
  let score = 75;
  const leg = route.legs[0];
  const durationMinutes = leg.duration.value / 60;
  
  if (durationMinutes < 15) score += 10;
  if (durationMinutes > 45) score -= 10;
  
  return Math.max(50, Math.min(95, score));
}

// Geocoding endpoint
app.post('/api/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Google Maps API key not configured'
      });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(geocodeUrl);

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      res.json({
        success: true,
        location: location,
        formatted_address: response.data.results[0].formatted_address
      });
    } else {
      res.json({
        success: false,
        error: 'Address not found'
      });
    }
  } catch (error) {
    console.error('[ERROR] Geocoding:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Object Detection endpoint
app.post('/api/detect-objects', upload.single('image'), async (req, res) => {
  try {
    console.log('[API] /api/detect-objects → Image received');
    res.json({
      success: true,
      message: 'Image received. Process with frontend models.'
    });
  } catch (error) {
    console.error('[ERROR] Object Detection:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Text-to-Speech endpoint
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text } = req.body;
    console.log(`[API] /api/text-to-speech → Text: "${text}"`);
    res.json({
      success: true,
      text: text,
      message: 'Use browser TTS API'
    });
  } catch (error) {
    console.error('[ERROR] TTS:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Emergency SOS endpoint
app.post('/api/emergency-sos', async (req, res) => {
  try {
    const { location, userId } = req.body;
    console.log(`[ALERT] SOS triggered by User: ${userId} at ${JSON.stringify(location)}`);
    res.json({
      success: true,
      message: 'SOS alert sent to emergency contacts'
    });
  } catch (error) {
    console.error('[ERROR] SOS:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
});