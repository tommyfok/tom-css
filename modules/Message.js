module.exports = function (mongoose) {
  if (!mongoose) {
    return;
  }

  // db config
  var MessageSchema = new mongoose.Schema({
    from_sid   : {type: String, required: true},
    from_uid   : {type: String, required: true},
    to_sid     : String,
    to_uid     : String,
    content    : {type: String, required: true},
    create_time: {type: Number, default: Date.now},
    client_rid : String, // client referer id
    is_read    : {type: Boolean, default: false},
    read_sid   : String,
    read_uid   : String,
    read_time  : {type: Number, required: true, default: 0}
  });
  var MessageModel = mongoose.model('MessageModel', MessageSchema);

  function Message (from, to, content, callback) {
    if (from && content && content.length > 0) {
      var self = this;
      self.from_uid = from._id || '';
      self.from_sid = (from.session && from.session._id) || '';
      self.to_uid = to._id || '';
      self.to_sid = (to.session && to.session._id) || '';
      self.content = content;
      MessageModel(self).save(function (err, data) {
        if (err) {
          console.log('create message failed');
          console.log(err);
        } else {
          self._id = data._id;
        }
        callback(err, self);
      });

      self.read = function (_user) {
        MessageModel.update({
          _id: self._id
        }, {
          is_read: true,
          read_uid: _user._id,
          read_sid: _user.session._id,
          read_time: Date.now()
        }, function (err, data) {
          if (err) {
            console.log('read message failed');
            console.log(err);
          }
          console.log(data);
        });
      };
    } else {
      callback({error: 'no content'}, null);
    }
  }

  Message.getUnreadUids = function (callback) {
    MessageModel.aggregate([
      {$match: {is_read: false}},
      {$group: {_id: '$from_uid'}}
    ]).exec(callback);
  };

  Message.getMsgs = function (uid, type, callback) {
    var queryObject = {};
    if (type === 'from') {
      queryObject = {
        from_uid: uid
      };
    } else if (type === 'to') {
      queryObject = {
        to_uid: uid
      };
    } else if (type === 'all') {
      queryObject = {
        $or: [
          {from_uid: uid},
          {to_uid: uid}
        ]
      };
    } else {
      return callback({error: 'type 参数不正确'}, []);
    }
    MessageModel.find(queryObject, callback);
  };

  Message.readAll = function (from_uid, reader, callback) {
    var updateQuery = {};
    if (reader) {
      updateQuery = {
        $or: [
          {from_uid: from_uid},
          {to_uid: reader._id}
        ]
      };
    } else {
      updateQuery = {
        from_uid: from_uid
      };
    }
    MessageModel.update(updateQuery, {
      is_read: true,
      read_uid: reader._id,
      read_sid: reader.session._id,
      read_time: Date.now()
    }, callback);
  };

  return Message;
};
