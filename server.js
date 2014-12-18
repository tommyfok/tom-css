var express  = require('express');
var app      = express();
var path     = require('path');
var http     = require('http').Server(app);
var io       = require('socket.io')(http);

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

// 设置数据库，获取构造函数
// CSS = Customer Service System
var dbpath = process.argv[3] === 'dev' ? 'mongodb://localhost:27017/css2' : 'mongodb://localhost:27017/css';
mongoose.connect(dbpath);
var User     = require('./modules/User.js')(mongoose);
var Operator = require('./modules/Operator.js')(mongoose);
var Session  = require('./modules/Session.js')(mongoose);
var Message  = require('./modules/Message.js')(mongoose);
var Referer  = require('./modules/Referer.js')(mongoose);
var Rate     = require('./modules/Rate.js')(mongoose);

// 原始数据
var port     = Number(process.argv[2]) || 8000,
    users    = [],
    sessions = [];

// 获取线上用户信息
function getUser (uid) {
  users.forEach(function (value) {
    if (value._id === uid) {
      return value;
    }
  });
  return null;
}

// 用户连接到服务器
io.on('connection', function (socket) {
  var user,
      session;

  // 创建新用户
  // 要判断用户是否operator
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
    user[data.token ? 'loginByToken' : 'login'](data.name, data.token || data.pass, function (err, data) {
      if (err) {
        socket.emit('login fail', err);
      } else {
        socket.emit('login success', data);
        // 创建新会话
        session = new Session(socket, data._id, function (err, data) {
          if (err) {
            socket.emit('session fail', [err, data]);
          } else {
            socket.emit('session success', data);
            user.session = session;
            users.push(user);
            sessions.push(session);
          }
        });
      }
    });
  });

  // 接线员登出
  socket.on('operator logout', function () {
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
