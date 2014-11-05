var express = require('express');
var app     = express();
var path    = require('path');
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

// route config
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/customer.html'));
});

app.get('/server', function (req, res) {
  res.sendFile(path.join(__dirname, 'public/receptor.html'));
});

app.get('/admin', function (req, res) {
  res.end('这个管理后台，迟早都得做。。。');
});

// 数据库
var mongoose = require('mongoose');
// 设置数据库链接
// CSS = Customer Service System
mongoose.connect('mongodb://localhost:27017/css');
// 定义数据模型
// 主键`_id`如未定义，则会被自动添加
var SocketUserSchema = new mongoose.Schema({
      _id             : {type: String, index: true},
      account_id      : {type: String, index: true},
      name            : String,
      ip              : String,
      user_agent      : String,
      referer         : String,
      connect_time    : Number,
      disconnect_time : Number
    }),
    AccountSchema = new mongoose.Schema({
      name      : {type: String, index: {unique: true}},
      password  : String,
      role      : {type: String, index: true}
    }),
    MessageSchema = new mongoose.Schema({
      from_socket  : {type: String, index: true},
      to_socket    : {type: String, index: true},
      from_name    : {type: String, index: true},
      to_name      : {type: String, index: true},
      content      : String,
      create_time  : Number
    }),
    SocketUserModel = mongoose.model('SocketUserModel', SocketUserSchema),
    AccountModel    = mongoose.model('AccountModel', AccountSchema),
    MessageModel    = mongoose.model('MessageModel', MessageSchema);

// 数据初始化
// AccountModel({
//   name: 'tommy',
//   password: '123456',
//   role: 'receptor'
// }).save();

// 搞清楚io，socket的关系
// io是tmd全局的，io.emit就发送给所有的socket了
// io.to('xxx').emit可以指定定发送的群组xxx
// xxx可以是房间(群组)也可以是某个id，因为socket.io自动为每个id创建了一个房间哦！
// socket是当前连接
// socket.emit发送消息给连接的客户端
// socket.broadcast.to(xxx).emit注意broadcast可提升其逼格，发送广播给其他用户或群组.

// 原始数据
var port        = Number(process.argv[2]) || 3000,
    socketUsers = [],
    receptors   = [],
    cacheMsg    = [];

AccountModel
  .find({role: 'receptor'})
  .exec(function (err, result) {
    if (err) {
      console.log(err);
    } else {
      receptors = result;
    }
  });

// 用户类
function SocketUser (socket) {
  return {
    _id             : socket.id,
    account_id      : '',
    name            : '游客' + (+new Date).toString(36),
    ip              : socket.handshake.address,
    user_agent      : socket.handshake.headers['user-agent'],
    referer         : socket.handshake.headers.referer,
    connect_time    : +new Date,
    disconnect_time : 0,
    // 以下是不放在数据库的信息
    role            : 'customer',
    target          : ''
  };
}

// 方法
function isReceptor (name, pass) {
  var result = {
    valid : false,
    _id   : ''
  };
  receptors.forEach(function (v) {
    if (v.name === name) {
      result.valid = v.password === pass;
      result._id   = v._id;
    }
  });
  return result;
}

function getUser (socket_id) {
  for (var i = 0, l = socketUsers.length; i < l; i++) {
    if (socketUsers[i]._id === socket_id) {
      return socketUsers[i];
    }
  }
  return null;
}

function getReceptors () {
  var list = [];
  for (var i = 0, l = socketUsers.length; i < l; i++) {
    if (socketUsers[i].role === 'receptor') {
      list.push(socketUsers[i]);
    }
  }
  return list;
}

function cachedMsgsFromCustomer (id) {
  cacheMsg.forEach(function (value) {
    if (value.customer === id) {
      return value;
    }
  });
  return false;
}

