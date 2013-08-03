var http = require('http');
var needle = require('needle');

var port = process.argv[2] || 5555,
    response_string = 'Hello world from inside the LAN!';

http.createServer(function(req, res){

  res.writeHead(200, {'Content-Type': 'text/html'})
  res.end(response_string)

}).listen(port);
console.log('HTTP Server listening on local port ' + port)

////////////////////////////////////////////////////////////

console.log('Getting Public IP address...');

// var url = 'ifconfig.me/ip';
var url = 'checkip.dyndns.org';

needle.get(url, function(err, resp, body){
  if (err)
    process.exit(1);

  var ip = body.toString().trim().match(/([0-9\.]+)/i)[1];
  console.log('Got it! Checking if request passes through to: ' + ip);

  var params = {
    url: 'http://' + ip + ':' + port,
    method: 'GET',
    auth: 'none'
  }

  needle.post('http://www.hurl.it', params, { timeout: 15000 }, function(err, resp, body){
    if (err)
      return process.exit();

    if (body.body && body.body.toString().match(response_string))
      console.log('It went through!');
    else
      console.log('No workie.', body);

    process.exit();
  })
})
