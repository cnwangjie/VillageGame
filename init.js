const mongoose = require('mongoose')
const rds = require('redis').createClient(6379, '127.0.0.1', {})

rds.exists('vg-usersum', (err, usersumexist) => {
    if (usersumexist == 0) {
        rds.set('vg-usersum', 0)
    }
})
