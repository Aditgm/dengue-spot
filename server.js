require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('./config/passport');
const { cloudinaryStorage, isCloudinaryConfigured } = require('./config/cloudinary');
const connectDB = require('./config/database');
const Hotspot = require('./models/Hotspot');
const Reporter = require('./models/Reporter');
const Checklist = require('./models/Checklist');
const User = require('./models/User');
const ChatMessage = require('./models/ChatMessage');
const { verifyToken } = require('./utils/jwt');
const { optionalAuth, authenticateToken } = require('./middleware/auth');
const { checkBannedIp } = require('./middleware/ipBan');
const redisClient = require('./config/redis');
const keepServerAlive = require('./utils/keepAlive');
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const { router: communityRoutes, ROOMS } = require('./routes/community');

const app = express();
app.set('trust proxy', true);

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Socket.io setup
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.set('io', io);

if (!process.env.ROBOFLOW_API_KEY) {
  console.warn('⚠️  WARNING: ROBOFLOW_API_KEY not set in .env file. Image scanning will fail.');
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://*.tile.openstreetmap.org',
          'https://tile.openstreetmap.org',
          'https://*.tile.openstreetmap.de',
          'https://*.basemaps.cartocdn.com',
          'https://basemaps.cartocdn.com',
          'https://raw.githubusercontent.com',
          'https://cdnjs.cloudflare.com'
        ],
        connectSrc: [
          "'self'",
          'https://*.tile.openstreetmap.org',
          'https://*.basemaps.cartocdn.com',
          'https://api.roboflow.com',
          'https://api.open-meteo.com'
        ]
      }
    }
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static('client/build'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Too many scan requests. Please try again later.'
});

const useCloudinary = isCloudinaryConfigured();

const localStorage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'hotspot-' + uniqueSuffix + ext);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'), false);
  }
};

const upload = multer({
  storage: useCloudinary ? cloudinaryStorage : localStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter
});
const scanUpload = multer({
  storage: localStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter
});

if (useCloudinary) {
  console.log('☁️  Photo uploads: Cloudinary (cloud storage)');
} else {
  console.log('📁 Photo uploads: Local disk (uploads/ folder)');
}

// Seed initial data into MongoDB if collections are empty
async function seedDatabase() {
  try {
    const hotspotCount = await Hotspot.countDocuments();
    if (hotspotCount === 0) {
      await Hotspot.insertMany([
        {
          latitude: 25.5941,
          longitude: 85.1376,
          location: { type: 'Point', coordinates: [85.1376, 25.5941] },
          riskLevel: 'high',
          description: 'Water tank near residential area',
          status: 'reported'
        },
        {
          latitude: 25.5900,
          longitude: 85.1400,
          location: { type: 'Point', coordinates: [85.1400, 25.5900] },
          riskLevel: 'medium',
          description: 'Construction site with stagnant water',
          status: 'reported'
        },
        {
          latitude: 25.5950,
          longitude: 85.1350,
          location: { type: 'Point', coordinates: [85.1350, 25.5950] },
          riskLevel: 'high',
          description: 'Clogged drainage in park area',
          status: 'reported'
        }
      ]);
      console.log('✅ Seeded initial hotspots');
    }

    const reporterCount = await Reporter.countDocuments();
    if (reporterCount === 0) {
      await Reporter.insertMany([
        { name: 'Aditya', reports: 2, verified: true, badge: 'gold' },
        { name: 'Kashav', reports: 2, verified: true, badge: 'gold' },
        { name: 'Rajat', reports: 1, verified: false, badge: 'silver' },
        { name: 'Ayush', reports: 0, verified: false, badge: 'none' },
        { name: 'Krishna', reports: 0, verified: false, badge: 'none' }
      ]);
      console.log('✅ Seeded initial reporters');
    }
  } catch (error) {
    console.error('❌ Seed error:', error.message);
  }
}

const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY || '';
const ROBOFLOW_WORKSPACE = process.env.ROBOFLOW_WORKSPACE || 'your-workspace';
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID || 'mosquito-breeding-grounds';
const ROBOFLOW_VERSION = process.env.ROBOFLOW_VERSION || 1;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DengueSpot API is running', timestamp: new Date().toISOString() });
});

