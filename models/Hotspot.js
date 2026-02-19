const mongoose = require('mongoose');

const hotspotSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: [true, 'Latitude is required'],
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: [true, 'Longitude is required'],
    min: -180,
    max: 180
  },
  // GeoJSON for geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  photoUrl: {
    type: String,
    maxlength: [500, 'Photo URL cannot exceed 500 characters'],
    default: ''
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['reported', 'investigating', 'resolved'],
    default: 'reported'
  },
  reporterName: {
    type: String,
    default: null
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

hotspotSchema.pre('save', function() {
  if (this.latitude != null && this.longitude != null) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
});

hotspotSchema.index({ location: '2dsphere' });
hotspotSchema.index({ riskLevel: 1, createdAt: -1 });
hotspotSchema.index({ status: 1 });
hotspotSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Hotspot', hotspotSchema);
