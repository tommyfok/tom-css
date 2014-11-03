var express = require('express');
var app     = express();
var path    = require('path');
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/customer.html'));
});

app.get('/server', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/receptor.html'));
});

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
    receptors = {
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
  return receptors[name] === pass;
}

function getUser (id) {
  for (var i = 0, l = users.length; i < l; i++) {
    if (users[i].id === id) {
      return users[i];
    }
  }
  return null;
}

// 连接
io.on('connection', function (socket) {
  // 创建新用户
  var user = new User(socket);
  users.push(user);

  // 给所有管理员发送用户更新通知
  io.to('managers').emit('addUser', user);

  // 把ID发回给用户
  socket.emit('connectionSuccess', user);

  // 管理员登陆
  socket.on('login', function (data) {
    if (checkLogin(data.name, data.pass)) {
      user.name = data.name;
      user.role = 'manager';

      // 让这个链接(socket)加入"managers"房间
      socket.join('managers');
      socket.emit('loginSuccess', {
        self: user,
        users: users
      });

      // 给所有管理员发送用户更新通知
      io.to('managers').emit('addManager', user);
    } else {
      socket.emit('loginFail');
    }
  });

  // 处理管理员发过来的接待某个客户的消息
  socket.on('receptUser', function (targetId) {
    if (user.role === 'manager') {
      var customer = getUser(targetId);
      customer.target = user.id;
      user.target = targetId;
      io.to(targetId).emit('recepted', {
        from: String(user.id),
        to: String(user.target),
        content: '客服' + user.name + '为您服务',
        time: +new Date
      });

      io.to('managers').emit('receptCustomer', {
        receptor: user.id,
        recepted: customer.id
      });
    }
  });

  // 处理从web发来的消息
  socket.on('webMsg', function (msg) {
    var newMsg = {
      from: user.id,
      to: user.target,
      content: msg,
      time: +new Date
    };
    if (user.role === 'customer') {
      // 如果该用户是顾客
      if (user.target === '') {
        // 如果他暂未被某管理员接待
        // 把消息发送给所有管理员
        io.to('managers').emit('addMsg', newMsg);
      } else {
        // 如果他已经被某个管理员接待了
        // 管理员的对话窗口添加消息
        io.to(user.target).emit('addMsg', newMsg);
      }
      // 消息来源的对话窗口添加消息
      socket.emit('addMsg', newMsg);
    } else {
      // 如果该用户是管理员
      // > 客户的对话窗口添加消息
      io.to(user.target).emit('addMsg', newMsg);
      // > 管理员的对话窗口添加消息
      socket.emit('addMsg', newMsg);
    }
  });

  // web端断开连接
  socket.on('disconnect', function () {
    if (user.role === 'customer') {
      io.to('managers').emit('customerDisconnect', user.id);
      users.splice(users.indexOf(user), 1);
    } else {
      io.to(user.target).emit('managerDisconnect', user.id);
      users.splice(users.indexOf(user), 1);
      socket.leave('managers');
    }
  });
});

http.listen(port, function () {
  console.log('listening on *:' + port);
});
