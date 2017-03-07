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
        list: {
            type: String,
            default: ''
        }
    }
})

UserSchema.statics = {
    top: (limit, cb) => {
        return this
              .find()
              .sort({medal: 1})
              .limit(limit)
              .exec(cb)
    },
    explike: function(exp, range, cb) {
      console.log(this)
        return this
              .find({exp: {'$gt': exp - range, '$lt': exp + range, '$ne': exp}})
              .sort({exp: 1})
              .limit(3)
              .exec(cb)
    }
}

var User = mongoose.model('User', UserSchema)
module.exports = User
