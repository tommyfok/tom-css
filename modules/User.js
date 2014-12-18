module.exports = function (mongoose) {
  if (!mongoose) {
    return;
  }

  var cookie = require('cookie');
  var md5    = require('blueimp-md5').md5;

  // db config
  var UserSchema = new mongoose.Schema({
    username   : {type: String, required: true},
    password   : String, 
    nickname   : String,
    visit_count: {type: Number, default: 0},
    role_id    : {type: Number, required: true, default: 0}, //0=guest, 1=registered user
    token      : String,
    expire     : {type: Number, default: 0},
    avatar     : String,
    email      : String,
    phone      : String,
    address    : String
  });
  var UserModel = mongoose.model('UserModel', UserSchema);

  // constructor
  function User (_socket, callback) {
    var header  = _socket.handshake.headers,
        cookies = cookie.parse(header.cookie || ''),
        self    = this;

    // 从客户端获取用户信息
    self.cookies = {
      _id      : cookies.hq_id === 'undefined' ? '' : cookies.hq_id,
      token    : cookies.hq_token,
      username : cookies.hq_username,
      role     : cookies.hq_role
    };

    if (!self.cookies._id) {
      newUser();
    } else {
      // 历史访客
      UserModel.findById(self.cookies._id).exec(function (err, data) {
        if (!err) {
          if (data && data._id) {
            self._id         = data._id;
            self.username    = data.username;
            self.nickname    = data.nickname || '';
            self.role_id     = data.role_id;
            self.visit_count = data.visit_count ? (data.visit_count + 1) : 1;
            UserModel.update({_id: self._id}, {visit_count: self.visit_count}, function (err) {
              if (err) {
                console.log(err);
              }
              callback(err, self);
            });
          } else {
            newUser();
          }
        } else {
          console.log('Get user data error');
          console.log(err);
          callback(err, self);
        }
      });
    }

    // 接口：登陆
    self.login = function (name, pass, callback) {
      UserModel.find({
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
            UserModel.update({
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
              callback(err, self);
            });
          } else {
            var err = {
              action: 'User ' + name + ' 尝试登陆',
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
      UserModel.find({
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
            UserModel.update({
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
      UserModel.update({
        _id: self._id
      }, {
        expire: 0
      }, callback);
    };

    // 私有方法：新用户
    function newUser () {
      UserModel({
        username: Math.random().toString(36).substr(-4) + Date.now().toString().substr(-6)
      }).save(function (err, data) {
        if (!err) {
          self._id      = data._id;
          self.token    = data.token;
          self.username = data.username;
          self.nickname = data.nickname;
        } else {
          console.log('Save new user error');
          console.log(err);
        }
        callback(err, self);
      });
    }
  }

  User.getOne = function (uid, callback) {
    UserModel.find({
      _id: uid
    }, callback);
  };

  User.getUsers = function (uidArray, callback) {
    UserModel.find({
      _id: {$in: uidArray}
    }, callback);
  };

  return User;
};
