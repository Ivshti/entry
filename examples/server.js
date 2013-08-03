var http = require('http');
var needle = require('needle');

var port = process.argv[2] || 5555,
    response_string = 'Hello world from inside the LAN!';

http.createServer(function(req, res){

  res.writeHead(200, {'Content-Type': 'text/html'})
  res.end(response_string)

}).listen(port);
console.log('HTTP Server listening on local port ' + port)

