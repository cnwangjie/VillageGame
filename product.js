const User = require('./models/user.js')

const getOutput = (workersum, farmlevel) => {
    return workersum * 10 + farmlevel * 3
}

const getLimit = (granarylevel) => {
    return 3000 + granarylevel * 100
}

function product(code, cb) {
    User.findOne({code: code}, (err, user) => {
        if (user == null) {
            cb(null)
            return
        }
        let selfcrops = user.crops
        let oftercrops = selfcrops + getOutput(user.people, user.building.farm)
        let limit = getLimit(user.building.granary)
        if (selfcrops >= limit) {
            cb(null)
            return
        } else if (oftercrops > limit) {
            oftercrops = limit
        }
        User.update({code: code}, {'$set': {crops: oftercrops}}, (err) => {
            cb(null)
        })
    })
}

module.exports = product
