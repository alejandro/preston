# Preston

The Presenter of my presentations

Basically adds some awesome sauce to the presenter. 

Using websockets I've created a broadcaster, so everybody wathching the same presentation
can be watching the *same slide* as the presenter. 

Probably not that useful as I think, but I really like the idea. 

Also is in the papeline the use of presenter's note

## Installing

~~~bash
git clone http://github.com/alejandromg/preston.git
cd preston
npm install -d
npm start
~~~

Rename the config.example.json -> config.json and edit with your custom token and the array with the `username:password` format.

To setup the "presenter-mode":

    curl -XPOST -u 'username:password' -d 'active=THEPATHNAMEOFPRESENTATION' http://localhost:3000/active

e.g
    
    curl -XPOST -u 'username:password' -d 'active=nodeio' http://localhost:3000/active
    => {"token":"9708ed3290abc74df22012a046641f6f9ea77022", "path":"/nodeio/9708ed3290abc74df22012a046641f6f9ea770221345658238672"}

The go to `http://localhost:3000/nodeio/9708ed3290abc74df22012a046641f6f9ea770221345658238672` and start broadcasting. 

*Note* The path is only available for a single request. If you by mistake closed the browser window add this to your curl request:
    
    curl -XPOST -u 'username:password' -d 'active=nodeio&re=true' http://localhost:3000/active

and it'll give you the access endpoint.

Also you can know which is the latest slide with:

    curl http://localhost:3000/current
    => {"active":"nodeio", "cslide":"1", "username":"alejandro"}

That's all.

# License 
(c) Alejandro Morales 2012
BSD - 2012


