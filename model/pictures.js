var mongoose = require('mongoose');
var pictureSchema = new mongoose.Schema({
  name: String,
  file: String,
  created_at: { type: Date, default: Date.now }
});
mongoose.model('Picture', pictureSchema);
