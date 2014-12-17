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
  avatar     : String,
  email      : String,
  phone      : String
});
var SessionSchema = new mongoose.Schema({
  _id            : {type: String, required: true, unique: true},
  uid            : {type: String, required: true},
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
  read_sid   : String,
  read_uid   : String,
  content    : {type: String, required: true},
  create_time: {type: Number, default: Date.now},
  client_rid : String, // client referer id
  is_read    : {type: Boolean, default: false},
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
var port      = Number(process.argv[2]) || 8000,
    users     = [],
    operators = [],
    sessions  = [],
    sessionKeys = {};

// 用户类
function User (_socket, callback) {
  var header  = _socket.handshake.headers,
      cookies = cookie.parse(header.cookie),
      self    = this;
  // 从客户端获取用户资料
  self._id      = cookies.hq_id;
  self.username = Math.random().toString(36).substr(-4) + Date.now().toString().substr(-6);
  if (!self._id) {
    // 首次访问的游客
    UserModel({
      username: self.username
    }).save(function (err, data) {
      if (!err) {
        self._id         = data._id;
        self.username    = data.username;
        self.nickname    = data.nickname;
        self.role_id     = data.role_id;
        self.visit_count = 0;
      } else {
        console.log('Save new user error');
      }
      callback(err, self);
    });
  } else {
    UserModel.findById(self._id).exec(function (err, data) {
      if (!err) {
        if (data._id) {
          self._id         = data._id;
          self.username    = data.username;
          self.nickname    = data.nickname;
          self.role_id     = data.role_id;
          self.visit_count = data.visit_count + 1;
          UserModel.update({_id: self._id}, {visit_count: self.visit_count}, function (err) {
            callback(err, self);
          });
        } else {
          UserModel({
            username: self.username
          }).save(function (err, data) {
            if (!err) {
              self._id         = data._id;
              self.username    = data.username;
              self.nickname    = data.nickname;
              self.role_id     = data.role_id;
              self.visit_count = 0;
            } else {
              console.log('Save user error');
            }
            callback(err, self);
          });
        }
      } else {
        console.log('Get history user error');
        callback(err, self);
      }
    });
  }
}

// 会话类
function Session (_socket, uid, callback) {
  var self = this;
  self._id = _socket.id;
  self.uid = uid;
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
function Message () {
  var self = this;
}

// === 方法 ===
// 登陆
function doLogin (name, pass, key, callback) {
}

// 获取用户信息
function getUser (uid, callback) {
}

// 获取用户信息
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
      });
    }
  });

  // 给所有接线员发送用户更新通知
  io.to('operators').emit('add user', user);

  // 接线员登陆
  socket.on('login', function (data) {
  });

  // 处理接线员发过来的接待某个客户的消息
  socket.on('i will recept someone', function (targetId) {
  });

  // 客户端获取消息
  socket.on('get historyMsgs', function () {
    getMessages(user._id, 'all', function (err, data) {
      if (err) {
        socket.emit('get historyMsgs fail');
      } else {
        socket.emit('get historyMsgs success', data);
      }
    });
  });

  // 处理从web端发来的消息
  socket.on('web message', function (msg) {
    var newMsg = new Message(user, user.target, )
  });

  // 添加接线员帐号
  socket.on('create receptor', function (data) {
  });

  // 删除接线员
  socket.on('remove receptor', function (username) {
  });

  // 修改密码
  socket.on('change password', function (data) {
  });

  // 如果用户的接线员离线
  socket.on('my receptor is disconnected', function (historyMsgs) {
  });

  // web端断开连接
  socket.on('disconnect', function () {
  });

  // 查看曾发送过消息的离线客户的列表
  // 返回用户名称列表
  // 离线消息的特征：to_socket === ''
  socket.on('get missed customers', function (range) {
  });

  // 根据某个离线用户名称查看咨询记录
  // 注册用户有固定的username而没有固定的socket_id，所以根据username来查询更合理
  // 同上，离线消息的特征是 to_socket === ''
  socket.on('get missed messages of someone', function (username) {
  });

  // 获取曾经与我通过话的用户列表
  // 返回用户名称列表
  // 消息特征：to_name === user.username || from_name === user.username
  socket.on('get history customers', function (range) {
  });

  // 根据某个用户名称查看历史纪录
  socket.on('get history messages of someone', function (username) {
  });

  // 用户登出
  socket.on('logout', function (username) {
  });
});

http.listen(port, function () {
  console.log('服务器正在监听端口' + port + '的请求');
});