const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY || '';
const WEATHER_CACHE_TTL = 30 * 60 * 1000;
let weatherCache = {};

app.get('/api/weather', apiLimiter, async (req, res) => {
  try {
    const { lat, lon, city } = req.query;
    if (!lat && !lon && !city) {
      return res.status(400).json({ success: false, error: 'Provide lat/lon or city' });
    }

    const cacheKey = city || `${lat},${lon}`;
    if (weatherCache[cacheKey] && (Date.now() - weatherCache[cacheKey].fetchedAt) < WEATHER_CACHE_TTL) {
      return res.json({ success: true, ...weatherCache[cacheKey].data, cached: true });
    }

    if (!OPENWEATHER_KEY) {
      return res.json({
        success: true,
        message: 'No OPENWEATHER_API_KEY set. Frontend uses direct API calls.',
        cached: false
      });
    }

    let url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${OPENWEATHER_KEY}`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`;

    const https = require('https');
    const fetchUrl = (u) => new Promise((resolve, reject) => {
      https.get(u, { headers: { 'User-Agent': 'DengueSpot/1.0' } }, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });

    const data = await fetchUrl(url);
    weatherCache[cacheKey] = { data, fetchedAt: Date.now() };
    res.json({ success: true, ...data, cached: false });
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.status(500).json({ success: false, error: 'Weather fetch failed' });
  }
});

const NEWS_API_KEY = 'ffe12206c8294d12919cc3e7e452d2e2';
const NEWS_CACHE_TTL = 8 * 60 * 60 * 1000;
let newsCache = { data: null, fetchedAt: 0 };

function categorizeArticle(title) {
  const t = (title || '').toLowerCase();
  if (/dengue|mosquito|aedes|vector/.test(t)) return 'dengue';
  if (/health|hospital|doctor|medical|disease|vaccine|treatment|patient|symptom/.test(t)) return 'health';
  if (/prevention|hygiene|sanitation|clean|safety|awareness|precaution/.test(t)) return 'prevention';
  return 'general';
}

async function fetchAndCacheNews() {
  try {
    // Fetch from multiple sources + top-headlines as backup
    const queries = [
      { url: 'https://newsapi.org/v2/everything', params: { q: 'dengue OR mosquito OR aedes', language: 'en', sortBy: 'publishedAt', pageSize: 25 }, cat: 'dengue' },
      { url: 'https://newsapi.org/v2/everything', params: { q: 'health India disease hospital', language: 'en', sortBy: 'publishedAt', pageSize: 25 }, cat: 'health' },
      { url: 'https://newsapi.org/v2/everything', params: { q: 'sanitation prevention hygiene public health', language: 'en', sortBy: 'publishedAt', pageSize: 20 }, cat: 'prevention' },
      { url: 'https://newsapi.org/v2/top-headlines', params: { country: 'in', pageSize: 30 }, cat: 'general' }
    ];

    const results = await Promise.allSettled(
      queries.map(({ url, params, cat }) =>
        axios.get(url, {
          params,
          headers: { 'X-Api-Key': NEWS_API_KEY, 'User-Agent': 'DengueSpot/1.0' },
          timeout: 15000
        }).then(r => ({ articles: r.data.articles || [], cat, total: r.data.totalResults }))
      )
    );

    let rawArticles = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`📡 "${queries[i].cat}": ${r.value.total} total, ${r.value.articles.length} fetched`);
        rawArticles.push(...r.value.articles.map(a => ({ ...a, _cat: r.value.cat })));
      } else {
        console.error(`❌ "${queries[i].cat}" failed:`, r.reason?.response?.data?.message || r.reason?.message);
      }
    });

    // Deduplicate and categorize
    const seen = new Set();
    const articles = rawArticles
      .filter(a => {
        if (!a.title || a.title === '[Removed]' || a.title.length < 15) return false;
        if (a.source?.name === '[Removed]') return false;
        const key = a.title.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(a => ({
        title: a.title,
        source: a.source?.name || 'Unknown',
        publishedAt: a.publishedAt,
        url: a.url,
        category: categorizeArticle(a.title) !== 'general' ? categorizeArticle(a.title) : (a._cat || 'general')
      }));

    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    newsCache = { data: articles, fetchedAt: Date.now() };
    console.log(`✅ News cache refreshed: ${articles.length} articles from top-headlines India`);
    return articles;
  } catch (error) {
    console.error('❌ News fetch error:', error.message);
    return newsCache.data || [];
  }
}

