/*
Deck Broadcaster and emitter with WebSockets
This module adds remote control support to the deck.
Copyright (c) 2012 Alejandro Morales
*/
(function($, deck, undefined) {
    var $d = $(document), 
        $body = $('body'),    
    
    updateCurrent = function(e, from, to) {       
        var $current = $[deck]('getSlide', to)
        if (window.ws && WSData.token) { // it's broacaster
            ws.emit('cslide', { 
                cslide: to,
                active: window.location.hash,
                path: '/' + window.location.pathname.split('/').filter(Boolean)[0],
                time: +new Date,
                auth: WSData
            });
            //  print slide-notes on console
            var footer = $current.children('footer')
            if (footer.length && footer.hasClass('notes')) {
                console.dir(footer.text())
            }
        }
        if ($current.hasClass('white')) {
            $body.addClass('white')
        } else {
            $body.removeClass('white')
        }
    },

    pass = function() { 
        return window.WSData && window.WSData.token
    }

    try {
        WSData = WSData || {}
    }  catch (exc) { 
        WSData = {}
    }

    function addListener (){
        if (!pass() || pass() == undefined) {
            if (!window.rs) return setTimeout(addListener, 500)
            rs.on('cslide', function(data){
                // Check if we are in the same deck as the emitter
                if (data.path == window.location.pathname) {
                    console.log('delay', +new Date - Number(data.time) + 'ms')
                    $[deck]('go', data.cslide)
                }
            })
        }
    }
    // Shortcut
    window._next = function () {
        return $[deck]('next')
    }
    /*
      Suscribe to Events
     */
    if (!window.Master && typeof(io) !== 'undefined') {
        var sio = window.rs = io.connect('/suscribe')
        sio.on('connect', function(cb){
            sio.emit('getData', +new Date)
            sio.once('cslide', function(data){
                forceUpdate(data.slide, data.path)
            })
        })
    } else if (typeof(io) == 'undefined') {
        throw new TypeError('You need to load socket.io before this script.')
    }
    window.forceUpdate = function (slide, path) {
        var current = slide
        if (path == window.location.pathname) $[deck]('go', current)
    }

    $d.bind('deck.init', function() {
        if (window.rs && !pass()) {
            addListener()
        } else { 
            setTimeout(addListener, 500)
        }
    }).bind('deck.change', updateCurrent)

})(jQuery, 'deck');