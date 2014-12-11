var express = require('express');
var app     = express();
var path    = require('path');
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var md5     = require('blueimp-md5').md5;

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
  password   : {type: String, required: true},
  nickname   : String,
  visit_count: Number,
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
  _id            : {type: String, required: true},
  uid            : {type: String, required: true},
  ip             : String,
  user_agent     : String,
  connect_time   : Number,
  disconnect_time: Number
});
var MessageSchema = new mongoose.Schema({
  from_sid   : {type: String, required: true},
  from_uid   : {type: String, required: true},
  to_sid     : String,
  to_uid     : String,
  read_sid   : String,
  read_uid   : String,
  content    : {type: String, required: true},
  create_time: {type: Number, required: true},
  client_rid : String,
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
var port = Number(process.argv[2]) || 8000,
    sessions = [];

// 会话类
function Session (params) {
}

// 消息类
function Message (params) {
}

// 方法
function updateReceptorStatus () {
  receptors.forEach(function (item) {
    if (sessionKeys[item.name]) {
      if (sessionKeys[item.name].expire > Date.now()) {
        item.status = 1;
      } else {
        item.status = 0;
        delete sessionKeys[item.name];
      }
    } else {
      item.status = 0;
    }
  });
}

function doLoginByKey (name, key) {
  if (sessionKeys[name] && sessionKeys[name].key === key && sessionKeys[name].expire > Date.now()) {
    sessionKeys[name].expire = Date.now() + 24 * 3600 * 1000;
    return doLogin(name, key, true);
  } else {
    return doLogin(name, key, false);
  }
}

function doLogin (name, pass, hasValidKey) {
  var result = {
    valid : false,
    role  : '',
    _id   : ''
  };

  // get user data
  receptors.forEach(function (v) {
    if (v.name === name) {
      result.valid = hasValidKey || (v.password === md5(pass));
      result._id   = v._id;
      result.role  = v.role;
      result.name  = name;
    }
  });

  if (!hasValidKey && result.valid) {
    sessionKeys[name] = {
      key: md5(Date.now() + pass),
      expire: Date.now() + 24 * 3600 * 1000
    };
  }

  return result;
}

function getUser (socket_id) {
  if (!socket_id) {
    return null;
  }

  for (var i = 0, l = socketUsers.length; i < l; i++) {
    if (socketUsers[i]._id === socket_id) {
      return socketUsers[i];
    }
  }

  return null;
}

function getOnlineReceptors () {
  var list = [];
  for (var i = 0, l = socketUsers.length; i < l; i++) {
    if (socketUsers[i].role === 'receptor' || socketUsers[i].role === 'admin') {
      list.push(socketUsers[i]);
    }
  }
  return list;
}

function receptorsForClient() {
  var arr = [];
  receptors.forEach(function (item) {
    if (item) {
      arr.push({
        name: item.name,
        role: item.role
      });
    }
  });
  return arr;
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
  var user = SocketUser(socket);
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
    var accountInfo = doLoginByKey(data.name, data.pass);
    if (accountInfo.valid === true) {
      // 首先，如果没有其他接线员，那么这个接线员要接收所有离线消息
      if (getOnlineReceptors().length === 0) {
        console.log('我是第一个登录的接线员：' + data.name);
        cacheMsg.forEach(function (value) {
          socket.emit('add history messages', value);
          console.log('发送以下数据给接线员' + data.name);
          console.log(value);
        });
        console.log('发送完毕，清空缓存');
        cacheMsg = [];
      }

      // 更新内存中socketUsers的信息
      user.name = data.name;
      user.role = accountInfo.role;
      user.account_id = accountInfo._id;

      // 更新数据库中socketUsers的信息
      SocketUserModel.update({
        _id: user._id
      }, {
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
      updateReceptorStatus();
      socket.emit('login success', {
        self        : user,
        socketUsers : socketUsers,
        receptors   : receptorsForClient(),
        HQKey       : sessionKeys[user.name].key
      });

      // 给所有接线员发送用户更新通知
      io.to('receptors').emit('add receptor', user);
    } else {
      socket.emit('login fail');
    }
  });

  // 处理接线员发过来的接待某个客户的消息
  socket.on('i will recept someone', function (targetId) {
    if (user.role === 'receptor' || user.role === 'admin') {
      var customer = getUser(targetId);
      if (customer) {
        customer.target = user._id;
        user.target = customer._id;
        io.to(targetId).emit('you are recepted', Message(user, customer, '客服' + user.name + '为您服务！'));

        // 把此用户发过来的消息的目的socket改成user._id，目标用户改成user.name
        MessageModel
          .update({
            from_socket: customer._id,
            to_socket: ''
          }, {
            to_socket : user._id,
            to_name   : user.name
          }, {
            multi: true
          }, function (err, result) {
            if (err) {
              console.log(err);
            }
          });

        io.to('receptors').emit('someone is recepted', {
          receptor: user._id,
          recepted: customer._id
        });
      } else {
        socket.emit('recept failed', targetId);
      }
    }
  });

  // 处理从web发来的消息
  socket.on('web message', function (msg) {
    var newMsg = Message(user, getUser(user.target), msg);

    // 用数据库记录message
    MessageModel(newMsg).save(function (err, result) {
      if (err) {
        console.log(err);
      }
    });

    if (user.role === 'customer') {
      // 如果该用户是顾客
      if (getOnlineReceptors().length === 0) {
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

  // 添加接线员帐号
  socket.on('create receptor', function (data) {
    if (user.role === 'admin') {
      AccountModel({
        name: data.name,
        password: md5(data.pass),
        role: 'receptor'
      }).save(function (err, result) {
        socket.emit('create receptor response', {
          status: err ? err : '',
          receptor: result
        });

        // 创建成功才会有_id
        if (result && ('_id' in result)) {
          result.status = 1; // 0=offline, 1=online;
          receptors.push(result);
          io.to('receptors').emit('update receptor list', receptorsForClient());
        }
      });
    }
  });

  // 删除接线员
  socket.on('remove receptor', function (username) {
    if (user.role === 'admin') {
      if (user.name === username) {
        console.log('不能删除自己');
      } else {
        AccountModel.remove({name: username}, function (err, result) {
          if (err) {
            console.log(err);
          } else {
            if (result === 1) {
              // 成功删除接线员，在内存中也删除它吧
              for (var i = 0, l = receptors.length; i < l; i++) {
                if (receptors[i].name === username) {
                  receptors.splice(i, 1);
                  break;
                }
              }
            }
          }
        });
      }
    }
  });

  // 修改密码
  socket.on('change password', function (data) {
    if (user.role === 'receptor' || user.role === 'admin') {
      AccountModel.update({
        name: user.name,
        password: md5(data.oldPass)
      }, {
        password: md5(data.newPass)
      }, function (err, result) {
        if (result) {
          // 更新内存中的密码
          receptors.forEach(function (item) {
            if (item.name === user.name) {
              item.password = md5(data.newPass);
            }
          });
        }

        socket.emit('change password response', {
          err: err,
          modified: result
        });
      });
    }
  });

  // 如果用户的接线员离线
  socket.on('my receptor is disconnected', function (historyMsgs) {
    if (getOnlineReceptors().length === 0) {
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
      if (!user.name in sessionKeys) {
        sessionKeys[user.name] = {};
      }
      sessionKeys[user.name].expire = Date.now() + 24 * 3600 * 1000;
      io.emit('receptor disconnect', user._id);
      socketUsers.forEach(function (item) {
        if (item.target === user._id) {
          item.target = '';
        }
      });
      socketUsers.splice(socketUsers.indexOf(user), 1);
      socket.leave('receptors');
    }

    // 更新数据库中的用户离线时间字段
    SocketUserModel.update({
      id: user._id
    }, {
      disconnect_time: +new Date
    }, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log('用户 ' + user.name + ' 离线');
      }
    });
  });

  // 查看曾发送过消息的离线客户的列表
  // 返回用户名称列表
  // 离线消息的特征：to_socket === ''
  socket.on('get missed customers', function (range) {
    if (user.role === 'receptor' || user.role === 'admin') {
      // 在此可以看到group by在mongodb中的实现方法
      MessageModel
        .aggregate()
        .match({
          to_socket: '',
          create_time: {$gte: range.start, $lte: range.end}
        })
        .group({
          _id: '$from_socket',
          name: {$first: '$from_name'}
        })
        .exec(function (err, data) {
          if (err) {
            console.log(err);
          } else {
            socket.emit('show missed customers', data);
          }
        });
    }
  });

  // 根据某个离线用户名称查看咨询记录
  // 注册用户有固定的username而没有固定的socket_id，所以根据username来查询更合理
  // 同上，离线消息的特征是 to_socket === ''
  socket.on('get missed messages of someone', function (username) {
    if (user.role === 'receptor' || user.role === 'admin') {
      MessageModel
      .find({
        to_socket: '',
        from_name: username
      })
      .sort({create_time: 'asc'})
      .exec(function (err, data) {
        if (err) {
          console.log(err);
        } else {
          socket.emit('show missed messages of someone', data);
        }
      });
    }
  });

  // 获取曾经与我通过话的用户列表
  // 返回用户名称列表
  // 消息特征：to_name === user.name || from_name === user.name
  socket.on('get history customers', function (range) {
    if (user.role === 'receptor' || user.role === 'admin') {
      MessageModel
        .aggregate()
        .match({
          $or: [{to_name: user.name}, {from_name: user.name}],
          create_time: {$gte: range.start, $lte: range.end}
        })
        .group({
          _id: '$from_name'
        })
        .exec(function (err, data) {
          if (err) {
            console.log(err);
          } else {
            socket.emit('show history customers', data);
          }
        });
    }
  });

  // 根据某个用户名称查看历史纪录
  socket.on('get history messages of someone', function (username) {
    if (user.role === 'receptor' || user.role === 'admin') {
      MessageModel
      .find({$or: [
        {from_name: username},
        {to_name: username}
      ]})
      .sort({create_time: 'asc'})
      .exec(function (err, data) {
        if (err) {
          console.log(err);
        } else {
          socket.emit('show history messages of someone', data);
        }
      });
    }
  });

  // 用户登出
  socket.on('logout', function (username) {
    var CurrentUser = getUser(user._id);
    if (CurrentUser) {
      if (CurrentUser.role === 'receptor' || CurrentUser.role === 'admin') {
        if (sessionKeys[username] && CurrentUser.name === username) {
          delete sessionKeys[username];
          socket.emit('logout success');
        }
      }
    }
    updateReceptorStatus();
  });
});

http.listen(port, function () {
  console.log('服务器正在监听端口' + port + '的请求');
});
