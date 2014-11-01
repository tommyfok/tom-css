angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');

  self.messages = [];

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

  hqSocket.on('connectionSuccess', $scope, function (user) {
    self.profile = user;
  });

  hqSocket.on('recepted', $scope, function (msg) {
    if (self.profile.target !== msg.from) {
      self.profile.target = msg.from;
      self.messages.push(msg);
    }
  });

  hqSocket.on('addMsg', $scope, function (msg) {
    self.messages.push(msg);
  });
});
