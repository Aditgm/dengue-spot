const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/denguespot';
    const isAtlas = mongoURI.includes('mongodb+srv') || mongoURI.includes('mongodb.net');

    await mongoose.connect(mongoURI);

    console.log(`✅ MongoDB connected ${isAtlas ? '(Atlas)' : '(Local)'}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('💡 Make sure MongoDB is running or use MongoDB Atlas (free)');
    process.exit(1);
  }
};

module.exports = connectDB;
