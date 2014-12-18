module.exports = function (mongoose) {
  if (!mongoose) {
    return;
  }

  // db config
  var RateSchema = new mongoose.Schema({
    user_id    : {type: String, required: true},
    operator_id: {type: String, required: true},
    start_time : Number,
    end_time   : Number,
    msg_count  : Number,
    score      : {type: Number, required: true, default: 6}
  });
  var RateModel = mongoose.model('RateModel', RateSchema);

  return function () {};
};
