angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, $timeout, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');

  self.messages         = [];
  self.socketUsers      = [];
  self.profile          = {};
  self.userTab          = 'pending';
  self.unreads          = [];
  self.pendings         = [];
  self.missedCustomers  = [];
  self.missedMessages   = [];
  self.historyCustomers = [];
  self.historyMessages  = [];

  // Define Private Methods.
  function getUser (socket_id) {
    var result = [];
    for (var i = 0, l = self.socketUsers.length; i < l; i++) {
      if (self.socketUsers[i]._id === socket_id) {
        result.push(self.socketUsers[i]);
      }
    }
    if (result.length > 0) {
      if (result.length === 1) {
        return result[0];
      } else {
        return result;
      }
    } else {
      return null;
    }
  }

  function removeMsgFrom (socket_id, group) {
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].from_socket === socket_id) {
        group.splice(i, 1);
        l--;
        i--;
      }
    }
  }

  function removeMsgTo (socket_id, group) {
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].to_socket === socket_id) {
        group.splice(i, 1);
        l--;
        i--;
      }
    }
  }

  function removeAllMsg (socket_id, group) {
    var group = group || self.messages;
    removeMsgFrom(socket_id, group);
    removeMsgTo(socket_id, group);
  }

  function DialogToBottom () {
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 100);
  }

  function isQueryTimeValid (type) {
    self[type + 'UsersStartDayTimestamp'] = +Date.parse(self[type + 'UsersStartDay']);
    self[type + 'UsersEndDayTimestamp'] = +Date.parse(self[type + 'UsersEndDay']) + (24 * 3600 * 1000);
    return self[type + 'UsersEndDayTimestamp'] > self[type + 'UsersStartDayTimestamp'];
  }

  // Define Public Methods.
  self.hasPendingUser = function () {
    for (var i = 0, l = self.socketUsers.length; i < l; i++) {
      if (self.socketUsers[i].target === '' && self.socketUsers[i].role !== 'receptor') {
        return true;
      }
    }
    return false;
  };

  self.countPendings = function (socket_id) {
    var count = 0;
    for (var i = 0, l = self.pendings.length; i < l; i++) {
      if (self.pendings[i].from_socket === socket_id) {
        count++;
      }
    }
    return count;
  };

  self.countUnreads = function (socket_id) {
    var count = 0;
    for (var i = 0, l = self.unreads.length; i < l; i++) {
      if (self.unreads[i].from_socket === socket_id) {
        count++;
      }
    }
    return count;
  };

  self.submitText = function () {
    if (self.currentText && self.userTab === 'recepting') {
      hqSocket.emit('web message', self.currentText);
      self.currentText = '';
    }
  };

  self.submitIfEnter = function (e) {
    var e = e || window.event;
    if (e.keyCode === 13) {
      self.submitText();
    }
  };

  self.recept = function (socket_id) {
    hqSocket.emit('i will recept someone', socket_id);
    self.userTab = 'recepting';
  };

  self.login = function () {
    if (self.username && self.password) {
      hqSocket.emit('login', {
        name: self.username,
        pass: self.password
      });
      self.username = '';
      self.password = '';
    }
  };

  // 历史消息与离线消息相关
  // 获取错过了的客户列表
  self.getMissedCustomers = function () {
    if(isQueryTimeValid('missed')) {
      hqSocket.emit('get missed customers', {
        start: self.missedUsersStartDayTimestamp,
        end: self.missedUsersEndDayTimestamp
      });
    } else {
      alert('请输入正确的日期');
    }
  };
  // 获取历史用户列表
  self.getHistoryCustomers = function () {
    if(isQueryTimeValid('history')) {
      hqSocket.emit('get history customers', {
        start: self.historyUsersStartDayTimestamp,
        end: self.historyUsersEndDayTimestamp
      });
    } else {
      alert('请输入正确的日期');
    }
  };

  // 根据用户名获取离线消息
  self.getMissedMessages = function (name) {
    hqSocket.emit('get missed messages of someone', name);
    self.currentMissedCustomer = name;
  };
  // 根据用户名获取历史消息
  self.getHistoryMessages = function (name) {
    hqSocket.emit('get history messages of someone', name);
    self.currentHistoryCustomer = name;
  };

  // 查看离线游客列表
  hqSocket.on('show missed customers', function (customers) {
    // do something with data
    self.missedCustomers = customers;
  });
  // 查看某个离线客户的消息
  hqSocket.on('show missed messages of someone', function (messages) {
    self.missedMessages = messages;
    DialogToBottom();
  });

  // 查看历史用户列表
  hqSocket.on('show history customers', function (customers) {
    // do something with data
    self.historyCustomers = customers;
  });
  // 查看某个历史客户的消息
  hqSocket.on('show history messages of someone', function (messages) {
    self.historyMessages = messages;
    DialogToBottom();
  });

  // Define socket events.
  hqSocket.on('connection success', function (user) {
    self.profile = user;
    self.socketUsers.push(user);
  });

  hqSocket.on('login success', function (data) {
    self.isLoggedIn  = true;
    self.socketUsers = data.socketUsers;
    self.profile     = getUser(data.self._id);
  });

  hqSocket.on('login fail', function () {
    alert('账号或密码不正确！');
  });

  hqSocket.on('add user', function (user) {
    self.socketUsers.push(user);
  });

  hqSocket.on('add receptor', function (user) {
    var current = getUser(user._id);
    current.role = user.role;
    current.name = user.name;
  });

  hqSocket.on('someone is recepted', function (data) {
    if (data.receptor === self.profile._id) {
      self.profile.target = data.recepted;
    }
    getUser(data.recepted).target = data.receptor;
    removeAllMsg(data.recepted, self.unreads);
    removeAllMsg(data.recepted, self.pendings);
    DialogToBottom();
  });

  hqSocket.on('add message', function (msg) {
    self.messages.push(msg);
    var newMsg = self.messages[self.messages.length - 1];
    if (newMsg.to_socket === '') {
      self.pendings.push(newMsg);
    } else if (newMsg.to_socket === self.profile._id && self.profile.target !== newMsg.from_socket) {
      self.unreads.push(newMsg);
    } else {
      DialogToBottom();
    }
  });

  hqSocket.on('add history messages', function (data) {
    data.messages.forEach(function (msg) {
      // 如果是发给客户的消息，那么这些消息的来源改成当前接线员的ID
      if (msg.to_socket === data.customer) {
        msg.from_socket = self.profile._id;
      }
      // 如果是客户发过来的消息，那么这些消息的目标应该为空（本地）
      if (msg.from_socket === data.customer) {
        msg.to_socket = '';
      }
      // 删除多余的信息（$$hashKey）
      msg = {
        from_socket: msg.from_socket,
        to_socket: msg.to_socket,
        from_name: msg.from_name,
        to_name: msg.to_name,
        content: msg.content,
        create_time: msg.create_time
      };
    });
    // 把消息放入messages和pendings
    Array.prototype.push.apply(self.messages, data.messages);
    Array.prototype.push.apply(self.pendings, data.messages);
  });

  hqSocket.on('customer disconnect', function (socket_id) {
    self.socketUsers.splice(self.socketUsers.indexOf(getUser(socket_id)), 1);
    removeAllMsg(socket_id);
    removeAllMsg(socket_id, self.unreads);
  });

  hqSocket.on('receptor disconnect', function (socket_id) {
    self.socketUsers.splice(self.socketUsers.indexOf(getUser(socket_id)), 1);
    self.socketUsers.forEach(function (item, index) {
      if (item.target === socket_id) {
        item.target = '';
      }
    });
    removeAllMsg(socket_id);
    removeAllMsg(socket_id, self.unreads);
  });
});