// 用户连接到服务器
io.on('connection', function (socket) {
  // 创建新用户
  var user = new SocketUser(socket);
  socketUsers.push(user);

  // 往数据库添加用户信息
  SocketUserModel(user).save(function (err) {
    if (err) {
      console.log(err);
    }
  });

  // 给所有接线员发送用户更新通知
  io.to('receptors').emit('add user', user);

  // 把ID发回给用户
  socket.emit('connection success', user);

  // 接线员登陆
  socket.on('login', function (data) {
    var accountInfo = isReceptor(data.name, data.pass);
    if (accountInfo.valid === true) {
      // 首先，如果没有其他接线员，那么这个接线员要接收所有离线消息
      if (getReceptors().length === 0) {
        console.log('我是第一个登录的接线员：' + data.name);
        cacheMsg.forEach(function (value) {
          socket.emit('add history messages', value);
          console.log('发送以下数据给接线员' + data.name);
          console.log(value);
        });
        console.log('发送完毕，清空缓存');
        cacheMsg = [];
      }

      user.name = data.name;
      user.role = 'receptor';
      user.account_id = accountInfo._id;

      SocketUserModel.update({_id: user._id}, {
        name       : user.name,
        role       : user.role,
        account_id : user.account_id
      }, function (err, result) {
        if (err) {
          console.log(err);
        } else {
          console.log('接线员 ' + user.name + ' 登录');
        }
      });

      // 让这个链接(socket)加入"receptors"房间
      socket.join('receptors');
      socket.emit('login success', {
        self: user,
        socketUsers: socketUsers
      });
      console.log(socketUsers);

      // 给所有接线员发送用户更新通知
      io.to('receptors').emit('add receptor', user);
    } else {
      socket.emit('login fail');
    }
  });

  // 处理接线员发过来的接待某个客户的消息
  socket.on('i will recept someone', function (targetId) {
    if (user.role === 'receptor') {
      var customer = getUser(targetId);
      customer.target = user._id;
      user.target = customer._id;
      io.to(targetId).emit('you are recepted', {
        from_socket  : user._id,
        to_socket    : customer._id,
        from_name    : user.name,
        to_name      : customer.name,
        content      : '客服' + user.name + '为您服务',
        create_time  : +new Date
      });

      io.to('receptors').emit('someone is recepted', {
        receptor: user._id,
        recepted: customer._id
      });
    }
  });

  // 处理从web发来的消息
  socket.on('web message', function (msg) {
    if (user.target !== '') {
      var targetUser = getUser(user.target);
    }

    var newMsg = {
      from_socket : user._id,
      to_socket   : user.target,
      from_name   : user.name,
      to_name     : targetUser ? targetUser.name : '',
      content     : msg,
      create_time : +new Date
    };

    // 用数据库记录message
    MessageModel(newMsg).save(function (err, result) {
      if (err) {
        console.log(err);
      }
    });

    if (user.role === 'customer') {
      // 如果该用户是顾客
      if (getReceptors().length === 0) {
        // 如果根本没有接线员
        // 把数据缓存起来！
        var cachedMsgs = cachedMsgsFromCustomer(user._id);
        if (cachedMsgs !== false) {
          // 已经有缓存过的数据
          cachedMsgs.messages.push(newMsg);
        } else {
          // 此用户的消息没有缓存过
          cacheMsg.push({
            messages: [newMsg],
            customer: user._id,
            receptor: String(user.target)
          });
        }
      } else {
        // 如果有接线员
        if (user.target === '') {
          // 如果他暂未被某接线员接待
          // 把消息发送给所有接线员
          io.to('receptors').emit('add message', newMsg);
        } else {
          // 如果他已经被某个接线员接待了
          // 接线员的对话窗口添加消息
          io.to(user.target).emit('add message', newMsg);
        }
      }
      // 消息来源的对话窗口添加消息
      socket.emit('add message', newMsg);
    } else {
      // 如果该用户是接线员
      // > 客户的对话窗口添加消息
      io.to(user.target).emit('add message', newMsg);
      // > 接线员的对话窗口添加消息
      socket.emit('add message', newMsg);
    }
  });

  // 如果用户的接线员离线
  socket.on('my receptor is disconnected', function (historyMsgs) {
    if (getReceptors().length === 0) {
      // 把消息缓存起来
      cacheMsg.push({
        messages: historyMsgs,
        customer: String(user._id),
        receptor: String(user.target)
      });
      console.log('接线员离线了，我要缓存以下数据：');
      console.log(cacheMsg);
    } else {
      io.to('receptors').emit('add history messages', {
        messages: historyMsgs,
        customer: String(user._id),
        receptor: String(user.target)
      });
      user.target = '';
    }
  });

  // web端断开连接
  socket.on('disconnect', function () {
    if (user.role === 'customer') {
      io.to('receptors').emit('customer disconnect', user._id);
      socketUsers.splice(socketUsers.indexOf(user), 1);
    } else {
      io.emit('receptor disconnect', user._id);
      socketUsers.forEach(function (item) {
        if (item.target === user._id) {
          item.target = '';
        }
      });
      socketUsers.splice(socketUsers.indexOf(user), 1);
      socket.leave('receptors');
    }

    SocketUserModel.update({id: user._id}, {disconnect_time: +new Date}, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log('用户 ' + user.name + ' 离线');
      }
    });
  });
});

http.listen(port, function () {
  console.log('listening on *:' + port);
});
