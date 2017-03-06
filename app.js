const express = require('express')

// 微信的xml消息处理模块，后面的参数为token
const mp = require('wechat-mp')('testtoken')

// 主动API的调用模块，这里是测试信息。正式项目会放到一个config module里读取
const wechatAPI = require('wechat-api')
const api = new wechatAPI('wx279002cb9deb576f', 'be97aa26e1c1619a0b73a792cf59047d')

// mongodb和redis的使用模块，目前均无身份验证信息
const mongoose = require('mongoose')
const User = require('./models/user.js')
const db = mongoose.connect('mongodb://127.0.0.1:27017/vg')
const rds = require('redis').createClient(6379, '127.0.0.1', {})
const async = require('async')
const app = express()
const schedule = require('node-schedule')
const product = require('./product.js')

/**
 * 日常收益的处理
 * 目前每分钟处理一次，数据库并发处理数为1
 */
schedule.scheduleJob('0 * * * * *', () => {
    console.log(`start product cron work (${Date.now()})`)
    rds.get('vg-usersum', (err, usersum) => {
        async.timesLimit(+usersum, 1, (n, next) => {
            product(n, next)
        }, (err, n) => {

        })
    })
})

/**
 *
 * 公共函数，包括了主要的算法和参数信息，后期重构可能会整合进一个module
 *
 ********************************************************************/
const getLevel = exp => exp / 10000 << 0
const getExpPer = exp => (exp % 10000) / 100
const getOutput = (workersum, farmlevel) => {
    return workersum * 10 + farmlevel * 3
}
const getWorkProduct = (workersum, farmlevel) => {
    return getOutput(workersum, farmlevel) * (5 + Math.random() * 5) << 0
}
const getLimit = (granarylevel) => {
    return 3000 + granarylevel * 100
}
const getFarmCost = farmlevel => 100
const getGranaryCost = granarylevel => 100
const getWallCost = walllevel => 10
const getFarmAdd = farmlevel => 3 * farmlevel
const getGranaryAdd = granarylevel => 100 * granarylevel
const getWallAdd = walllevel => walllevel
/*********************************************************************/


let eventHander = {}

/**
 * 事件的处理，现在只简单的有的分发处理一下，未知的直接会空消息
 */
eventHander.handle = (req, res, next) => {
    let event = req.body.param.event
    if (event in eventHander) {
        eventHander[event](req, res, next)
    } else {
        res.body = {}
        next()
    }
}

/**
 * 订阅事件的处理，当前只提示欢迎信息，没有其他处理
 */
eventHander.subscribe = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '欢迎来到村庄游戏，这是微信上的第一款策略游戏。你可以生产粮食🍞，将他们出售💰，进行任务，攻击其他玩家，并且发展你的村庄！\n开始游戏吧！\n发送"开始游戏"可以开始游戏\n发送"帮助"可以查看所有指令',
            }
            next()
        } else {
            res.body = {
                msgType: 'text',
                content: '欢迎回到村庄游戏'
            }
            next()
        }
    })
}

let textHander = {}

/**
 * 文字信息对应的函数的对象数组，后面会加入i18n的功能
 */
textHander.texts = {
    '开始游戏': 'startgame',
    '帮助': 'gethelpmsg',
    'a': 'startgame',
    'd': 'deleteme',
    '工作': 'startwork',
    'b': 'startwork',
    '出售粮食': 'sellcrops',
    'c': 'sellcrops',
    '信息': 'getuserdata',
    'm': 'getuserdata',
    '招募工人': 'recruitworker',
    'recruitworker': 'recruitworker',
    '建筑': 'building',
    'building': 'building',
    '升级农场': 'updatefarm',
    '升级粮仓': 'updategranary',
    '升级围墙': 'updatewall',
    '招募士兵': 'recruitworker',
    '任务': 'getmissions',
    'getmissions': 'getmissions',
    '邀请人': {
        type: 'param',
        paramsum: 1,
        name: 'beinvitedby'
    },
    '排行榜': 'getrank',
    'r': 'getrank',
    '寻找敌人': 'findenemy'
    '进攻': {
        type: 'param',
        paramsum: 1,
        name: 'attack'
    }
}

/**
 * 处理文字消息
 * 普通的函数只要在对照数组里写上方法名即可
 * 如果函数没有实现会返回功能尚未完成的信息，程序不会终止
 * 需要参数的需要一个对象，格式为{ type: 'param', paramsum: n, name: methodname }
 * 格式必须规范否则直接报错程序终止
 *
 */
