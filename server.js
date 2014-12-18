var express  = require('express');
var app      = express();
var path     = require('path');
var http     = require('http').Server(app);
var io       = require('socket.io')(http);
var cookie   = require('cookie');

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
      session,
      cookies         = cookie.parse(socket.handshake.headers.cookie || ''),
      isOperator      = cookies.hq_role === 'operator',
      UserConstructor = isOperator ? Operator : User;

  if (isOperator) {
    socket.join('operators');
  }

  // 创建新用户
  user = new UserConstructor(socket, function (err, data) {
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

        // 给所有接线员发送用户更新通知
        io.to('operators').emit('add user', user);

        // web端断开连接
        socket.on('disconnect', function () {
          if (!isOperator) {
            io.to('operators').emit('user disconnect', user);
          } else {
            if (user.target && user.target.session) {
              io.to(user.target.session._id).emit('operator disconnect');
            }
            io.to('operators').emit('operator disconnect', user);
          }
          session.close(function () {
            users.splice(users.indexOf(user), 1);
            sessions.splice(sessions.indexOf(session), 1);
          });
        });
      });
    }
  });

  socket.on('get unread users', function () {
    Message.getUnreadUids(function (err, data) {
      if (err) {
        console.log(err);
        socket.emit('get unread users fail', err);
      } else {
        var uidArray = [];
        data.forEach(function (value) {
          uidArray.push(value._id);
        });
        User.getUsers(uidArray, function (err, data) {
          if (err) {
            console.log(err);
            socket.emit('get unread users fail', err);
          } else {
            socket.emit('get unread users success', data);
          }
        });
      }
    });
  });


  // 客户端获取消息
  socket.on('get history messages', function () {
    Message.getMsgs(user._id, 'all', function (err, data) {
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

  // 接待用户
  socket.on('recept user', function (uid) {
    var targetUser = getUser(uid);
    if (targetUser) {
      user.target = getUser(uid);
      user.target.target = user;
      socket.emit('recept success', user.target._id);
      io.to(user.target.session._id).emit('you are recepted', user);
    } else {
      socket.emit('recept fail');
    }
  });

  // 接线员登陆
  socket.on('operator login', function (data) {
    user[data.token ? 'loginByToken' : 'login'](data.name, data.token || data.pass, function (err, data) {
      if (err) {
        socket.emit('login fail', err);
      } else {
        socket.emit('login success', data);
      }
    });
  });

  // 接线员登出
  socket.on('operator logout', function () {
    user.logout(function (err) {
      if (err) {
        socket.emit('logout fail');
        console.log(err);
      } else {
        socket.emit('logout success');
      }
    });
  });
});

http.listen(port, function () {
  console.log('服务器正在监听端口' + port + '的请求');
});
