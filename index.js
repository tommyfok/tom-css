var express = require('express');
var app     = express();
var path    = require('path');
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

app.use(express.static(path.join(__dirname, 'public')));

// 搞清楚io，socket的关系
// io是tmd全局的，io.emit就发送给所有的socket了
// io.to('xxx').emit可以指定定发送的群组xxx
// socket是当前连接
// socket.emit发送消息给连接的客户端
// socket.broadcast.to(xxx).emit注意broadcast可提升其逼格，发送广播给其他用户.
// > xxx可以是房间(群组)也可以是某个id，因为socket.io自动为每个id创建了一个房间哦！

// 原始数据
var port      = Number(process.argv[2]) || 3000,
    users     = [],
    managers  = [],
    accounts  = {
      'tang': '123456',
      'tommy': '123456',
      'woody': '123456'
    };

// 用户类
function User (socket) {
  return {
    id: socket.id,
    name: '游客' + Math.random().toString(16).substr(2),
    role: 'customer',
    target: ''
  };
}

// 方法
function checkLogin (name, pass) {
  return accounts[name] === pass;
}

function getUser (group, condition) {
  var users = [];
  if (condition) {
    var id = condition.id || condition;
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].id === id) {
        (function (ii) {
          users.push(group[ii]);
        })(i);
      }
    }
  }
  return users.length === 1 ? users[0] : users;
}

// 连接
io.on('connection', function (socket) {
  // 创建新用户
  var user = new User(socket);
  users.push(user);
  // 给所有管理员发送用户更新通知
  io.to('managers').emit('updateAllUsers', {
    users: users,
    managers: managers
  });

  // 管理员登陆
  socket.on('login', function (data) {
    console.log(data);
    if (checkLogin(data.name, data.pass)) {
      user.name = data.name;
      user.role = 'manager';
      managers.push(users.splice(users.indexOf(user), 1));

      // 让这个链接(socket)加入"managers"房间
      socket.join('managers');
      socket.emit('loginSuccess', user);
      // 给所有管理员发送用户更新通知
      io.to('managers').emit('updateAllUsers', {
        users: users,
        managers: managers
      });
    } else {
      socket.emit('loginFail');
    }
  });

  // 处理管理员发过来的接待某个客户的消息
  socket.on('receptUser', function (targetId) {
    if (user.role === 'manager') {
      user.target = targetId;
      var customer = getUser(users, targetId);
      customer.target = user.id;

      io.to(targetId).emit('recepted', user.name);
    }
  });

  // 处理从web发来的消息
  socket.on('webMsg', function (msg) {
    if (user.role === 'customer') {
      // 如果该用户是顾客
      if (user.target === '') {
        // 如果他暂未被某管理员接待
        // 把消息发送给所有管理员
        msg.src = 'remote';
        io.to('managers').emit('userBroadcastMsg', msg);
      } else {
        // 如果他已经被某个管理员接待了
        // 管理员的对话窗口添加消息
        msg.src = 'remote';
        socket.broadcast.to(user.target).emit('addToDialog', msg);
      }
      // 客户的对话窗口添加消息
      msg.src = 'local';
      socket.emit('addToDialog', msg);
    } else {
      // 如果该用户是管理员
      // > 客户的对话窗口添加消息
      msg.src = 'remote';
      io.to(user.target).emit('addToDialog', msg);
      // > 管理员的对话窗口添加消息
      msg.src = 'local';
      socket.emit('addToDialog', msg);
    }
  });

  // web端断开连接
  socket.on('disconnect', function () {
    if (user.role === 'customer') {
      users.splice(users.indexOf(user), 1);
    } else {
      managers.splice(managers.indexOf(user), 1);
      socket.leave('managers');
    }

    io.to('managers').emit('updateAllUsers', {
      users: users,
      managers: managers
    });
  });
});

http.listen(port, function () {
  console.log('listening on *:' + port);
});
