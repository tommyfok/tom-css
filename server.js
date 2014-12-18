var express = require('express');
var app     = express();
var path    = require('path');
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var md5     = require('blueimp-md5').md5;
var cookie  = require('cookie');

// serve static files
app.use(express.static(path.join(__dirname, 'public')));

// custom routes
app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/client.html'));
});

app.get('/operator', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/operator.html'));
});

app.get('/admin', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// 数据库
var mongoose = require('mongoose');
// 设置数据库链接
// CSS = Customer Service System
var dbpath = process.argv[3] === 'dev' ? 'mongodb://localhost:27017/css2' : 'mongodb://localhost:27017/css';
mongoose.connect(dbpath);
// 定义数据模型
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
var SessionSchema = new mongoose.Schema({
  _id            : {type: String, required: true, unique: true},
  uid            : {type: String},
  ip             : String,
  user_agent     : String,
  connect_time   : {type: Number, default: Date.now},
  disconnect_time: {type: Number, default: 0}
});
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
var RefererSchema = new mongoose.Schema({
  url        : {type: String, required: true},
  visit_count: {type: Number, required: true, default: 0},
  msg_count  : {type: Number, required: true, default: 0}
});
var RateSchema = new mongoose.Schema({
  user_id    : {type: String, required: true},
  operator_id: {type: String, required: true},
  start_time : Number,
  end_time   : Number,
  msg_count  : Number,
  score      : {type: Number, required: true, default: 6}
});
var UserModel     = mongoose.model('UserModel', UserSchema),
    SessionModel  = mongoose.model('SessionModel', SessionSchema),
    MessageModel  = mongoose.model('MessageModel', MessageSchema),
    RefererModel  = mongoose.model('RefererModel', RefererSchema),
    OperatorModel = mongoose.model('OperatorModel', OperatorSchema),
    RateModel     = mongoose.model('RateModel', RateSchema);

// 原始数据
var port     = Number(process.argv[2]) || 8000,
    users    = [],
    sessions = [];

// 用户类
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

  var Model = self.cookies.role === 'operator' ? OperatorModel : UserModel;

  if (!self.cookies._id) {
    newUser();
  } else {
    // 历史访客
    Model.findById(self.cookies._id).exec(function (err, data) {
      if (!err) {
        if (data && data._id) {
          self._id         = data._id;
          self.username    = data.username;
          self.nickname    = data.nickname || '';
          self.role_id     = data.role_id;
          self.visit_count = data.visit_count ? (data.visit_count + 1) : 1;
          Model.update({_id: self._id}, {visit_count: self.visit_count}, function (err) {
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
  self.login = function (name, pass, type, callback) {
    var Model = type === 'operator' ? OperatorModel : UserModel;
    Model.find({
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
          Model.update({
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
            action: '用户 ' + name + ' 尝试登陆',
            error: '账号或密码错误'
          };
          console.log(err);
          callback(err, self);
        }
      }
    });
  };

  // 用token登陆
  self.loginByToken = function (name, token, type, callback) {
    var Model = type === 'operator' ? OperatorModel : UserModel;
    Model.find({
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
          Model.update({
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

  // 私有方法：新用户
  function newUser () {
    if (Model === UserModel) {
      // 首次访问的游客
      Model({
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
    } else {
      callback(false, self);
    }
  }
}

// 会话类
function Session (_socket, uid, callback) {
  var self = this;
  self._id = _socket.id;
  self.uid = uid || '';
  self.ip = _socket.handshake.address;
  self.user_agent = _socket.handshake.headers['user-agent'];
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
  SessionModel(self).save(callback);
}

// 消息类
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
      }
      self._id = data._id;
      callback(err, data);
    });
    self.read = function (_user) {
      console.log(self._id);
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

// 获取用户信息
function getUser (uid) {
  users.forEach(function (value) {
    if (value._id === uid) {
      return value;
    }
  });
  return null;
}

// 获取用户消息列表
function getMessages (uid, type, callback) {
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
}

// 用户连接到服务器
io.on('connection', function (socket) {
  var user,
      session;

  // 创建新用户
  user = new User(socket, function (err, data) {
    if (err) {
      socket.emit('connection fail', [err, data]);
    } else {
      socket.emit('connection success', data);
      // 创建新会话
      session = new Session(socket, data._id, function (err, data) {
        if (err) {
          socket.emit('session fail', [err, data]);
        } else {
          socket.emit('session success', data);
        }
        user.session = session;
        users.push(user);
        sessions.push(session);
      });
    }
  });
  // 给所有接线员发送用户更新通知
  io.to('operators').emit('add user', user);

  // 处理接线员发过来的接待某个客户的消息
  socket.on('recept someone', function (sid) {
  });

  // 客户端获取消息
  socket.on('get history messages', function () {
    getMessages(user._id, 'all', function (err, data) {
      if (err) {
        socket.emit('get history messages fail');
      } else {
        socket.emit('get history messages success', data);
      }
    });
  });

  // 处理从web端发来的消息
  socket.on('web message', function (msgContent) {
    var msg = new Message(user, user.target || {}, msgContent, function (err, data) {
      if (err) {
        console.log(err);
      } else {
        socket.emit('add message', msg);
        if (user.target) {
          io.to(user.target.session._id).emit('add client message', msg);
        } else {
          io.to('operators').emit('add pending message', msg);
        }
      }
    });
  });

  // 接线员登陆
  socket.on('operator login', function (data) {
    user[data.token ? 'loginByToken' : 'login'](data.name, data.token || data.pass, 'operator', function (err, data) {
      if (err) {
        socket.emit('login fail', err);
      } else {
        socket.emit('login success', data);
      }
    });
  });

  // 接线员登出
  socket.on('logout', function () {
    user.logout(function () {
      socket.emit('logout success');
    });
  });

  // web端断开连接
  socket.on('disconnect', function () {
    if (user.role_id < 2) {
      io.to('operators').emit('user disconnect', user);
    } else if (user.role_id >= 2) {
      if (user.target && user.target.session) {
        io.to(user.target.session._id).emit('operator disconnect', user);
      }
    }
    users.splice(users.indexOf(user), 1);
    sessions.splice(sessions.indexOf(session), 1);
  });
});

http.listen(port, function () {
  console.log('服务器正在监听端口' + port + '的请求');
});
