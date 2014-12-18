module.exports = function (mongoose) {
  if (!mongoose) {
    return;
  }

  // db config
  var RefererSchema = new mongoose.Schema({
    url        : {type: String, required: true},
    visit_count: {type: Number, required: true, default: 0},
    msg_count  : {type: Number, required: true, default: 0}
  });
  var RefererModel  = mongoose.model('RefererModel', RefererSchema);

  return function () {};
};
