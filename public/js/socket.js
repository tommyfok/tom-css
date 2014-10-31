angular.module('Socket', [])

.factory('hqSocket', function () {
  return io();
});
