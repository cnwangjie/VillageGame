var mongoose = require('mongoose')
var UserSchema = new mongoose.Schema({
    uid: String,
    code: String,
    nickname: String,
    created_at: {
        type: Date,
        default: Date.now()
    },
    exp: {
        type: Number,
        default: 0
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
    building: {
        granary: {
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
    },
    last_work_at: {
        type: Date,
        default: 0
    },
    inviter_id: {
        type: Number
    }
})

UserSchema.statics = {
    listid: (cb) => {
        return this
              .find({})
              .exec(cb)
    },
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
