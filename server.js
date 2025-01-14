require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const PASSWORD = process.env.SECRET_PASSWORD;
const cloudinaryName = process.env.CLOUDINARY_NAME;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI;
const SECRET_PASSWORD = process.env.SECRET_PASSWORD;
const FRONTEND_URL = process.env.FRONTEND_URL;

const app = express();
// CORS configuration
app.use(cors({
    origin: {FRONTEND_URL}, // Allow all origins (for development only, restrict in production)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cookieParser()); // Add cookie parser middleware
app.use(
  session({
    secret: "your-session-secret",
    resave: false,
    saveUninitialized: true,
  })
);

cloudinary.config({
  cloud_name: cloudinaryName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      let folderName = 'uploads';
      let resourceType = 'image';
    
      // Check if the file is a video based on mimetype
      if (file.mimetype.startsWith('video/')) {
        resourceType = 'video';
        folderName = 'uploads';
      }
    
      return {
        folder: folderName,
        resource_type: resourceType, // 'image' or 'video'
        public_id: file.originalname, // Use the original file name as the public_id
        allowed_formats: resourceType === 'image' ? ['jpg', 'jpeg', 'png'] : ['mp4', 'mov', 'avi'],
      };
    },
  });


mongoose.connect(MONGO_URI);

const postSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // Required field
    content: { type: String }, // Optional field (default behavior)
    url: { type: String, required: false }, // Optional field (default behavior)
    type: { type: String, required: true }, // Explicitly optional
    createdAt: { type: Date, default: Date.now }, // Optional with a default value
  });

const Post = mongoose.model("Post", postSchema);

const mediaSchema = new mongoose.Schema({
  userId: String,
  mediaPath: String,
  mediaType: String, // 'image' or 'video'
  description: String,
  uploaderName: String,
  createdAt: { type: Date, default: Date.now },
});

const Media = mongoose.model("Media", mediaSchema);

/* const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (mimeType && extName) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
}); */

const upload = multer({ storage: storage });


// Route for uploading media with descriptions
app.post('/upload', upload.array('media'), async (req, res) => {
    const files = req.files;
    const { descriptions, uploaderName, userId } = req.body;
  
    // Ensure descriptions are an array if there's only one item
    const descriptionsArray = Array.isArray(descriptions) ? descriptions : [descriptions];
  
    try {
      const mediaItems = files.map((file, index) => ({
        userId,
        mediaPath: file.path,
        mediaType: file.mimetype.startsWith('image/') ? 'image' : 'video',
        description: descriptionsArray[index] || '',
        uploaderName,
      }));
  
      const result = await Media.insertMany(mediaItems);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.get("/media", (req, res) => {
  Media.find().then((media) => res.json(media));
});

app.post("/api/login", (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Name and password are required" });
  }

  if (password === PASSWORD) {
    req.session.user = { name };
    res.json({ success: true, name });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});


app.post("/posts", (req, res) => {
    const { userId, content, type } = req.body; // Include type in the request body
    const post = new Post({ userId, content, type }); // Save the type along with other post details
    post.save()
      .then((result) => res.json(result))
      .catch((error) => res.status(500).json({ error: error.message }));
  });

  app.get("/posts", (req, res) => {
    Post.find()
      .then((posts) => res.json(posts))
      .catch((error) => res.status(500).json({ error: error.message }));
  });

app.put("/posts/:id", (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  Post.findByIdAndUpdate(id, { content }, { new: true }).then((result) =>
    res.json(result)
  );
});

app.delete("/posts/:id", (req, res) => {
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
