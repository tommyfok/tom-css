angular.module('HongQi')

.controller('HongQiCtrl', function ($scope, hqSocket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');
  self.users    = [];
  self.messages = [];
  self.messages.push({
    content: '您好，请问有什么可以帮到您？',
    src: 'remote'
  });

  self.submitText = function () {
    if (self.currentText) {
      hqSocket.emit('webMsg', {
        content: self.currentText
      });
      self.currentText = '';
      dialog.scrollTop = dialog.scrollHeight;
    }
  };

  hqSocket.on('addToDialog', function (data) {
    $scope.$apply(function () {
      self.messages.push(data);
    });
    dialog.scrollTop = dialog.scrollHeight;
  });

  hqSocket.on('recepted', function (receptor) {
    $scope.$apply(function () {
      if (self.receptor !== receptor) {
        self.receptor = receptor;
        self.messages.push({
          src: 'remote',
          content: '您好，客服 ' + receptor + ' 为您服务'
        });
      }
    });
  });

  hqSocket.on('updateAllUsers', function (data) {
    $scope.$apply(function () {
      self.users.push(data);
    });
  });
});