textHander.handle = (req, res, next) => {
    let text = req.body.text
    console.log(text)
    if (text in textHander.texts) {
        let method = textHander.texts[text]
        if (method in textHander) {
            textHander[method](req, res, next)
        } else if ('type' in method && method.type == 'param') {
            let params = req.body.text.split(' ')
            params.shift()
            if (params.length != method.paramsum) {
                res.body = {
                    msgType: 'text',
                    content: `参数的数量不对哦，这个命令应该有${method.paramsum}个参数`
                }
                next()
            } else if (method.name in textHander) {
                textHander[method.name](req, res, next, params)
            } else {
                res.body = {
                    msgType: 'text',
                    content: '该功能可能尚未完成哦'
                }
                next()
            }
        } else {
            res.body = {
                msgType: 'text',
                content: '该功能可能尚未完成哦'
            }
            next()
        }
    } else {
        res.body = {
            msgType: 'text',
            content: '未知的指令 发送"帮助"可以获得所有指令哦'
        }
        next()
    }
}

/**
 * 开始游戏，先判断是否已经开始，否则根据api获得用户昵称，游戏人数作为id，插入数据，游戏人数加一
 *
 */
textHander.startgame = (req, res, next) => {
    let uid = req.body.uid
    async.waterfall([
        (cb) => {
            User.findOne({uid: uid}, (err, user) => {
                if (user != null) {
                    res.body = {
                        msgType: 'text',
                        content: '你已经开始游戏了哦',
                    }
                    next()
                } else {
                    cb(null)
                }
            })
        },
        (cb) => {
            rds.get('vg-usersum', (err, usersum) => {
                cb(null, usersum)
            })
        },
        (usersum, cb) => {
            api.getUser({openid: uid}, (err, wechatuser) => {
                if (wechatuser == undefined) {
                    res.body = {
                        msgType: 'text',
                        content: '现在暂时无法获取你的信息，稍后再试吧',
                    }
                    next()
                    cb(new Error('API error'))
                } else {
                    cb(null, usersum, wechatuser.nickname)
                }
            })
        },
        (usersum, nickname, cb) => {
            let newUser = {
                uid: uid,
                code: usersum,
                nickname: nickname,
            }
            User.create(newUser, (err) => {
                res.body = {
                    msgType: 'text',
                    content: '恭喜你加入了村庄游戏，你现在有1个村民，快点派你的村民去工作吧\n发送"工作"即可派工人去工作哦',
                }
                rds.incr('vg-usersum')
                next()
            })
        }
    ])
}

/**
 * 返回所有指令信息
 */
textHander.gethelpmsg = (req, res, next) => {
    res.body = {
        msgType: 'text',
        content: JSON.stringify(textHander.texts),
    }
    next()
}

/**
 * 开始工作
 * 间隔10分钟才可工作一次，工作一次可随机获得五到十分钟的收益
 */
textHander.startwork = (req, res, next) => {
    let uid = req.body.uid
    let time = Date.now()
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            if (time - user.last_work_at < 10 * 60 * 1000) {
                res.body = {
                    msgType: 'text',
                    content: '不久之前才刚刚工作过哦'
                }
                next()
            } else {
                let beforecrops = user.crops
                let productcrops = getWorkProduct(user.people, user.building.farm)
                let aftercrops = beforecrops + productcrops
                let limit = getLimit(user.building.granary)
                let msg = ''
                if (aftercrops >= limit) {
                    msg = '，仓库已经堆满了哦，仓库满了之后就不能随时间增长获得粮食了，发送"出售粮食"可以将粮食出售'
                }
                User.update({uid: uid}, {'$set': {last_work_at: time, crops: aftercrops}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `工作获得了${productcrops}粮食🍞${msg}。要过十分钟才能再次工作，这段时间你可以先去做任务（发送"任务"`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 测试功能，用于删除用户数据
 */
textHander.deleteme = (req, res, next) => {
    let uid = req.body.uid
    User.remove({uid: uid}, (err) => {
        res.body = {
            msgType: 'text',
            content: '已删除 uid：' + uid
        }
        next()
    })
}

/**
 * 获取用户信息，当前模板大致如下
 *
 * XXXXX 的村庄
 * ------------------------
 * CODE: XX
 * 等级🌟 XX XX%
 *
 * 粮食🍞 XXXX/XXXX
 * 金钱💰 XXXX 💎
 * 人数👨 XXXX
 * 勋章🎖 X
 *  ------------------------
 */
textHander.getuserdata = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let msgtemp = `${user.nickname} 的村庄\n------------------------\nCODE:  ${user.code}\n等级 🌟${getLevel(user.exp)} ${getExpPer(user.exp)}%\n\n粮食🍞 ${user.crops}/${getLimit(user.building.granary)}\n金钱💰 ${user.golds} 💎\n人数👨 ${user.people}\n勋章🎖 ${user.medal}\n ------------------------`
            res.body = {
                msgType: 'text',
                content: msgtemp
            }
            next()
        }
    })
}

/**
 * 出售粮食，当前一粮食抵一金币
 */
textHander.sellcrops = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let aftergolds = user.golds + user.crops
            User.update({uid: uid}, {'$set': {crops: 0, golds: aftergolds}}, (err) => {
                res.body = {
                    msgType: 'text',
                    content: `卖出了${user.crops}粮食，现在有${aftergolds}金钱`
                }
                next()
            })
        }
    })
}

/**
 * 招募工人，其实只是告诉玩家获得工人的方法而已
 */
