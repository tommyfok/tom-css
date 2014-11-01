angular.module('Socket', [])

.factory('hqSocket', function () {
  // factory method will return the same object to all injectors
  // while service mode will return an entirly `new` object
  function newIo () {
    var self = this;
    self.io = io();
    self.on = function (event, scope, callback) {
      self.io.on(event, function (data) {
        var context = this;
        scope.$apply(function () {
          callback.call(context, data);
        });
      });
    };
    self.emit = function (event, data) {
      self.io.emit(event, data);
    };
  }

  return new newIo;
});