app.get('/api/news', apiLimiter, async (req, res) => {
  try {
    const { category } = req.query;
    if (!newsCache.data || (Date.now() - newsCache.fetchedAt) > NEWS_CACHE_TTL) {
      await fetchAndCacheNews();
    }

    let articles = newsCache.data || [];
    if (category && category !== 'all') {
      articles = articles.filter(a => a.category === category);
    }

    res.json({
      success: true,
      articles,
      count: articles.length,
      cachedAt: new Date(newsCache.fetchedAt).toISOString(),
      categories: ['all', 'dengue', 'health', 'prevention', 'general']
    });
  } catch (error) {
    console.error('News endpoint error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch news' });
  }
});

app.use('/api/auth', checkBannedIp, authRoutes);
app.use('/api/oauth', checkBannedIp, oauthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin', adminRoutes);

app.post('/api/scan', scanLimiter, scanUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));

    if (!ROBOFLOW_API_KEY || ROBOFLOW_API_KEY === '') {
      throw new Error('ROBOFLOW_API_KEY not set - please configure it in .env file');
    }

    const roboflowUrl = `https://detect.roboflow.com/${ROBOFLOW_MODEL_ID}/${ROBOFLOW_VERSION}?api_key=${ROBOFLOW_API_KEY}`;

    const response = await axios.post(roboflowUrl, formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });

    try {
      await fsPromises.unlink(req.file.path);
    } catch (unlinkError) {
      console.warn('Could not delete uploaded file:', unlinkError.message);
    }

    const detections = response.data.predictions || [];
    const risks = detections.map(detection => ({
      object: detection.class,
      confidence: detection.confidence,
      bbox: detection.bbox,
      advice: getAdviceForObject(detection.class)
    }));

    res.json({
      success: true,
      risks: risks,
      count: risks.length,
      message: risks.length > 0
        ? `Found ${risks.length} potential breeding site(s)`
        : 'No breeding sites detected!'
    });
    // Increment scan count for authenticated user
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        const decoded = verifyToken(token);
        if (decoded && decoded.userId) {
          User.findByIdAndUpdate(decoded.userId, { $inc: { scanCount: 1 } }).catch(() => { });
        }
      }
    } catch (_) { /* ignore auth errors for scan counting */ }
  } catch (error) {
    console.error('❌ Scan error:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
    }

    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch (unlinkError) {
        console.warn('Could not delete uploaded file:', unlinkError.message);
      }
    }

    res.status(500).json({
      error: 'Failed to scan image',
      message: error.message,
      mock: true,
      risks: [
        {
          object: 'bucket',
          confidence: 0.85,
          advice: 'Empty and clean this container. Store it upside down when not in use.'
        }
      ]
    });
  }
});

function getAdviceForObject(objectClass) {
  const adviceMap = {
    'bucket': 'Empty and clean this container weekly. Store it upside down when not in use.',
    'tyre': 'Remove old tyres or drill holes to prevent water collection. Dispose properly.',
    'pot': 'Empty plant pot trays weekly. Cover or remove standing water.',
    'tank': 'Cover all water storage tanks with tight-fitting lids. Check weekly for gaps.',
    'bottle': 'Dispose of bottles and cans properly. Do not leave them outside where they can collect water.',
    'gutter': 'Clean gutters regularly to prevent water stagnation. Ensure proper drainage.',
    'puddle': 'Fill or drain stagnant puddles. Improve drainage in this area.',
    'container': 'Empty, clean, and cover all water containers. Check weekly.',
    'default': 'Remove or empty this water-holding item. Prevent water accumulation.'
  };

  return adviceMap[objectClass.toLowerCase()] || adviceMap['default'];
}