textHander.recruitworker = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            res.body = {
                msgType: 'text',
                content: `只要将这个游戏分享给你的朋友，让他们发送"邀请人 ${user.code}"你和他就都可以获得一名工人和100金钱。`
            }
            next()
        }
    })
}

/**
 * 给用户设置邀请人id，给邀请者和被邀请者加一个工人和100金钱
 *  - 之后可能会给邀请人推送消息
 */
textHander.beinvitedby = (req, res, next, params) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            User.findOne({code: code}, (err, inviter) => {
                if (inviter == null) {
                    res.body = {
                        msgType: 'text',
                        content: '邀请人不存在，和邀请你的人确认一下哈。请不要试图随便输一个code（笑'
                    }
                    next()
                } else {
                    User.update({uid: uid}, {'$set': {people: user.people + 1, golds: user.golds + 100}}, (err) => {
                        User.update({code: code}, {'$set': {people: inviter.people + 1, golds: inviter.golds + 100}}, (err) => {
                            res.body = {
                                msgType: 'text',
                                content: '恭喜你获得一名工人和100金钱'
                            }
                            next()
                        })
                    })
                }
            })
        }
    })
}

/**
 * 返回建筑等级信息和升级方法
 */
textHander.building = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let buildings = user.building
            let msgtemp = `你可以透過興建各種建築🏡來增強您的村落🏘。\n\n农场 (等級 ${buildings.farm}) 每分钟额外制造粮食\n当前: +${getFarmAdd(buildings.farm)}🍞 升级后: +${getFarmAdd(buildings.farm + 1)}🍞 价格: ${getFarmCost(buildings.farm + 1)}💰\n发送"升级农场"升级\n\n粮仓 (等級 ${buildings.granary}) 增加粮食上限\n当前: +${getGranaryAdd(buildings.granary)}🍞 升级后: +${getGranaryAdd(buildings.granary + 1)}🍞 价格: ${getGranaryCost(buildings.granary + 1)}💰\n发送"升级粮仓"升级\n\n围墙 (等級 ${buildings.wall})  提升被攻击时的防御力\n当前: +${getWallAdd(buildings.wall)}🛡 升级后: +${getWallAdd(buildings.wall + 1)}🛡 价格: ${getWallCost(buildings.wall)}💰\n发送"升级围墙"升级\n\n当前金钱💰 ${user.golds}`
            res.body = {
                msgType: 'text',
                content: msgtemp
            }
            next()
        }
    })
}

/*******************************************************
 * 下面升级建筑的函数其实都是一个套路，如果今后要增加建筑的种类可能会重构，不然就先这么放着了
 *******************************************************/

/**
 * 升级农场
 */
textHander.updatefarm = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let updatecost = getFarmCost(user.building.farm + 1)
            if (user.golds < updatecost) {
                res.body = {
                    msgType: 'text',
                    content: `金钱不足，升级需要${updatecost}💰，你有${user.golds}💰`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {building.farm: user.building.farm, golds: user.golds - updatecost}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `升级成功，花费${updatecost}💰，你还有${user.golds - updatecost}💰`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 升级粮仓
 */
textHander.updatefarm = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let updatecost = getGranaryCost(user.building.granary + 1)
            if (user.golds < updatecost) {
                res.body = {
                    msgType: 'text',
                    content: `金钱不足，升级需要${updatecost}💰，你有${user.granary}💰`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {building.granary: user.building.granary, golds: user.golds - updatecost}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `升级成功，花费${updatecost}💰，你还有${user.golds - updatecost}💰`
                    }
                    next()
                })
            }
        }
    })
}

/**
 * 升级围墙
 */
textHander.updatefarm = (req, res, next) => {
    let uid = req.body.uid
    User.findOne({uid: uid}, (err, user) => {
        if (user == null) {
            res.body = {
                msgType: 'text',
                content: '请先发送"开始游戏"'
            }
            next()
        } else {
            let updatecost = getWallCost(user.building.wall + 1)
            if (user.golds < updatecost) {
                res.body = {
                    msgType: 'text',
                    content: `金钱不足，升级需要${updatecost}💰，你有${user.golds}💰`
                }
                next()
            } else {
                User.update({uid: uid}, {'$set': {building.wall: user.building.wall, golds: user.golds - updatecost}}, (err) => {
                    res.body = {
                        msgType: 'text',
                        content: `升级成功，花费${updatecost}💰，你还有${user.golds - updatecost}💰`
                    }
                    next()
                })
            }
        }
    })
}

const handlerlist = {
    'event': eventHander,
    'text': textHander,
}

app.use(mp.start())

/**
 * 用于接受微信发送的xml消息，路径可改
 */
app.post('/', (req, res, next) => {
    let type = req.body.type
    if (type in handlerlist) {
        handlerlist[type].handle(req, res, next)
    }
}, mp.end())

app.all('/', (req, res) => {
    console.log('--------------------res.body---------------------')
    console.log(res.body)
})

app.listen(80)
