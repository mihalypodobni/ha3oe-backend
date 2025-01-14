require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const PASSWORD = process.env.SECRET_PASSWORD;

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cookieParser()); // Add cookie parser middleware
app.use(session({
    secret: 'your-session-secret',
    resave: false,
    saveUninitialized: true,
  }));

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;
const SECRET_PASSWORD = process.env.SECRET_PASSWORD;


mongoose.connect(MONGO_URI);

const postSchema = new mongoose.Schema({
    userId: String,
    content: String,
    createdAt: { type: Date, default: Date.now },
});

const imageSchema = new mongoose.Schema({
    userId: String,
    imagePath: String,
    uploaderName: String,
    description: String,
    createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', postSchema);
const mediaSchema = new mongoose.Schema({
    userId: String,
    mediaPath: String,
    mediaType: String, // 'image' or 'video'
    description: String,
    uploaderName: String,
    createdAt: { type: Date, default: Date.now },
});

const Media = mongoose.model('Media', mediaSchema);

const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov/;
        const mimeType = allowedTypes.test(file.mimetype);
        const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimeType && extName) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed'));
        }
    }
});

app.post('/upload', upload.array('media'), (req, res) => {
    const files = req.files;
    const { descriptions, uploaderName, userId } = req.body;

    const mediaItems = files.map((file, index) => ({
        userId,
        mediaPath: file.path,
        mediaType: file.mimetype.startsWith('image') ? 'image' : 'video',
        description: descriptions[index],
        uploaderName,
    }));

    Media.insertMany(mediaItems)
        .then((result) => res.json(result))
        .catch((err) => res.status(500).json({ error: err.message }));
});

app.get('/media', (req, res) => {
    Media.find().then((media) => res.json(media));
});

app.post('/api/login', (req, res) => {
    const { name, password } = req.body;
  
    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Name and password are required' });
    }
  
    if (password === PASSWORD) {
      req.session.user = { name };
      res.json({ success: true, name });
    } else {
      res.status(401).json({ success: false, message: 'Invalid password' });
    }
  });
  
  // Example protected route
  app.get('/api/protected', (req, res) => {
    if (req.session.user) {
      res.json({ success: true, message: `Hello, ${req.session.user.name}` });
    } else {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    }
  });

app.post('/posts', (req, res) => {
    const { userId, content } = req.body;
    const post = new Post({ userId, content });
    post.save().then((result) => res.json(result));
});

app.get('/posts', (req, res) => {
    Post.find().then((posts) => res.json(posts));
});

app.put('/posts/:id', (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    Post.findByIdAndUpdate(id, { content }, { new: true }).then((result) => res.json(result));
});

app.delete('/posts/:id', (req, res) => {
    const { id } = req.params;
    Post.findByIdAndDelete(id).then(() => res.json({ success: true }));
});

/* app.post('/upload', upload.single('image'), (req, res) => {
    const image = new Image({ userId: req.body.userId, imagePath: req.file.path });
    image.save().then((result) => res.json(result));
});

app.get('/images', (req, res) => {
    Image.find().then((images) => res.json(images));
}); */

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
