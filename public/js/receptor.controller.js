angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, $timeout, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');
  self.messages      = [];
  self.users         = [];
  self.profile       = {};
  self.userTab       = 'pending';
  self.unreads       = [];
  self.pendings      = [];

  self.getUser = function (id) {
    for (var i = 0, l = self.users.length; i < l; i++) {
      if (self.users[i].id === id) {
        return self.users[i];
      }
    }
    return null;
  };

  self.removeMsgFrom = function (uid, group) {
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].from === uid) {
        group.splice(i, 1);
        l--;
        i--;
      }
    }
  };

  self.removeMsgTo = function (uid, group) {
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].to === uid) {
        group.splice(i, 1);
        l--;
        i--;
      }
    }
  };

  self.removeAllMsg = function (uid, group) {
    var group = group || self.messages;
    self.removeMsgFrom(uid, group);
    self.removeMsgTo(uid, group);
  };

  self.hasPendingUser = function () {
    for (var i = 0, l = self.users.length; i < l; i++) {
      if (self.users[i].target === '' && self.users[i].role !== 'manager') {
        return true;
      }
    }
    return false;
  };

  self.countPendings = function (uid) {
    var count = 0;
    for (var i = 0, l = self.pendings.length; i < l; i++) {
      if (self.pendings[i].from === uid) {
        count++;
      }
    }
    return count;
  };

  self.countUnreads = function (uid) {
    var count = 0;
    for (var i = 0, l = self.unreads.length; i < l; i++) {
      if (self.unreads[i].from === uid) {
        count++;
      }
    }
    return count;
  };

  self.submitText = function () {
    if (self.currentText) {
      hqSocket.emit('webMsg', self.currentText);
      self.currentText = '';
    }
  };

  self.submitIfEnter = function (e) {
    var e = e || window.event;
    if (e.keyCode === 13) {
      self.submitText();
    }
  };

  self.recept = function (id) {
    hqSocket.emit('receptUser', id);
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

  hqSocket.on('connectionSuccess', function (user) {
    self.profile = user;
  });

  hqSocket.on('loginSuccess', function (data) {
    self.isLoggedIn = true;
    self.users      = data.users;
    self.profile    = self.getUser(data.self.id);
  });

  hqSocket.on('loginFail', function () {
    alert('账号或密码不正确！');
  });

  hqSocket.on('addUser', function (user) {
    self.users.push(user);
  });

  hqSocket.on('addManager', function (user) {
    var current = self.getUser(user.id);
    current.role = user.role;
    current.name = user.name;
  });

  hqSocket.on('receptCustomer', function (data) {
    if (data.receptor === self.profile.id) {
      self.profile.target = data.recepted;
    }
    self.getUser(data.recepted).target = data.receptor;
    self.removeAllMsg(data.recepted, self.unreads);
    self.removeAllMsg(data.recepted, self.pendings);
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 100);
  });

  hqSocket.on('addMsg', function (msg) {
    self.messages.push(msg);
    var newMsg = self.messages[self.messages.length - 1];
    if (newMsg.to === '') {
      self.pendings.push(newMsg);
    } else if (newMsg.to === self.profile.id && self.profile.target !== newMsg.from) {
      self.unreads.push(newMsg);
    } else {
      $timeout(function () {
        dialog.scrollTop = dialog.scrollHeight;
      }, 100);
    }
  });

  hqSocket.on('addHistoryMsgs', function (data) {
    data.messages.forEach(function (msg) {
      // 如果是发给客户的消息，那么这些消息的来源改成当前接线员的ID
      if (msg.to === data.customer) {
        msg.from = self.profile.id;
      }
      // 如果是客户发过来的消息，那么这些消息的目标应该为空
      if (msg.from === data.customer) {
        msg.to = '';
      }
      // 删除多余的信息（$$hashKey）
      msg = {
        from: msg.from,
        to: msg.to,
        content: msg.content,
        time: msg.time
      };
    });
    // 把消息放入messages和pendings
    Array.prototype.push.apply(self.messages, data.messages);
    Array.prototype.push.apply(self.pendings, data.messages);
  });

  hqSocket.on('customerDisconnect', function (id) {
    self.users.splice(self.users.indexOf(self.getUser(id)), 1);
    self.removeAllMsg(id);
    self.removeAllMsg(id, self.unreads);
  });

  hqSocket.on('managerDisconnect', function (id) {
    self.users.splice(self.users.indexOf(self.getUser(id)), 1);
    self.users.forEach(function (item, index) {
      if (item.target === id) {
        item.target = '';
      }
    });
    self.removeAllMsg(id);
    self.removeAllMsg(id, self.unreads);
  });
});
