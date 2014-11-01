angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');
  self.messages      = [];
  self.users         = [];
  self.profile       = {};
  self.userTab       = 'pending';

  self.getUser = function (id) {
    for (var i = 0, l = self.users.length; i < l; i++) {
      if (self.users[i].id === id) {
        return self.users[i];
      }
    }
    return null;
  };

  self.removeMsgFrom = function (uid) {
    for (var i = 0, l = self.messages.length; i < l; i++) {
      if (self.messages[i].from === uid) {
        self.messages.splice(i, 1);
        l--;
      }
    }
  };

  self.removeMsgTo = function (uid) {
    for (var i = 0, l = self.messages.length; i < l; i++) {
      if (self.messages[i].to === uid) {
        self.messages.splice(i, 1);
        l--;
      }
    }
  };

  self.submitText = function () {
    if (self.currentText) {
      hqSocket.emit('webMsg', self.currentText);
      self.currentText = '';
      dialog.scrollTop = dialog.scrollHeight;
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
    self.loading = true;
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
    self.loading = false;
  });

  hqSocket.on('addUser', $scope, function (user) {
    self.users.push(user);
  });

  hqSocket.on('customerDisconnect', $scope, function (id) {
    self.users.splice(self.users.indexOf(self.getUser(id)), 1);
    self.removeMsgTo(id);
    self.removeMsgFrom(id);
  });

  hqSocket.on('addMsg', $scope, function (msg) {
    self.messages.push(msg);
  });
});