app.post('/api/report', apiLimiter, optionalAuth, upload.single('photo'), async (req, res) => {
  try {
    const { latitude, longitude, description, riskLevel, reporterName } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid latitude/longitude range' });
    }

    const validRiskLevels = ['low', 'medium', 'high'];
    const risk = validRiskLevels.includes(riskLevel) ? riskLevel : 'medium';

    let photoUrl = '';
    if (req.file) {
      photoUrl = (useCloudinary && req.file.path) ? req.file.path : `/uploads/${req.file.filename}`;
    }

    // Try to get authenticated user's ID
    let reportedByUserId = req.user ? req.user.userId : null;

    const hotspot = new Hotspot({
      latitude: lat,
      longitude: lon,
      description: (description || '').substring(0, 500),
      photoUrl,
      riskLevel: risk,
      status: 'reported',
      reporterName: reporterName || null,
      reportedBy: reportedByUserId
    });
    await hotspot.save();

    let reporter = null;
    if (reporterName && typeof reporterName === 'string' && reporterName.trim() !== '') {
      const name = reporterName.trim();
      reporter = await Reporter.findOneAndUpdate(
        { name: { $regex: new RegExp(`^${name}$`, 'i') } },
        {
          $inc: { reports: 1 },
          $setOnInsert: { name, verified: false, badge: 'none' },
          $set: reportedByUserId ? { userId: reportedByUserId } : {}
        },
        { upsert: true, returnDocument: 'after' }
      );
      reporter.updateBadge();
      await reporter.save();
    }

    res.status(201).json({
      success: true,
      hotspot,
      reporterSnapshot: reporter || null,
      message: 'Hotspot reported successfully'
    });
  } catch (error) {
    console.error('Report error:', error.message);
    res.status(500).json({ error: 'Failed to report hotspot', message: error.message });
  }
});

app.get('/api/hotspots', apiLimiter, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.riskLevel && ['low', 'medium', 'high'].includes(req.query.riskLevel)) {
      filter.riskLevel = req.query.riskLevel;
    }
    if (req.query.status && ['reported', 'investigating', 'resolved'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    // Proximity: ?lat=25.59&lng=85.13&radius=5 (km)
    if (req.query.lat && req.query.lng && req.query.radius) {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const radiusKm = parseFloat(req.query.radius);

      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm) && radiusKm > 0) {
        filter.location = {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusKm * 1000
          }
        };
      }
    }

    const [hotspots, total] = await Promise.all([
      Hotspot.find(filter, 'latitude longitude riskLevel status description photoUrl createdAt reporterName reportedBy')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Hotspot.countDocuments(filter)
    ]);

    const publicHotspots = hotspots.map(h => ({
      id: h._id,
      latitude: h.latitude,
      longitude: h.longitude,
      riskLevel: h.riskLevel,
      status: h.status,
      description: h.description || '',
      photoUrl: h.photoUrl || '',
      reporterName: h.reporterName || 'Anonymous',
      reportedBy: h.reportedBy ? h.reportedBy.toString() : null,
      reportedAt: h.createdAt
    }));

    res.json({
      success: true,
      hotspots: publicHotspots,
      count: publicHotspots.length,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hotspots', message: error.message });
  }
});

app.patch('/api/hotspots/:id', apiLimiter, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['reported', 'investigating', 'resolved'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const hotspot = await Hotspot.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!hotspot) {
      return res.status(404).json({ error: 'Hotspot not found' });
    }

    res.json({
      success: true,
      hotspot: {
        id: hotspot._id,
        latitude: hotspot.latitude,
        longitude: hotspot.longitude,
        riskLevel: hotspot.riskLevel,
        status: hotspot.status,
        description: hotspot.description,
        photoUrl: hotspot.photoUrl,
        reportedAt: hotspot.createdAt
      },
      message: `Hotspot status updated to "${status}"`
    });
  } catch (error) {
    console.error('Update hotspot error:', error.message);
    res.status(500).json({ error: 'Failed to update hotspot', message: error.message });
  }
});

app.delete('/api/hotspots/:id', apiLimiter, authenticateToken, async (req, res) => {
  try {
    const hotspot = await Hotspot.findById(req.params.id);

    if (!hotspot) {
      return res.status(404).json({ error: 'Hotspot not found' });
    }

    // Check: only admin or original reporter can delete
    const user = await User.findById(req.user.userId);
    const isAdmin = user && user.role === 'admin';
    const isOwner = hotspot.reportedBy && hotspot.reportedBy.toString() === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Only the reporter or an admin can delete this hotspot' });
    }

    await Hotspot.findByIdAndDelete(req.params.id);

    if (hotspot.photoUrl && hotspot.photoUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, hotspot.photoUrl);
      fsPromises.unlink(filePath).catch(() => { });
    }

    res.json({ success: true, message: 'Hotspot deleted successfully' });
  } catch (error) {
    console.error('Delete hotspot error:', error.message);
    res.status(500).json({ error: 'Failed to delete hotspot', message: error.message });
  }
});

