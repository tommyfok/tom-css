angular.module('TomCss')

.controller('ClientSideController', function ($scope, $timeout, $cookies, Socket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');

  function toTop () {
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 35);
  }

  self.messages = [];

  self.submitText = function () {
    if (self.currentText) {
      Socket.emit('web message', self.currentText);
      self.currentText = '';
    }
  };

  self.submitIfEnter = function (e) {
    var e = e || window.event;
    if (e.keyCode === 13 || e.which === 13) {
      self.submitText();
    }
  };

  Socket.on('connection success', function (user) {
    self.profile = user;
    $cookies.hq_id = user._id;
    if (!localStorage.getItem('hq_messages')) {
      Socket.emit('get history messages');
    } else {
      self.messages = angular.fromJson(localStorage.getItem('hq_messages'));
    }
  });

  Socket.on('get history messages success', function (data) {
    self.messages = data;
    localStorage.setItem('hq_messages', angular.toJson(self.messages));
  });

  Socket.on('you are recepted', function (receptor) {
    self.profile.target = receptor;
  });

  Socket.on('add message', function (msg) {
    self.messages.push(msg);
    toTop();
    localStorage.setItem('hq_messages', angular.toJson(self.messages));
  });

  Socket.on('receptor disconnect', function (socket_id) {

  });
});
