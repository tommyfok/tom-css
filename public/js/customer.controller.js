angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, $timeout, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');

  self.messages   = [];

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

  hqSocket.on('connectionSuccess', function (user) {
    self.profile = user;
  });

  hqSocket.on('recepted', function (msg) {
    if (self.profile.target !== msg.from) {
      self.profile.target = msg.from;
      self.messages.push(msg);
    }
  });

  hqSocket.on('addMsg', function (msg) {
    self.messages.push(msg);
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 100);
  });

  hqSocket.on('managerDisconnect', function (uid) {
    if (self.profile.target === uid) {
      hqSocket.emit('my manager is disconnected', self.messages);
      self.profile.target = '';
    }
  });
});
