# tom-css
> This is a realtime customer service system using nodejs, socket.io, mongodb and angularjs etc.

- Support IE8+ and all major browsers
- See [Client Side Demo](http://www.corvy.net:8000) 
- See [Server Side Demo](http://www.corvy.net:8000/server) and login with `{username: 'tommy', password: '123456'}`

## Requirements
You should have these libraries installed globally.
- Mongodb
- Node
- Forever (a node module)

## Installation
- cd to the project folder and run `npm install` to install packages
- Initial your database:
  - `mongo` (if it comes to an error, run `mongod` or `sudo mongod` manually)
  - `use css` (`css` is name of a collection)
  - `db.accountmodels.save({name: 'tommy', password: 'e10adc3949ba59abbe56e057f20f883e', role: 'receptor'})` and you will have an initial accout name: 'tommy' with a password: '123456'

## Useage
- cd to the project folder
- start: `forever start server.js 8000`
- restart: `forever restart server.js`
- stop: `forever stop server.js`

## TODO
- Receptor Management. :heavy_check_mark:
- Socket.io sometimes unstable in client-side. Find the reason and fix it.
- Use a `conversation` data model rather than socket-id to indentify a real conversation.
- Search messages in more ways.
- Server-side UI enhancement.
- Just see [Olark](https://www.olark.com) or [ChatCat](http://chatcat.io/) for reference.
- Fix bugs.
