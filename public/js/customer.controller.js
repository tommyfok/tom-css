angular.module('TomCss')

.controller('ClientSideController', function ($scope, $timeout, tomSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');

  self.messages = [];

  self.submitText = function () {
    if (self.currentText) {
      tomSocket.emit('web message', self.currentText);
      self.currentText = '';
    }
  };

  self.submitIfEnter = function (e) {
    var e = e || window.event;
    if (e.keyCode === 13 || e.which === 13) {
      self.submitText();
    }
  };

  tomSocket.on('connection success', function (user) {
    self.profile = user;
  });

  tomSocket.on('you are recepted', function (msg) {
    if (self.profile.target !== msg.from_socket) {
      self.profile.target = msg.from_socket;
      self.messages.push(msg);
      $timeout(function () {
        dialog.scrollTop = dialog.scrollHeight;
      }, 100);
    }
  });

  tomSocket.on('add message', function (msg) {
    self.messages.push(msg);
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 100);
  });

  tomSocket.on('receptor disconnect', function (socket_id) {
    if (self.profile.target === socket_id) {
      tomSocket.emit('my receptor is disconnected', self.messages);
      self.profile.target = '';
    }
  });
});
