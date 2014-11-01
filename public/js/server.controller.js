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
      if (self.users[i].target === '' && self.users[i].id !== self.profile.id) {
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

  hqSocket.on('connectionSuccess', $scope, function (user) {
    self.profile = user;
  });

  hqSocket.on('loginSuccess', $scope, function (data) {
    self.isLoggedIn = true;
    self.profile    = data.self;
    self.users      = data.users;
  });

  hqSocket.on('loginFail', $scope, function () {
    alert('账号或密码不正确！');
  });

  hqSocket.on('userToManager', $scope, function (id) {
    self.getUser(id).role = 'manager';
  });

  hqSocket.on('receptCustomer', $scope, function (data) {
    if (data.receptor === self.profile.id) {
      self.profile.target = data.recepted;
    }
    self.getUser(data.recepted).target = data.receptor;
    self.removeAllMsg(data.recepted, self.unreads);
    self.removeAllMsg(data.recepted, self.pendings);
  });

  hqSocket.on('addUser', $scope, function (user) {
    self.users.push(user);
  });

  hqSocket.on('customerDisconnect', $scope, function (id) {
    self.users.splice(self.users.indexOf(self.getUser(id)), 1);
    self.removeAllMsg(id);
    self.removeAllMsg(id, self.unreads);
  });

  hqSocket.on('addMsg', $scope, function (msg) {
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
});
