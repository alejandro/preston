/*
 * Static server
*/

var crypto  = require('crypto')
var fs      = require('fs')
var qs      = require('querystring')
var houston = require('nhouston')
var sio     = require('socket.io')
var cfg     = require('./config')


var running   = +new Date
var actives   = fs.readdirSync(__dirname) // all the apps
var genCookie = crypto.createHash('sha').update(cfg.token + running).digest('hex') // Generated a runtime token
var js        = fs.readFileSync(__dirname + '/emitter.tmpl','utf8') // Default template for the broadcaster

/*
  I don't use globals but this is a nice way to remind me that they are globals
 */
global.active   = 'nodeio' // Principal and active presentation
global.cslide   = 1
global.tmppath  = '/' + global.active + '/' + genCookie
global.username = cfg.users[0].split(':')[0]

/*
 The Main Server, all the logic is handled by Houston 
 We are gonna listen to two paths, which one is dinamically added on the fly
 and the second is a fixed one (active)
 */

var server = houston.createServer({
    path: __dirname,
    port: process.env.PORT || process.env.app_port || 3000,
    verbose: true,
    safe: true,
    ignore: [__dirname + '/server.js'],
})


/*
  This is the broadcaster endpoint, wich load the broadcast template
  And insert the code for the "broadcast" option
  */
function handler (req, res) {
  var base = req.url.split(running)[0].replace('/' + active + '/', '')
  var file = fs.readFileSync(__dirname + '/' + active + '/index.html', 'utf8')
  res.setHeader('Content-type', 'text/html')
  res.end(file.replace('{{emitter}}', js.replace('{{token}}', base).replace('{{username}}', username)))
}


server.on('/active', function(req, res) {
  if (req.headers.authorization && req.method === 'POST') {
    var basicauth = req.headers.authorization
    var buff = new Buffer(basicauth.substring(basicauth.indexOf(" ") + 1), 'base64')
    var creds = buff.toString('ascii')
    var password = creds.substring(creds.indexOf(':') + 1)
    username = creds.substring(0, creds.indexOf(':'))

    if (cfg.users.indexOf(creds) < 0) return res.error(401, 'Unauthorized')
    
    var body = ''
    req.on('data', function(data){
        body += data.toString()
    })
    req.once('end', function(){
        var data = qs.parse(body || '{}')
        if (!data.active) return res.error(402,'incomplete data')
        if (!!~actives.indexOf(data.active)) {
          if (!data.re)  cslide = 0
          // Remove previous listeners, mostly to avoid overpopulation of listeners
          // and also to only have one single broadcaster
          if (server.listeners(tmppath).length) server.removeAllListeners(tmppath)          
          // add the new path, and make it available for only one request
          tmppath = '/' + active + '/' + genCookie + +new Date
          active = data.active
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

/*
  Get the current slide
  */
server.on('/current.json', function(req, res){
  res.end('{"active":"' +  active + '", "cslide":"' + cslide + '", "username":"' + username + '"}')
})

/*
  Websockets Logic
  Two Channels:
    - /suscribe which recives payloads from /broadcas
    - /broadcast the emitter of the payloadss
  */
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
      data.auth =  {} // delete the authorization token
      cslide = data.cslide
      suscribe.volatile.emit('cslide', data)
    }
  })
})
