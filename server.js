/*
 * Static server
*/

var houston = require('nhouston')
var crypto  = require('crypto')
var fs      = require('fs')
var sio     = require('socket.io')
var cfg     = require('./config')
var qs      = require('querystring')

var running   = +new Date
var actives   = fs.readdirSync(__dirname)
var genCookie = crypto.createHash('sha').update(cfg.token + running).digest('hex')

global.active   = 'nodeio_1'
global.cslide   = 1
global.tmppath  = '/' + global.active + '/' + genCookie
global.username = ''

var server = houston.createServer({
    path: __dirname,
    port: process.env.PORT || process.env.app_port || 3000,
    verbose: true,
    safe: true,
    ignore: [__dirname + '/server.js'],
})

var js = fs.readFileSync(__dirname + '/emitter.tmpl','utf8')

function handler (req, res) {
  var base = req.url.split(running)[0].replace('/' + active + '/', '')
  var file = fs.readFileSync(__dirname + '/' + active + '/index.html', 'utf8')
  res.setHeader('Content-type', 'text/html')
  res.end(file.replace('{{emitter}}', js.replace('{{token}}', base).replace('{{username}}', username)))
}


server.on('/active', function(req, res) {
  if (req.headers.authorization) {
    var basicauth = req.headers.authorization;
    var buff = new Buffer(basicauth.substring(basicauth.indexOf(" ") + 1), encoding = 'base64');
    var creds = buff.toString('ascii');
    username = creds.substring(0, creds.indexOf(":"));
    var password = creds.substring(creds.indexOf(":") + 1);
  
    if (cfg.users.indexOf(creds) < 0) return res.error(401, 'Unauthorized')
    
    var body = ''
    req.on('data', function(data){
        body += data.toString()
    })
    req.once('end', function(){
        var data = qs.parse(body || '{}')
        if (!data.active) return res.error(402,'incomplete data')

        active = data.active
        if (actives.indexOf(active)) {
          cslide = 1
          tmppath = '/' + active + '/' + genCookie + +new Date
          // add the new path, and make it available for only one request
          server.on(tmppath, handler)
          res.end('{"token":"' + genCookie + '", "path":"' + tmppath + '"}')    
        } else {
          res.error(404, 'Resource doesn\'t exists')
        }
    })
    
  } else {
    res.error(401, 'Unauthorized')
  }
})


var io = sio.listen(server)

var suscribe = io.of('/suscribe').on('connection', function (socket) {
  socket.on('connect', function(){
    socket.volatile.emit('cslide',{slide:cslide, active:active})  
  })
  socket.once('getData', function(time){
      socket.emit('cslide', {slide:cslide, active: active, time: time, path: '/' + active })
  })
})

var broadcast = io.of('/broadcast').on('connection', function (socket) {
  var auth = {}
  

    socket.emit('cslide', {
      active: active,
      slide: cslide
    });
    socket.on('register', function (auth){
      auth = auth
    })
    socket.on('cslide', function(data){
      if (!data.auth.token) return
    
      if (data.auth.token.indexOf(genCookie) > -1) {
        data.auth =  {}
        cslide = data.cslide
        suscribe.volatile.emit('cslide', data)
      }
    })
});

