var mongoose = require('mongoose')
var UserSchema = new mongoose.Schema({
    uid: String,
    code: Number,
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
        type: Number,
        default: null
    },
    attack: {
        status: {
            type: String,
            default: 'end'
        },
        enemys: {
            type: String,
            default: ''
        }
    },
    mission: {
        status: {
            type: String,
            default: 'end'
        },
        detail: {
            type: String,
            default: null
        },
        last_exec_at: {
            type: Date,
            default: 0
        }
    }
})

UserSchema.statics = {
    alltop: function(limit, cb) {
        return this
              .find()
              .sort({medal: 1})
              .limit(limit)
              .exec(cb)
    },
    lvtop: function(lv, limit, cb) {
        return this
              .find({exp: {'$gt': lv * 10000, '$lt': (lv + 1) * 10000}})
              .sort({medal: 1})
              .limit(limit)
              .exec(cb)
    },
    explike: function(uid, exp, range, cb) {
        return this
              .find({exp: {'$gt': exp - range, '$lt': exp + range}, uid: {'$ne': uid}})
              .sort({exp: 1})
              .limit(3)
              .exec(cb)
    }
}

var User = mongoose.model('User', UserSchema)
module.exports = User
