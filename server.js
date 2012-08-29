/*
 Static server
 La lógica de los Websockets (ws) son manejadas por socket.io
 Y como servidor estático se usa Houston (nhouston), el cual es ha 
 sido "extendido" para aceptar y responder ciertas llamadas por parte
 del usuario.
 */

// Core Dependencies
var crypto = require('crypto')
var fs     = require('fs')
var qs     = require('querystring')

// Custom Dependencies
var houston = require('nhouston')
var sio     = require('socket.io')
var cfg     = require('./config')


var running   = +new Date // El tiempo de arranque de este servidor
var actives   = fs.readdirSync(__dirname) // Leer las "presentaciones" activas
// El token de este "runtime"
var genCookie = crypto.createHash('sha').update(cfg.token + running).digest('hex')
// Plantilla del còdigo de inserción para el broadcaster
var js        = fs.readFileSync(__dirname + '/emitter.tmpl','utf8')

/*
  No es una pràctica recomendada hacer uso de "globales" pero 
  ayuda a ilustrar que es lo que se quiere con ellas
 */
global.active   = 'nodeio' // La presentaciòn actualmente activa
global.cslide   = 0 // Número de la actual diapositiva 
global.tmppath  = '/' + active + '/' + genCookie // La url por default para el broadcaster
global.username = cfg.users[0].split(':')[0] // El usuario

/*
  El Servidor principal, toda la lógica necesaria es manejada por Houston
  el servidor es bien primitivo, solo responde y espera por eventos (on, once, emit)
  pero es más que necesario para los motivos de esta pequeña aplicación.
  Aqui no es necesario hacer "listen", ya que Houston se encarga de eso. Una
  alternativa más avanzadas es express.
  */

var server = houston.createServer({
  path: __dirname,
  port: process.env.PORT || process.env.app_port || 3000,
  verbose: true,
  safe: true,
  ignore: [__dirname + '/server.js']
})


/*
  Esta es la respuesta prediseñada para cuando un usuario registra una nueva 
  presentación. Lee el token de la peticiòn, luego localiza la plantilla
  y sustituye los valores para luego ser enviados a el usuario que realizó
  la petición.
  */
function resHandler (req, res) {
  var base = req.url.split(running)[0].replace('/' + active + '/', '')
  var file = fs.readFileSync(__dirname + '/' + active + '/index.html', 'utf8')
  var jsFixed  = js.replace('{{token}}', base)
                   .replace('{{username}}', username)
  var respFile = file.replace('{{emitter}}', jsFixed)
  res.setHeader('Content-type', 'text/html')
  res.end(respFile)
}

/*
  Establecer una nueva presentación como activa.
  Se utiliza Autenticación Básica. Una request via curl seria así:

    curl -XPOST -u 'username:password' -d 'active=NOMBRE' http://host.com/active
  

  */
server.on('/active', function(req, res) {
  if (req.headers.authorization && req.method === 'POST') {
    var auth     = req.headers.authorization
    var buff     = new Buffer(auth.substr(auth.indexOf(" ") + 1), 'base64')
    var creds    = buff.toString('ascii')
    var password = creds.substr(creds.indexOf(':') + 1)
    username     = creds.substr(0, creds.indexOf(':'))

    // Si el usuario no existe en nuestra "base de datos", terminar la petición
    if (cfg.users.indexOf(creds) < 0) return res.error(401, 'Unauthorized')
    
    var body = ''
    req.on('data', function(data){
        body += data.toString()
    })
    req.once('end', function() {
      var data = qs.parse(body || '{}')
      if (!data.active) return res.error(402,'incomplete data')
      if (~actives.indexOf(data.active)) {
        if (!data.re)  cslide = 0
        // Remove previous listeners, mostly to avoid overpopulation of listeners
        // and also to only have one single broadcaster
        if (server.listeners(tmppath).length) server.removeAllListeners(tmppath)
        // add the new path, and make it available for only one request
        tmppath = '/' + active + '/' + genCookie + +new Date
        active = data.active
        server.on(tmppath, resHandler)
        // Remove previous listeners
        Object.keys(broadcast.sockets).forEach(function(socket){
          broadcast.sockets[socket] && broadcast.sockets[socket].disconnect()
        })

        var response = {
          token: genCookie,
          path: tmppath
        }

        res.setHeader('Content-Type','application/json')
        res.end(JSON.stringify(response))

      } else {
        res.error(404, 'Resource doesn\'t exists')
      }
    })
  } else {
    res.error(401, 'Unauthorized')
  }
})

/*
  Obtener el estado actual del presenter
  */
server.on('/current.json', function(req, res){
  var current = {
    active: active,
    cslide: cslide,
    username: username
  }

  res.setHeader('Content-Type','application/json')
  res.end(JSON.stringify(current))
})

server.on('/count', function(req, res){
  res.end(Object.keys(suscribe.sockets).length + '\n')
})

/*
  Websockets Logic
  Two Channels:
    - /suscribe which recives payloads from /broadcas
    - /broadcast the emitter of the payloadss
  */
var io = sio.listen(server)

io.configure(function () {
  io.disable('log') 
})

var suscribe = io.of('/suscribe')

suscribe.on('connection', function (socket) {
  console.log('Suscribers: ',Object.keys(suscribe.sockets).length)
  socket.on('connect', function(){
    socket.volatile.emit('cslide', {
      cslide: cslide,
      active: active
    })
  })
  socket.once('getData', function(time){
    socket.emit('cslide', {
      slide: cslide,
      active: active,
      time: time,
      path: '/' + active
    })
  })
})

var broadcast = io.of('/broadcast')

broadcast.on('connection', function (socket) {
  // if (Object.keys(broadcast.sockets).length > 1) return socket.disconnect()
  var auth = {}
  socket.emit('cslide', {
    active: active,
    slide: cslide
  });
  socket.on('register', function (auth){
    auth = auth
  })
  socket.on('cslide', function(data){
    if (!data.auth || !data.auth.token) return
    if (~data.auth.token.indexOf(genCookie)) {
      data.auth =  {} // delete the authorization token
      cslide = data.cslide
      suscribe.volatile.emit('cslide', data)
    }
  })
})

// Si esta activada "--expose_gc", pues realizar un "garbage collection" cada minuto
if (typeof(gc) != 'undefined') {
  setInterval(gc, 10000*6)
}

process.on('SIGINT', function(){
  console.warn('Server dieing')
  try { server.close() } catch (e) {}
  process.kill(0)
})