module.exports = function (mongoose) {
  if (!mongoose) {
    return;
  }

  var cookie = require('cookie');
  var md5    = require('blueimp-md5').md5;

  // db config
  var OperatorSchema = new mongoose.Schema({
    username   : {type: String, required: true},
    password   : {type: String, required: true},
    nickname   : String,
    visit_count: Number,
    role_id    : {type: Number, required: true, default: 0}, //0=operator, 1=admin
    token      : String,
    expire     : {type: Number, default: 0},
    avatar     : String,
    email      : String,
    phone      : String
  });
  var OperatorModel = mongoose.model('OperatorModel', OperatorSchema);

  // constructor
  function Operator (_socket, callback) {
    var header  = _socket.handshake.headers,
        cookies = cookie.parse(header.cookie || ''),
        self    = this,
        callbackAfterLogin = callback;

    // 从客户端获取用户信息
    self.cookies = {
      _id      : cookies.hq_id === 'undefined' ? '' : cookies.hq_id,
      token    : cookies.hq_token,
      username : cookies.hq_username,
      role     : cookies.hq_role
    };

    // 接口：登陆
    self.login = function (name, pass, callback) {
      OperatorModel.find({
        username: name,
        password: md5(pass)
      }).exec(function (err, data) {
        if (err) {
          console.log(err);
          callback(err, self);
        } else {
          if (data.length > 0) {
            var newData = {
              token: md5(Math.random().toString(36).substr(-6) + pass),
              expire: Date.now() + (24 * 3600 * 1000)
            };
            OperatorModel.update({
              username: name,
              password: md5(pass)
            }, newData, function (err) {
              if (err) {
                console.log('update login error');
                console.log(err);
              } else {
                data          = data[0];
                self._id      = data._id;
                self.token    = newData.token;
                self.username = data.username;
                self.nickname = data.nickname;
              }
              callbackAfterLogin(err, self);
              callback(err, self);
            });
          } else {
            var err = {
              action: 'Operator ' + name + ' 尝试登陆',
              error: '账号或密码错误'
            };
            console.log(err);
            callback(err, self);
          }
        }
      });
    };

    // 用token登陆
    self.loginByToken = function (name, token, callback) {
      OperatorModel.find({
        username: name,
        token: token
      }).gt('expire', Date.now()).exec(function (err, data) {
        if (err) {
          console.log(err);
        } else {
          if (data.length > 0) {
            var newData = {
              token: md5(Math.random().toString(36).substr(-6) + token),
              expire: Date.now() + (24 * 3600 * 1000)
            };
            OperatorModel.update({
              username: name,
              token: token
            }, newData, function (err) {
              if (err) {
                console.log('update login error');
                console.log(err);
              } else {
                data          = data[0];
                self._id      = data._id;
                self.token    = newData.token;
                self.username = data.username;
                self.nickname = data.nickname;
              }
              callbackAfterLogin(err, self);
              callback(err, self);
            });
          } else {
            callback({error: 'token expired'}, self);
            console.log('expired!');
          }
        }
      });
    };

    // 登出
    self.logout = function (callback) {
      OperatorModel.update({
        _id: self._id
      }, {
        expire: 0
      }, callback);
    };
  }

  Operator.getOne = function (uid, callback) {
    OperatorModel.find({
      _id: uid
    }, callback);
  };

  Operator.getUsers = function (uidArray, callback) {
    OperatorModel.find({
      _id: {$in: uidArray}
    }, callback);
  };

  return Operator;
};
