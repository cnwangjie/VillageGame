var mongoose = require('mongoose')
var UserSchema = new mongoose.Schema({
    id: String,
    code: String,
    created_at: {
        type: Date,
        default: Date.now()
    },
    people: {
        type: Number,
        default: 1
    },
    crops: {
        type: Number,
        default: 0
    },
    golds: {
        type: Number,
        default: 50
    },
    soldier: {
        type: Number,
        default: 0
    },
    medal: {
        type: Number,
        default: 0
    },
    entrepot: {
        type: Number,
        default: 1
    },
    farm: {
        type: Number,
        default: 1
    },
    wall: {
        type: Number,
        default: 0
    }
})

UserSchema.statics = {
    top: (limit, cb) => {
        return this
              .find()
              .sort({medal: 1})
              .limit(limit)
              .exec(cb)
    }
}

var User = mongoose.model('User', UserSchema)
module.exports = User
