module.exports = function (mongoose) {
  if (!mongoose) {
    return;
  }

  // db config
  var SessionSchema = new mongoose.Schema({
    _id            : {type: String, required: true, unique: true},
    uid            : {type: String, required: true},
    ip             : String,
    user_agent     : String,
    connect_time   : {type: Number, default: Date.now},
    disconnect_time: {type: Number, default: 0}
  });
  var SessionModel = mongoose.model('SessionModel', SessionSchema);

  return function (_socket, uid, callback) {
    var self = this;
    self._id = _socket.id;
    self.uid = uid || '';
    self.ip = _socket.handshake.address;
    self.user_agent = _socket.handshake.headers['user-agent'];

    SessionModel(self).save(callback);

    self.close = function (closeCallback) {
      SessionModel.update({
        _id: self._id
      }, {
        disconnect_time: Date.now()
      }, function (err, data) {
        if (err) {
          console(err);
        }
        if (typeof closeCallback === 'function') {
          closeCallback(self);
        }
      });
    };
  };
};