app.get('/api/leaderboard', apiLimiter, async (req, res) => {
  try {
    const timeframe = req.query.timeframe || 'allTime';
    const reporters = await Reporter.find()
      .sort({ reports: -1 })
      .lean();

    const totalReports = reporters.reduce((sum, r) => sum + (r.reports || 0), 0);

    res.json({
      success: true,
      timeframe,
      totalReports,
      reporters: reporters.map(r => ({
        id: r._id,
        name: r.name,
        reports: r.reports,
        verified: r.verified,
        badge: r.badge
      })),
      count: reporters.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard', message: error.message });
  }
});

app.get('/api/checklist/:userId', apiLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const week = getCurrentWeek();
    let checklist = await Checklist.findOne({ userId, week }).lean();

    if (!checklist) {
      const defaultItems = getDefaultChecklist()[week];
      checklist = await Checklist.create({ userId, week, items: defaultItems });
    }

    res.json({ success: true, checklist: { [checklist.week]: checklist.items } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch checklist', message: error.message });
  }
});

app.post('/api/checklist/:userId', apiLimiter, async (req, res) => {
  try {
    const { userId } = req.params;
    const { week, items } = req.body;

    const checklist = await Checklist.findOneAndUpdate(
      { userId, week },
      { items },
      { upsert: true, returnDocument: 'after' }
    );

    res.json({
      success: true,
      message: 'Checklist updated',
      checklist: { [checklist.week]: checklist.items }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update checklist', message: error.message });
  }
});

function getDefaultChecklist() {
  const week = getCurrentWeek();
  return {
    [week]: [
      { id: 1, task: 'Empty and clean all water containers', completed: false },
      { id: 2, task: 'Cover water storage tanks tightly', completed: false },
      { id: 3, task: 'Remove or dispose of old tyres', completed: false },
      { id: 4, task: 'Clean gutters and drains', completed: false },
      { id: 5, task: 'Empty plant pot trays', completed: false },
      { id: 6, task: 'Dispose of bottles, cans, and containers', completed: false },
      { id: 7, task: 'Check for stagnant water in yard/roof', completed: false },
      { id: 8, task: 'Ensure proper waste disposal', completed: false }
    ]
  };
}

function getCurrentWeek() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + start.getDay() + 1) / 7);
}

app.get('/api/lessons', apiLimiter, (req, res) => {
  const lessons = [
    {
      id: 1,
      title: 'Why Source Reduction Matters',
      titleHindi: 'स्रोत कमी क्यों महत्वपूर्ण है',
      content: 'Mosquitoes breed in stagnant water. Removing breeding sites is the most effective way to prevent dengue.',
      contentHindi: 'मच्छर स्थिर पानी में प्रजनन करते हैं। प्रजनन स्थलों को हटाना डेंगू को रोकने का सबसे प्रभावी तरीका है।',
      type: 'fact'
    },
    {
      id: 2,
      title: 'Weekly Checklist',
      titleHindi: 'साप्ताहिक चेकलिस्ट',
      content: 'Check your home weekly: empty containers, cover tanks, clean gutters, remove waste.',
      contentHindi: 'साप्ताहिक रूप से अपने घर की जांच करें: कंटेनर खाली करें, टैंक ढकें, नालियां साफ करें, कचरा हटाएं।',
      type: 'action'
    },
    {
      id: 3,
      title: 'Myth vs Fact',
      titleHindi: 'मिथक बनाम तथ्य',
      content: 'Myth: Only dirty water breeds mosquitoes. Fact: Even clean water in containers can breed mosquitoes if left stagnant for 7+ days.',
      contentHindi: 'मिथक: केवल गंदा पानी मच्छर पैदा करता है। तथ्य: कंटेनरों में साफ पानी भी 7+ दिनों तक स्थिर रहने पर मच्छर पैदा कर सकता है।',
      type: 'myth'
    },
    {
      id: 4,
      title: 'Community Action',
      titleHindi: 'सामुदायिक कार्रवाई',
      content: 'Report hotspots in your neighborhood. Coordinate cleanup drives with neighbors.',
      contentHindi: 'अपने पड़ोस में हॉटस्पॉट की रिपोर्ट करें। पड़ोसियों के साथ सफाई अभियान का समन्वय करें।',
      type: 'community'
    }
  ];

  res.json({ success: true, lessons });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ========== SOCKET.IO COMMUNITY CHAT ==========
const PROFANITY_LIST = ['fuck', 'shit', 'ass', 'bitch', 'damn', 'dick', 'bastard', 'crap', 'hell'];
const onlineUsers = new Map(); // socketId -> { userId, userName, room }

function filterProfanity(text) {
  let filtered = text;
  PROFANITY_LIST.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  return filtered;
}

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Join a community chat room
  socket.on('join-room', async ({ room, token }) => {
    try {
      // Verify JWT token
      const decoded = verifyToken(token);
      if (!decoded) {
        socket.emit('error-msg', { message: 'Authentication required' });
        return;
      }

      const user = await User.findById(decoded.userId);
      if (!user || user.isBanned) {
        socket.emit('error-msg', { message: user?.isBanned ? 'Account banned' : 'User not found' });
        return;
      }

      if (user.isChatBanned) {
        socket.emit('error-msg', { message: 'You are banned from community chat. Reason: ' + (user.chatBanReason || 'Violation of chat rules') });
        return;
      }

      const validRoom = ROOMS.find(r => r.id === room);
      if (!validRoom) {
        socket.emit('error-msg', { message: 'Invalid room' });
        return;
      }

      // Leave previous room if any
      const prev = onlineUsers.get(socket.id);
      if (prev?.room) {
        socket.leave(`community:${prev.room}`);
        io.to(`community:${prev.room}`).emit('user-left', {
          userId: prev.userId,
          userName: prev.userName
        });
        // Update online count for previous room
        const prevRoomName = `community:${prev.room}`;
        const prevRoomObj = io.sockets.adapter.rooms.get(prevRoomName);
        io.to(prevRoomName).emit('online-count', { count: prevRoomObj ? prevRoomObj.size : 0 });
      }

      // Join new room
      const roomName = `community:${room}`;
      socket.join(roomName);
      onlineUsers.set(socket.id, {
        userId: user._id.toString(),
        userName: user.name,
        userAvatar: user.avatar,
        room
      });

      // Notify room
      io.to(roomName).emit('user-joined', {
        userId: user._id.toString(),
        userName: user.name
      });

      // Send online count
      const roomObj = io.sockets.adapter.rooms.get(roomName);
      io.to(roomName).emit('online-count', { count: roomObj ? roomObj.size : 0 });

      socket.emit('joined', { room, roomName: validRoom.name });
    } catch (err) {
      console.error('Join room error:', err);
      socket.emit('error-msg', { message: 'Failed to join room' });
    }
  });

  // Send a message
  socket.on('send-message', async ({ room, text, token }) => {
    try {
      const decoded = verifyToken(token);
      if (!decoded) {
        socket.emit('error-msg', { message: 'Authentication required' });
        return;
      }

      const user = await User.findById(decoded.userId);
      if (!user || user.isBanned || user.isChatBanned) {
        socket.emit('error-msg', { message: user?.isChatBanned ? 'You are banned from chat' : 'Cannot send messages' });
        return;
      }

      if (!text || !text.trim() || text.trim().length > 500) {
        socket.emit('error-msg', { message: 'Message must be 1-500 characters' });
        return;
      }

      const filteredText = filterProfanity(text.trim());

      const message = await ChatMessage.create({
        room: room.toLowerCase(),
        userId: user._id,
        userName: user.name,
        userAvatar: user.avatar,
        text: filteredText
      });

      const msgData = {
        _id: message._id.toString(),
        room: message.room,
        userId: user._id.toString(),
        userName: user.name,
        userAvatar: user.avatar,
        text: message.text,
        reactions: message.reactions,
        createdAt: message.createdAt
      };

      io.to(`community:${room}`).emit('new-message', msgData);
    } catch (err) {
      console.error('Send message error:', err);
      socket.emit('error-msg', { message: 'Failed to send message' });
    }
  });

  // Toggle a reaction on a message
  socket.on('toggle-reaction', async ({ messageId, emoji, token }) => {
    try {
      const decoded = verifyToken(token);
      if (!decoded) return;

      const validEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
      if (!validEmojis.includes(emoji)) return;

      const message = await ChatMessage.findById(messageId);
      if (!message || message.isDeleted) return;

      const userId = decoded.userId;
      const reactionArray = message.reactions[emoji] || [];
      const idx = reactionArray.findIndex(id => id.toString() === userId);

      if (idx === -1) {
        reactionArray.push(userId);
      } else {
        reactionArray.splice(idx, 1);
      }
      message.reactions[emoji] = reactionArray;
      message.markModified('reactions');
      await message.save();

      // Broadcast updated reactions to room
      io.to(`community:${message.room}`).emit('reaction-updated', {
        messageId: message._id.toString(),
        reactions: message.reactions
      });
    } catch (err) {
      console.error('Reaction error:', err);
    }
  });

  // Delete message via socket
  socket.on('delete-message', async ({ messageId, token }) => {
    try {
      const decoded = verifyToken(token);
      if (!decoded) return;

      const message = await ChatMessage.findById(messageId);
      if (!message || message.isDeleted) return;

      const isOwner = message.userId.toString() === decoded.userId;
      const user = await User.findById(decoded.userId);
      const isAdmin = user?.role === 'admin';

      if (!isOwner && !isAdmin) return;

      message.isDeleted = true;
      message.deletedBy = isAdmin && !isOwner ? 'admin' : 'user';
      message.text = '[Message deleted]';
      await message.save();

      io.to(`community:${message.room}`).emit('message-deleted', {
        messageId: message._id.toString()
      });
    } catch (err) {
      console.error('Delete message error:', err);
    }
  });

  // Typing indicator
  socket.on('typing', ({ room }) => {
    const userData = onlineUsers.get(socket.id);
    if (userData) {
      socket.to(`community:${room}`).emit('user-typing', {
        userId: userData.userId,
        userName: userData.userName
      });
    }
  });

  socket.on('stop-typing', ({ room }) => {
    const userData = onlineUsers.get(socket.id);
    if (userData) {
      socket.to(`community:${room}`).emit('user-stop-typing', {
        userId: userData.userId
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const userData = onlineUsers.get(socket.id);
    if (userData?.room) {
      const roomName = `community:${userData.room}`;
      io.to(roomName).emit('user-left', {
        userId: userData.userId,
        userName: userData.userName
      });
      setTimeout(() => {
        const roomObj = io.sockets.adapter.rooms.get(roomName);
        io.to(roomName).emit('online-count', { count: roomObj ? roomObj.size : 0 });
      }, 100);
    }
    onlineUsers.delete(socket.id);
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

const startServer = async () => {
  try {
    await connectDB();
    await seedDatabase();
    // Sync chat TTL index (update from 30 days to 7 days if needed)
    await ChatMessage.syncTTLIndex();
    if (process.env.PINECONE_API_KEY) {
      const { seedKnowledgeBase } = require('./config/pinecone');
      seedKnowledgeBase().catch(err => console.warn('⚠️ Pinecone seed skipped:', err.message));
    } else {
      console.log('ℹ️  Chatbot will use local TF-IDF retrieval (no PINECONE_API_KEY set)');
    }
    server.listen(PORT, () => {
      console.log(`🚀 DengueSpot server running on http://localhost:${PORT}`);
      console.log(`🔌 WebSocket (Socket.io) ready for community chat`);
      if (!process.env.ROBOFLOW_API_KEY) {
        console.log(`⚠️  WARNING: ROBOFLOW_API_KEY not set in .env file`);
      }
      if (process.env.NODE_ENV === 'production') {
        keepServerAlive();
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

const mongoose = require('mongoose');
const shutdown = async (signal) => {
  console.log(`\n${signal} received. Closing connections...`);
  try {
    await redisClient.quit();
    await mongoose.disconnect();
    console.log('✅ Connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error);
    process.exit(1);
  }
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
