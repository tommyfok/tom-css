angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');
  self.users       = [];
  self.messages    = [];

  self.submitText = function () {
    if (self.currentText) {
      hqSocket.emit('webMsg', {
        content: self.currentText
      });
      self.currentText = '';
      dialog.scrollTop = dialog.scrollHeight;
    }
  };

  self.recept = function (id) {
    hqSocket.emit('receptUser', id);
    self.receptingId = id;
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

  hqSocket.on('loginSuccess', function (data) {
    $scope.$apply(function () {
      self.isLoggedIn = true;
    });
  });

  hqSocket.on('loginFail', function () {
    alert('账号或密码不正确！');
  });

  hqSocket.on('updateAllUsers', function (data) {
    $scope.$apply(function () {
      self.users = data.users;
    });
  });

  hqSocket.on('addToDialog', function (data) {
    $scope.$apply(function () {
      self.messages.push(data);
    });
    dialog.scrollTop = dialog.scrollHeight;
  });
});
